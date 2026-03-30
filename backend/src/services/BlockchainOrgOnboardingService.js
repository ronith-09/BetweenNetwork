const fs = require('fs/promises');
const syncFs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const BankApplicationRepository = require('../repositories/BankApplicationRepository');
const AuditLogRepository = require('../repositories/AuditLogRepository');
const { BlockchainOnboardingStatuses, OffChainStatuses } = require('../types/enums');

const execFileAsync = promisify(execFile);

class BlockchainOrgOnboardingService {
  static isMissingOnboardingColumnError(error) {
    const message = String(error?.message || error || '');
    return (
      error?.code === '42703' &&
      message.includes('blockchain_onboarding_')
    );
  }

  static buildLegacyMetadataPatch(existingMetadata = {}, patch = {}) {
    return {
      ...existingMetadata,
      blockchain_org_onboarding: {
        ...(existingMetadata.blockchain_org_onboarding || {}),
        ...patch
      }
    };
  }

  static getBackendRoot() {
    return path.resolve(__dirname, '..', '..');
  }

  static getFabricSamplesRoot() {
    return path.resolve(this.getBackendRoot(), '..', '..');
  }

  static getTestNetworkRoot() {
    return process.env.TEST_NETWORK_DIR || path.join(this.getFabricSamplesRoot(), 'test-network');
  }

  static getDynamicOnboardingScriptPath() {
    return (
      process.env.BLOCKCHAIN_ORG_ONBOARDING_SCRIPT ||
      path.join(this.getTestNetworkRoot(), 'dynamic-org', 'onboard-bank-org.sh')
    );
  }

  static getOrgRegistryPath() {
    return path.join(this.getTestNetworkRoot(), 'dynamic-org', 'org-registry.json');
  }

  static readOrgRegistry() {
    try {
      const raw = syncFs.readFileSync(this.getOrgRegistryPath(), 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.organizations) ? parsed.organizations : [];
    } catch {
      return [];
    }
  }

  static findExistingOrganization(mspId, orgDomain) {
    const normalizedMspId = String(mspId || '').trim();
    const normalizedDomain = String(orgDomain || '').trim().toLowerCase();

    return this.readOrgRegistry().find((organization) => {
      return (
        (normalizedMspId && organization?.mspId === normalizedMspId) ||
        (normalizedDomain && String(organization?.domain || '').trim().toLowerCase() == normalizedDomain)
      );
    }) || null;
  }

  static getDefaultChannelName() {
    return process.env.FABRIC_CHANNEL_NAME || 'betweennetwork';
  }

