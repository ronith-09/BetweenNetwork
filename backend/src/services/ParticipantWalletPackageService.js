const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const IdentityStoreService = require('../blockchain/wallet/identity-store.service');

class ParticipantWalletPackageService {
  static getBackendRoot() {
    return path.resolve(__dirname, '..', '..');
  }

  static getRepoRoot() {
    return path.resolve(this.getBackendRoot(), '..', '..');
  }

  static getTestNetworkRoot() {
    return process.env.TEST_NETWORK_DIR || path.join(this.getRepoRoot(), 'test-network');
  }

  static getPackagePath(bankId) {
    return path.join(
      IdentityStoreService.getParticipantWalletPath(bankId),
      'wallet-package.encrypted.json'
    );
  }

  static getPackageDownloadName(bankId) {
    return `${String(bankId || '').trim().toUpperCase()}-wallet-package.encrypted.json`;
  }

  static deriveOrgKey(orgDomain, mspId) {
    const domainLabel = String(orgDomain || '')
      .trim()
      .toLowerCase()
      .split('.')[0]
      .replace(/[^a-z0-9]/g, '');

    if (domainLabel) {
      return domainLabel;
    }

    return String(mspId || '')
      .trim()
      .toLowerCase()
      .replace(/msp$/i, '')
      .replace(/[^a-z0-9]/g, '');
  }

