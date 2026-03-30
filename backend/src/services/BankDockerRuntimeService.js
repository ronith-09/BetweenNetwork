const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const BankApplicationRepository = require('../repositories/BankApplicationRepository');
const ParticipantRepository = require('../repositories/ParticipantRepository');

const execFileAsync = promisify(execFile);

class BankDockerRuntimeService {
  static getDockerBinary() {
    return process.env.DOCKER_BIN || 'docker';
  }

  static sanitizeDnsLabel(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/msp$/i, '')
      .replace(/[^a-z0-9]+/g, '')
      .replace(/^-+|-+$/g, '');
  }

  static async runDocker(args) {
    return execFileAsync(this.getDockerBinary(), args, {
      cwd: path.resolve(__dirname, '..', '..', '..')
    });
  }

  static async listAllContainers() {
    try {
      const { stdout } = await this.runDocker(['ps', '-a', '--format', '{{.Names}}']);
      return String(stdout || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to list docker containers: ${error.message || error}`);
    }
  }

  static async getBankMetadata(bankId) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const [application, participant] = await Promise.all([
      BankApplicationRepository.getByBankId(normalizedBankId),
      ParticipantRepository.getByBankId(normalizedBankId)
    ]);

    const activationRequest = application?.internal_review_metadata?.activation_request || {};
    const orgDomain = String(
      activationRequest.org_domain ||
      application?.org_domain ||
      `${this.sanitizeDnsLabel(activationRequest.org_name || application?.legal_entity_name || normalizedBankId)}.example.com`
    ).trim().toLowerCase();

    return {
      bankId: normalizedBankId,
      orgDomain,
      peerContainerName: `peer0.${orgDomain}`,
      chaincodePrefix: `dev-peer0.${orgDomain}-participant_chaincode_1`,
      application,
      participant
    };
  }

  static async stopContainers(containerNames) {
    if (containerNames.length === 0) {
      return { changed: [], missing: [] };
    }

    const existing = await this.listAllContainers();
    const present = containerNames.filter((name) => existing.includes(name));
    const missing = containerNames.filter((name) => !existing.includes(name));

    if (present.length > 0) {
      await this.runDocker(['stop', ...present]);
    }

    return { changed: present, missing };
  }

  static async startContainers(containerNames) {
    if (containerNames.length === 0) {
      return { changed: [], missing: [] };
    }

    const existing = await this.listAllContainers();
    const present = containerNames.filter((name) => existing.includes(name));
    const missing = containerNames.filter((name) => !existing.includes(name));

    if (present.length > 0) {
      await this.runDocker(['start', ...present]);
    }

    return { changed: present, missing };
  }

  static async reflectRevocation(bankId) {
    const metadata = await this.getBankMetadata(bankId);
    const existing = await this.listAllContainers();
    const chaincodeContainers = existing.filter((name) => name.startsWith(metadata.chaincodePrefix));
    const targets = [metadata.peerContainerName, ...chaincodeContainers];
    const result = await this.stopContainers(targets);

    return {
      success: true,
      action: 'stopped',
      peerContainerName: metadata.peerContainerName,
      chaincodeContainers,
      changed: result.changed,
      missing: result.missing
    };
  }

  static async reflectReactivation(bankId) {
    const metadata = await this.getBankMetadata(bankId);
    const existing = await this.listAllContainers();
    const chaincodeContainers = existing.filter((name) => name.startsWith(metadata.chaincodePrefix));
    const targets = [metadata.peerContainerName, ...chaincodeContainers];
    const result = await this.startContainers(targets);

    return {
      success: true,
      action: 'started',
      peerContainerName: metadata.peerContainerName,
      chaincodeContainers,
      changed: result.changed,
      missing: result.missing
    };
  }
}

module.exports = BankDockerRuntimeService;