  static sanitizeDnsLabel(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/msp$/i, '')
      .replace(/[^a-z0-9]+/g, '')
      .replace(/^-+|-+$/g, '');
  }

  static buildDefaultOrgName(mspId, bankId) {
    const normalizedMsp = String(mspId || '').trim().replace(/MSP$/i, '');
    if (normalizedMsp) {
      return normalizedMsp;
    }

    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    return normalizedBankId || 'BankOrg';
  }

  static normalizeOptionalPort(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }

  static buildRequest(application, onboardingData = {}) {
    const activationRequest = application?.internal_review_metadata?.activation_request || {};
    const bankId = String(application.bank_id || onboardingData.bank_id || '').trim().toUpperCase();
    const mspId = String(
      onboardingData.msp_id ||
      onboardingData.mspId ||
      application.msp_id ||
      activationRequest.msp_id ||
      ''
    ).trim();

    if (!bankId || !mspId) {
      throw {
        statusCode: 400,
        message: 'bank_id and msp_id are required to onboard a blockchain organization'
      };
    }

    const orgName = String(
      onboardingData.org_name ||
      onboardingData.orgName ||
      activationRequest.org_name ||
      this.buildDefaultOrgName(mspId, bankId)
    ).trim();
    const orgDomain = String(
      onboardingData.org_domain ||
      onboardingData.domain ||
      activationRequest.org_domain ||
      `${this.sanitizeDnsLabel(orgName)}.example.com`
    ).trim().toLowerCase();

    const existingOrganization = this.findExistingOrganization(mspId, orgDomain);
    const requestedPeerPort = this.normalizeOptionalPort(
      onboardingData.peer_port || onboardingData.peerPort || activationRequest.peer_port || null
    );
    const requestedOperationsPort = this.normalizeOptionalPort(
      onboardingData.operations_port || onboardingData.operationsPort || activationRequest.operations_port || null
    );
    const peerPort = existingOrganization
      ? this.normalizeOptionalPort(existingOrganization.peerPort) || requestedPeerPort
      : null;
    let operationsPort = existingOrganization
      ? this.normalizeOptionalPort(existingOrganization.operationsPort) || requestedOperationsPort
      : null;
    const channelName = String(
      onboardingData.channel_name ||
      onboardingData.channelName ||
      activationRequest.channel_name ||
      this.getDefaultChannelName()
    ).trim();

    // New organizations always receive registry-assigned ports from the onboarding
    // script so we avoid collisions from manually entered values. Existing orgs
    // preserve the ports already recorded in the registry for safe reruns.

    // The peer uses peerPort+1 for chaincode-as-a-service, so an equal or adjacent
    // operations port will crash the peer on startup. In that case we let the
    // onboarding script auto-assign a safe operations port.
    if (peerPort && operationsPort && (operationsPort === peerPort || operationsPort === peerPort + 1)) {
      operationsPort = null;
    }

    return {
      bankId,
      mspId,
      orgName,
      orgDomain,
      channelName,
      peerPort,
      operationsPort
    };
  }

  static buildCommandArgs(request, outputPath) {
    const args = [
      this.getDynamicOnboardingScriptPath(),
      '--bank-id', request.bankId,
      '--org-name', request.orgName,
      '--msp-id', request.mspId,
      '--domain', request.orgDomain,
      '--channel', request.channelName,
      '--output-json', outputPath
    ];

    if (request.peerPort) {
      args.push('--peer-port', String(request.peerPort));
    }

    if (request.operationsPort) {
      args.push('--operations-port', String(request.operationsPort));
    }

    return args;
  }

  static async markInProgress(application, request) {
    try {
      return await BankApplicationRepository.update(application.id, {
        blockchain_onboarding_status: BlockchainOnboardingStatuses.IN_PROGRESS,
        blockchain_onboarding_started_at: new Date(),
        blockchain_onboarding_failed_at: null,
        blockchain_onboarding_last_error: null,
        blockchain_org_metadata: {
          requested_at: new Date().toISOString(),
          request
        }
      });
    } catch (error) {
      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      return BankApplicationRepository.update(application.id, {
        internal_review_metadata: this.buildLegacyMetadataPatch(
          application.internal_review_metadata,
          {
            status: BlockchainOnboardingStatuses.IN_PROGRESS,
            requested_at: new Date().toISOString(),
            request,
            last_error: null
          }
        )
      });
    }
  }

  static async markSuccess(application, existingMetadata, result) {
    try {
      return await BankApplicationRepository.update(application.id, {
        status: OffChainStatuses.ACTIVE,
        blockchain_onboarding_status: BlockchainOnboardingStatuses.COMPLETED,
        blockchain_onboarding_completed_at: new Date(),
        blockchain_onboarding_failed_at: null,
        blockchain_onboarding_last_error: null,
        blockchain_org_metadata: {
          ...(existingMetadata || {}),
          completed_at: new Date().toISOString(),
          result
        }
      });
    } catch (error) {
      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      return BankApplicationRepository.update(application.id, {
        status: OffChainStatuses.ACTIVE,
        internal_review_metadata: this.buildLegacyMetadataPatch(
          application.internal_review_metadata,
          {
            status: BlockchainOnboardingStatuses.COMPLETED,
            completed_at: new Date().toISOString(),
            result,
            last_error: null
          }
        )
      });
    }
  }

  static async markFailure(application, existingMetadata, errorMessage) {
    try {
      return await BankApplicationRepository.update(application.id, {
        blockchain_onboarding_status: BlockchainOnboardingStatuses.FAILED,
        blockchain_onboarding_failed_at: new Date(),
        blockchain_onboarding_last_error: errorMessage,
        blockchain_org_metadata: {
          ...(existingMetadata || {}),
          failed_at: new Date().toISOString(),
          last_error: errorMessage
        }
      });
    } catch (error) {
      if (!this.isMissingOnboardingColumnError(error)) {
        throw error;
      }

      return BankApplicationRepository.update(application.id, {
        internal_review_metadata: this.buildLegacyMetadataPatch(
          application.internal_review_metadata,
          {
            status: BlockchainOnboardingStatuses.FAILED,
            failed_at: new Date().toISOString(),
            last_error: errorMessage
          }
        )
      });
    }
  }

  static async executeOnboarding(application, adminContext, onboardingData = {}) {
    const request = this.buildRequest(application, onboardingData);
    const outputPath = path.join(
      os.tmpdir(),
      `betweennetwork-onboard-${request.bankId.toLowerCase()}-${Date.now()}.json`
    );

    const scriptArgs = this.buildCommandArgs(request, outputPath);
    const scriptEnv = {
      ...process.env,
      FABRIC_CHANNEL_NAME: request.channelName
    };

    const updatedApplication = await this.markInProgress(application, request);

    try {
      const { stdout, stderr } = await execFileAsync('bash', scriptArgs, {
        cwd: this.getTestNetworkRoot(),
        env: scriptEnv,
        maxBuffer: 10 * 1024 * 1024
      });

      const outputRaw = await fs.readFile(outputPath, 'utf8');
      const output = JSON.parse(outputRaw);
      const finalApplication = await this.markSuccess(
        updatedApplication,
        updatedApplication.blockchain_org_metadata,
        output
      );

      await AuditLogRepository.log({
        action: 'APPLICATION_BLOCKCHAIN_ORG_ONBOARDED',
        entity_type: 'BANK_APPLICATION',
        entity_id: application.id,
        admin_id: adminContext.adminId,
        old_status: updatedApplication.status,
        new_status: finalApplication.status,
        details: {
          bank_id: request.bankId,
          msp_id: request.mspId,
          domain: request.orgDomain,
          peer_port: output.peerPort,
          stdout: stdout || null,
          stderr: stderr || null
        }
      });

      return {
        success: true,
        application: finalApplication,
        onboarding: output,
        stdout,
        stderr
      };
    } catch (error) {
      const errorMessage = error.stderr || error.stdout || error.message || 'Blockchain org onboarding failed';
      const failedApplication = await this.markFailure(
        updatedApplication,
        updatedApplication.blockchain_org_metadata,
        errorMessage
      );

      await AuditLogRepository.log({
        action: 'APPLICATION_BLOCKCHAIN_ORG_ONBOARDING_FAILED',
        entity_type: 'BANK_APPLICATION',
        entity_id: application.id,
        admin_id: adminContext.adminId,
        old_status: updatedApplication.status,
        new_status: failedApplication.status,
        details: {
          bank_id: request.bankId,
          msp_id: request.mspId,
          domain: request.orgDomain,
          error: errorMessage
        }
      });

      return {
        success: false,
        application: failedApplication,
        error: errorMessage
      };
    } finally {
      await fs.rm(outputPath, { force: true }).catch(() => {});
    }
  }
}

module.exports = BlockchainOrgOnboardingService;
