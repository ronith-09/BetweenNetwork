const fs = require('fs/promises');
const path = require('path');
const IdentityStoreService = require('./identity-store.service');
const ParticipantService = require('../../services/ParticipantService');

class WalletService {
  static getBackendRoot() {
    return path.resolve(__dirname, '..', '..', '..');
  }

  static getTestNetworkRoot() {
    return (
      process.env.TEST_NETWORK_DIR ||
      path.resolve(this.getBackendRoot(), '..', '..', 'test-network')
    );
  }

  static async loadFilesystemIdentity(baseDir, label, mspId) {
    try {
      const [certificate, privateKey] = await Promise.all([
        fs.readFile(path.join(baseDir, 'msp', 'signcerts', `${label}-cert.pem`), 'utf8'),
        fs.readFile(path.join(baseDir, 'msp', 'keystore', 'priv_sk'), 'utf8')
      ]);

      return {
        label,
        walletPath: baseDir,
        mspId,
        type: 'X.509',
        version: 1,
        certificate,
        privateKey
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  static async getBetweenNetworkAdminIdentityFromTestNetwork(name) {
    const adminLabel = name || IdentityStoreService.getDefaultAdminName();
    const userDir = path.join(
      this.getTestNetworkRoot(),
      'organizations',
      'peerOrganizations',
      'betweenorganization.example.com',
      'users',
      'Admin@betweenorganization.example.com'
    );

    return this.loadFilesystemIdentity(
      userDir,
      'Admin@betweenorganization.example.com',
      process.env.BETWEENNETWORK_ADMIN_MSP_ID || process.env.FABRIC_MSP_ID || 'BetweenMSP'
    );
  }

  static async getBetweenNetworkAdminIdentity(name = IdentityStoreService.getDefaultAdminName()) {
    const walletPath = IdentityStoreService.getAdminWalletPath(name);
    const storedIdentity = await IdentityStoreService.loadIdentity(walletPath);
    const testNetworkIdentity = await this.getBetweenNetworkAdminIdentityFromTestNetwork(name);
    if (
      storedIdentity &&
      (
        !testNetworkIdentity ||
        (
          storedIdentity.mspId === testNetworkIdentity.mspId &&
          storedIdentity.certificate === testNetworkIdentity.certificate &&
          storedIdentity.privateKey === testNetworkIdentity.privateKey
        )
      )
    ) {
      return storedIdentity;
    }

    if (testNetworkIdentity) {
      const materializedIdentity = {
        ...testNetworkIdentity,
        label: name,
        walletPath
      };

      await IdentityStoreService.persistIdentity(walletPath, materializedIdentity);
      return IdentityStoreService.loadIdentity(walletPath);
    }

    if (storedIdentity) {
      return storedIdentity;
    }

    throw {
      statusCode: 404,
      message: `BetweenNetwork admin wallet identity "${name}" not found. Enroll the admin first.`
    };
  }

  static async getParticipantIdentityFromTestNetwork(bankId, { orgDomain, mspId } = {}) {
    const normalizedDomain = String(orgDomain || '').trim().toLowerCase();
    if (!normalizedDomain) {
      return null;
    }

    const candidateLabels = [
      `User1@${normalizedDomain}`,
      `Admin@${normalizedDomain}`
    ];
    const usersRoot = path.join(
      this.getTestNetworkRoot(),
      'organizations',
      'peerOrganizations',
      normalizedDomain,
      'users'
    );

    for (const label of candidateLabels) {
      const identity = await this.loadFilesystemIdentity(
        path.join(usersRoot, label),
        label,
        mspId
      );

      if (identity) {
        return {
          ...identity,
          label: String(bankId || '').trim().toUpperCase()
        };
      }
    }

    return null;
  }

  static async materializeParticipantIdentity(bankId, options = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const walletPath = IdentityStoreService.getParticipantWalletPath(normalizedBankId);
    const storedIdentity = await IdentityStoreService.loadIdentity(walletPath);
    const filesystemIdentity = await this.getParticipantIdentityFromTestNetwork(
      normalizedBankId,
      options
    );
    if (
      storedIdentity &&
      (
        !filesystemIdentity ||
        (
          storedIdentity.mspId === filesystemIdentity.mspId &&
          storedIdentity.certificate === filesystemIdentity.certificate &&
          storedIdentity.privateKey === filesystemIdentity.privateKey
        )
      )
    ) {
      return storedIdentity;
    }

    if (!filesystemIdentity) {
      return storedIdentity || null;
    }

    await IdentityStoreService.persistIdentity(walletPath, filesystemIdentity);
    return IdentityStoreService.loadIdentity(walletPath);
  }

  static async getParticipantIdentity(bankId) {
    await ParticipantService.assertWalletEligible(bankId);
    return this.materializeParticipantIdentity(bankId);
  }
}

module.exports = WalletService;