  static async readJsonIfExists(filePath) {
    if (!filePath) {
      return null;
    }

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  static normalizeOptionalPort(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
  }

  static resolvePeerPort(orgOnboarding = {}) {
    return (
      this.normalizeOptionalPort(orgOnboarding?.peerPort) ||
      this.normalizeOptionalPort(orgOnboarding?.peer_port) ||
      this.normalizeOptionalPort(orgOnboarding?.onboarding?.peerPort) ||
      this.normalizeOptionalPort(orgOnboarding?.onboarding?.peer_port) ||
      this.normalizeOptionalPort(orgOnboarding?.request?.peerPort) ||
      this.normalizeOptionalPort(orgOnboarding?.request?.peer_port) ||
      this.normalizeOptionalPort(orgOnboarding?.result?.peerPort) ||
      this.normalizeOptionalPort(orgOnboarding?.result?.peer_port) ||
      null
    );
  }

  static async buildDynamicConnectionProfile(orgDomain, mspId, orgOnboarding = {}) {
    const normalizedDomain = String(orgDomain || '').trim().toLowerCase();
    const normalizedMspId = String(mspId || '').trim();
    const peerPort = this.resolvePeerPort(orgOnboarding);

    if (!normalizedDomain || !normalizedMspId || !peerPort) {
      return null;
    }

    const testNetworkRoot = this.getTestNetworkRoot();
    const peerName = `peer0.${normalizedDomain}`;
    const peerTlsPath = path.join(
      testNetworkRoot,
      'organizations',
      'peerOrganizations',
      normalizedDomain,
      'peers',
      peerName,
      'tls',
      'ca.crt'
    );
    const ordererTlsPath = path.join(
      testNetworkRoot,
      'organizations',
      'ordererOrganizations',
      'example.com',
      'orderers',
      'orderer.example.com',
      'tls',
      'ca.crt'
    );

    const [peerTlsPem, ordererTlsPem] = await Promise.all([
      fs.readFile(peerTlsPath, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      }),
      fs.readFile(ordererTlsPath, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') {
          return null;
        }
        throw error;
      })
    ]);

    if (!peerTlsPem || !ordererTlsPem) {
      return null;
    }

    const orgKey = this.deriveOrgKey(normalizedDomain, normalizedMspId);
    const orgName = `${orgKey || 'participant'}Organization`;
    const channelName = process.env.FABRIC_CHANNEL_NAME || 'betweennetwork';

    return {
      name: channelName,
      version: '1.0.0',
      client: {
        organization: orgName,
        connection: {
          timeout: {
            peer: {
              endorser: '300'
            }
          }
        }
      },
      organizations: {
        [orgName]: {
          mspid: normalizedMspId,
          peers: [peerName]
        }
      },
      orderers: {
        'orderer.example.com': {
          url: 'grpcs://localhost:7050',
          tlsCACerts: {
            pem: ordererTlsPem
          },
          grpcOptions: {
            'ssl-target-name-override': 'orderer.example.com',
            hostnameOverride: 'orderer.example.com'
          }
        }
      },
      channels: {
        [channelName]: {
          orderers: ['orderer.example.com'],
          peers: {
            [peerName]: {
              endorsingPeer: true,
              chaincodeQuery: true,
              ledgerQuery: true,
              eventSource: true
            }
          }
        }
      },
      peers: {
        [peerName]: {
          url: `grpcs://localhost:${peerPort}`,
          tlsCACerts: {
            pem: peerTlsPem
          },
          grpcOptions: {
            'ssl-target-name-override': peerName,
            hostnameOverride: peerName
          }
        }
      }
    };
  }

  static async resolveConnectionProfileJson(orgDomain, mspId, orgOnboarding = {}) {
    const onboardingPath = orgOnboarding?.onboarding?.connectionProfileJson;
    const orgKey = this.deriveOrgKey(orgDomain, mspId);
    const candidatePaths = [
      onboardingPath,
      orgDomain
        ? path.join(
            this.getTestNetworkRoot(),
            'organizations',
            'peerOrganizations',
            orgDomain,
            `connection-${orgKey}.json`
          )
        : null
    ].filter(Boolean);

    for (const candidate of candidatePaths) {
      const profile = await this.readJsonIfExists(candidate);
      if (profile) {
        return {
          path: candidate,
          profile
        };
      }
    }

    const dynamicProfile = await this.buildDynamicConnectionProfile(orgDomain, mspId, orgOnboarding);
    if (dynamicProfile) {
      return {
        path: null,
        profile: dynamicProfile
      };
    }

    return {
      path: null,
      profile: null
    };
  }

  static buildPackagePayload({
    application,
    identity,
    approvalData = {},
    orgOnboarding = {},
    connectionProfile = null
  }) {
    const activationRequest = application?.internal_review_metadata?.activation_request || {};

    return {
      schema: 'betweennetwork.participant-wallet-package/v1',
      issued_at: new Date().toISOString(),
      bank: {
        application_id: application?.id || null,
        bank_id: application?.bank_id || approvalData.bank_id || null,
        legal_entity_name: application?.legal_entity_name || null,
        bic_swift_code: approvalData.bic_swift_code || activationRequest.bic_swift_code || null,
        country_code: approvalData.country_code || activationRequest.country_code || null
      },
      fabric: {
        msp_id: identity?.mspId || approvalData.msp_id || activationRequest.msp_id || null,
        enrollment_id:
          approvalData.enrollment_id || activationRequest.enrollment_id || application?.bank_id || null,
        org_name: approvalData.org_name || activationRequest.org_name || null,
        org_domain: approvalData.org_domain || activationRequest.org_domain || null,
        channel_name:
          approvalData.channel_name || activationRequest.channel_name || process.env.FABRIC_CHANNEL_NAME || 'betweennetwork',
        connection_profile: connectionProfile,
        onboarding: orgOnboarding?.success
          ? {
              bankId: orgOnboarding?.onboarding?.bankId || null,
              mspId: orgOnboarding?.onboarding?.mspId || null,
              domain: orgOnboarding?.onboarding?.domain || null,
              peerHost: orgOnboarding?.onboarding?.peerHost || null,
              peerPort: orgOnboarding?.onboarding?.peerPort || null,
              operationsPort: orgOnboarding?.onboarding?.operationsPort || null
            }
          : null
      },
      identity: {
        label: identity?.label || application?.bank_id || null,
        msp_id: identity?.mspId || null,
        type: identity?.type || 'X.509',
        version: identity?.version || 1,
        credentials: {
          certificate: identity?.certificate || null,
          privateKey: identity?.privateKey || null
        }
      }
    };
  }

  static encryptPayload(payload, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const iterations = 210000;
    const key = crypto.pbkdf2Sync(String(passphrase), salt, iterations, 32, 'sha256');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      cipher: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      payload: encrypted.toString('base64')
    };
  }

  static buildPackageDocument(bankId, encryptedPayload, orgOnboarding = {}) {
    return {
      schema: 'betweennetwork.encrypted-wallet-package/v1',
      bank_id: String(bankId || '').trim().toUpperCase(),
      generated_at: new Date().toISOString(),
      encryption: {
        cipher: encryptedPayload.cipher,
        kdf: encryptedPayload.kdf,
        iterations: encryptedPayload.iterations,
        salt: encryptedPayload.salt,
        iv: encryptedPayload.iv,
        auth_tag: encryptedPayload.authTag
      },
      payload: encryptedPayload.payload,
      onboarding: {
        success: orgOnboarding?.success === true,
        skipped: orgOnboarding?.skipped === true
      }
    };
  }

  static buildPackageMetadata(packagePath, packageDocument, connectionProfilePath = null) {
    return {
      available: true,
      file_path: packagePath,
      download_name: this.getPackageDownloadName(packageDocument.bank_id),
      generated_at: packageDocument.generated_at,
      cipher: packageDocument?.encryption?.cipher || null,
      kdf: packageDocument?.encryption?.kdf || null,
      connection_profile_path: connectionProfilePath || null,
      checksum_sha256: crypto
        .createHash('sha256')
        .update(JSON.stringify(packageDocument))
        .digest('hex')
    };
  }

  static async createEncryptedPackage({
    application,
    identity,
    approvalData = {},
    orgOnboarding = {}
  }) {
    if (!identity?.certificate || !identity?.privateKey) {
      return {
        success: false,
        skipped: true,
        message: 'Participant identity is not available yet, so no encrypted wallet package was created.'
      };
    }

    const passphrase =
      approvalData.bank_password ||
      approvalData.enrollment_secret ||
      approvalData.password ||
      null;

    if (!passphrase) {
      return {
        success: false,
        skipped: true,
        message: 'Bank password is missing, so the wallet package could not be encrypted for delivery.'
      };
    }

    const connectionProfileResult = await this.resolveConnectionProfileJson(
      approvalData.org_domain,
      approvalData.msp_id || identity.mspId,
      orgOnboarding
    );
    const payload = this.buildPackagePayload({
      application,
      identity,
      approvalData,
      orgOnboarding,
      connectionProfile: connectionProfileResult.profile
    });
    const encryptedPayload = this.encryptPayload(payload, passphrase);
    const packageDocument = this.buildPackageDocument(
      application?.bank_id || approvalData.bank_id,
      encryptedPayload,
      orgOnboarding
    );
    const packagePath = this.getPackagePath(application?.bank_id || approvalData.bank_id);

    await IdentityStoreService.ensureDirectory(path.dirname(packagePath));
    await fs.writeFile(packagePath, JSON.stringify(packageDocument, null, 2), 'utf8');

    return {
      success: true,
      packagePath,
      packageDocument,
      metadata: this.buildPackageMetadata(
        packagePath,
        packageDocument,
        connectionProfileResult.path
      )
    };
  }

  static async getEncryptedPackage(bankId) {
    const packagePath = this.getPackagePath(bankId);
    const packageDocument = await this.readJsonIfExists(packagePath);

    if (!packageDocument) {
      return null;
    }

    return {
      ...this.buildPackageMetadata(packagePath, packageDocument, null),
      content: packageDocument
    };
  }
}

module.exports = ParticipantWalletPackageService;
