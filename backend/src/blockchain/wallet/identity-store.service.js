const fs = require('fs/promises');
const path = require('path');

class IdentityStoreService {
  static getDefaultAdminName() {
    return (
      process.env.BETWEENNETWORK_DEFAULT_ADMIN_NAME ||
      process.env.FABRIC_ADMIN_USER ||
      'admin'
    );
  }

  static getBaseWalletPath() {
    return process.env.FABRIC_WALLET_ROOT || path.join(process.cwd(), 'wallets');
  }

  static getAdminWalletPath(name = this.getDefaultAdminName()) {
    return path.join(this.getBaseWalletPath(), 'betweennetwork', 'admins', name);
  }

  static getParticipantWalletPath(bankId) {
    return path.join(this.getBaseWalletPath(), 'participants', bankId);
  }

  static async ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  }

  static async loadIdentity(dirPath) {
    try {
      const identityPath = await this.resolveIdentityPath(dirPath);
      if (!identityPath) {
        return null;
      }

      const raw = await fs.readFile(identityPath, 'utf8');
      if (!String(raw || '').trim()) {
        return null;
      }
      const identity = JSON.parse(raw);
      const certificate = identity.credentials?.certificate || identity.certificate || null;
      const privateKey = identity.credentials?.privateKey || identity.privateKey || null;

      return {
        ...identity,
        label: path.basename(dirPath),
        walletPath: dirPath,
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

  static async persistIdentity(dirPath, identity) {
    await this.ensureDirectory(dirPath);
    const identityPath = path.join(dirPath, 'identity.json');
    const persistedIdentity = {
      credentials: {
        certificate: identity.certificate,
        privateKey: identity.privateKey
      },
      mspId: identity.mspId,
      type: identity.type || 'X.509',
      version: identity.version || 1
    };

    await fs.writeFile(identityPath, JSON.stringify(persistedIdentity, null, 2), 'utf8');
    return identityPath;
  }

  static async resolveIdentityPath(dirPath) {
    const primaryPath = path.join(dirPath, 'identity.json');

    try {
      const stat = await fs.stat(primaryPath);
      if (stat.isFile() && stat.size > 0) {
        return primaryPath;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const walletFile = entries.find((entry) => entry.isFile() && entry.name.endsWith('.id'));
      return walletFile ? path.join(dirPath, walletFile.name) : null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}

module.exports = IdentityStoreService;
