const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const IdentityStoreService = require('./identity-store.service');

class FabricCaEnrollmentService {
  static getBackendRoot() {
    return path.resolve(__dirname, '..', '..', '..');
  }

  static getFabricSamplesRoot() {
    return path.resolve(this.getBackendRoot(), '..', '..');
  }

  static getDefaultOrgConfigs() {
    const caBaseDir = path.join(this.getFabricSamplesRoot(), 'test-network', 'organizations', 'fabric-ca');
    const peerBaseDir = path.join(this.getFabricSamplesRoot(), 'test-network', 'organizations', 'peerOrganizations');

    return {
      between: {
        key: 'between',
        mspId: process.env.BETWEEN_CA_MSP_ID || process.env.BETWEENNETWORK_ADMIN_MSP_ID || 'BetweenMSP',
        caName: process.env.BETWEEN_CA_NAME || 'ca-org1',
        caUrl: process.env.BETWEEN_CA_URL || 'https://localhost:7054',
        caCertPath: process.env.BETWEEN_CA_CERT || this.resolveFirstExistingPath([
          path.join(caBaseDir, 'org1', 'ca-cert.pem'),
          path.join(peerBaseDir, 'betweenorganization.example.com', 'ca', 'ca.betweenorganization.example.com-cert.pem')
        ]),
        affiliation: process.env.BETWEEN_CA_AFFILIATION || 'org1.department1',
        registrarId: process.env.BETWEEN_CA_REGISTRAR_ID || 'admin',
        registrarSecret: process.env.BETWEEN_CA_REGISTRAR_SECRET || 'adminpw'
      },
      bank1: {
        key: 'bank1',
        mspId: process.env.BANK1_CA_MSP_ID || 'Bank1MSP',
        caName: process.env.BANK1_CA_NAME || 'ca-org2',
        caUrl: process.env.BANK1_CA_URL || 'https://localhost:8054',
        caCertPath: process.env.BANK1_CA_CERT || this.resolveFirstExistingPath([
          path.join(caBaseDir, 'org2', 'ca-cert.pem'),
          path.join(peerBaseDir, 'bank1organization.example.com', 'ca', 'ca.bank1organization.example.com-cert.pem')
        ]),
        affiliation: process.env.BANK1_CA_AFFILIATION || 'org2.department1',
        registrarId: process.env.BANK1_CA_REGISTRAR_ID || 'admin',
        registrarSecret: process.env.BANK1_CA_REGISTRAR_SECRET || 'adminpw'
      },
      bank2: {
        key: 'bank2',
        mspId: process.env.BANK2_CA_MSP_ID || 'Bank2MSP',
        caName: process.env.BANK2_CA_NAME || 'ca-bank2',
        caUrl: process.env.BANK2_CA_URL || 'https://localhost:9055',
        caCertPath: process.env.BANK2_CA_CERT || path.join(caBaseDir, 'bankc', 'ca-cert.pem'),
        affiliation: process.env.BANK2_CA_AFFILIATION || 'bank2.department1',
        registrarId: process.env.BANK2_CA_REGISTRAR_ID || 'admin',
        registrarSecret: process.env.BANK2_CA_REGISTRAR_SECRET || 'adminpw'
      }
    };
  }

  static resolveFirstExistingPath(paths) {
    for (const candidate of paths) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return paths[0];
  }

  static getBicOrgMap() {
    const defaults = {
      GFBLGB2L: 'bank1',
      INTBDE33: 'bank2'
    };

    if (!process.env.BETWEENNETWORK_BIC_ORG_MAP) {
      return defaults;
    }

    try {
      return {
        ...defaults,
        ...JSON.parse(process.env.BETWEENNETWORK_BIC_ORG_MAP)
      };
    } catch (error) {
      throw new Error(`Invalid BETWEENNETWORK_BIC_ORG_MAP JSON: ${error.message}`);
    }
  }

  static resolveOrgConfig({ org, bankBic, mspId }) {
    const configs = this.getDefaultOrgConfigs();
    const normalizedOrg = String(org || '').trim().toLowerCase();

    if (normalizedOrg && configs[normalizedOrg]) {
      return {
        ...configs[normalizedOrg],
        mspId: mspId || configs[normalizedOrg].mspId
      };
    }

    const mappedOrg = this.getBicOrgMap()[String(bankBic || '').trim().toUpperCase()];
    if (mappedOrg && configs[mappedOrg]) {
      return {
        ...configs[mappedOrg],
        mspId: mspId || configs[mappedOrg].mspId
      };
    }

    throw new Error('Unable to resolve organization for enrollment');
  }

  static ensureFileExists(filePath, label) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`${label} not found: ${filePath}`);
    }
  }

  static buildCaClient(config) {
    this.ensureFileExists(config.caCertPath, 'CA certificate');
    const caTLSCACerts = fs.readFileSync(config.caCertPath, 'utf8');
    return new FabricCAServices(
      config.caUrl,
      { trustedRoots: caTLSCACerts, verify: false },
      config.caName
    );
  }

  static async buildAdminUserContext(adminIdentity, adminLabel) {
    const wallet = await Wallets.newInMemoryWallet();
    await wallet.put(adminLabel, {
      credentials: {
        certificate: adminIdentity.certificate,
        privateKey: adminIdentity.privateKey
      },
      mspId: adminIdentity.mspId,
      type: adminIdentity.type || 'X.509',
      version: adminIdentity.version || 1
    });

    const provider = wallet.getProviderRegistry().getProvider('X.509');
    return provider.getUserContext(
      {
        credentials: {
          certificate: adminIdentity.certificate,
          privateKey: adminIdentity.privateKey
        },
        mspId: adminIdentity.mspId,
        type: 'X.509'
      },
      adminLabel
    );
  }

  static async buildRegistrarUserContext(caClient, config) {
    const enrollment = await caClient.enroll({
      enrollmentID: config.registrarId,
      enrollmentSecret: config.registrarSecret
    });

    const wallet = await Wallets.newInMemoryWallet();
    const registrarLabel = `${config.key}-registrar`;
    const identity = {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toBytes()
      },
      mspId: config.mspId,
      type: 'X.509',
      version: 1
    };

    await wallet.put(registrarLabel, identity);
    const provider = wallet.getProviderRegistry().getProvider(identity.type);
    return provider.getUserContext(identity, registrarLabel);
  }

  static async enrollAdmin({ username, password, org = 'between', mspId }) {
    const walletPath = IdentityStoreService.getAdminWalletPath(username);
    const existingIdentity = await IdentityStoreService.loadIdentity(walletPath);
    if (existingIdentity) {
      return existingIdentity;
    }

    const config = this.resolveOrgConfig({ org, mspId });
    const caClient = this.buildCaClient(config);
    const enrollment = await caClient.enroll({
      enrollmentID: username,
      enrollmentSecret: password
    });

    const identity = {
      label: username,
      walletPath,
      mspId: config.mspId,
      type: 'X.509',
      version: 1,
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    };

    await IdentityStoreService.persistIdentity(walletPath, identity);
    return identity;
  }

  static async registerAndEnrollAdmin({
    username,
    password,
    org = 'between',
    mspId,
    affiliation
  }) {
    const walletPath = IdentityStoreService.getAdminWalletPath(username);
    const existingIdentity = await IdentityStoreService.loadIdentity(walletPath);
    if (existingIdentity) {
      return existingIdentity;
    }

    const config = this.resolveOrgConfig({ org, mspId });
    const caClient = this.buildCaClient(config);

    if (username !== config.registrarId || password !== config.registrarSecret) {
      const registrarUserContext = await this.buildRegistrarUserContext(caClient, config);

      try {
        await caClient.register(
          {
            affiliation: affiliation || config.affiliation,
            enrollmentID: username,
            enrollmentSecret: password,
            role: 'admin'
          },
          registrarUserContext
        );
      } catch (error) {
        if (!String(error.message || '').toLowerCase().includes('already registered')) {
          throw error;
        }
      }
    }

    let enrollment;
    try {
      enrollment = await caClient.enroll({
        enrollmentID: username,
        enrollmentSecret: password
      });
    } catch (error) {
      if (String(error.message || '').includes('Authentication failure')) {
        throw new Error(
          `Fabric CA rejected admin enrollment for "${username}". Use the registered enrollment secret or create a new admin name.`
        );
      }
      throw error;
    }

    const identity = {
      label: username,
      walletPath,
      mspId: config.mspId,
      type: 'X.509',
      version: 1,
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    };

    await IdentityStoreService.persistIdentity(walletPath, identity);
    return identity;
  }

  static async ensureParticipantIdentity({
    bankId,
    bankBic,
    enrollmentId,
    enrollmentSecret,
    affiliation,
    org,
    mspId
  }) {
    const walletPath = IdentityStoreService.getParticipantWalletPath(bankId);
    const existingIdentity = await IdentityStoreService.loadIdentity(walletPath);
    if (existingIdentity) {
      return existingIdentity;
    }

    const config = this.resolveOrgConfig({
      org,
      bankBic: bankBic || bankId,
      mspId
    });
    const caClient = this.buildCaClient(config);
    const registrarUserContext = await this.buildRegistrarUserContext(caClient, config);
    const resolvedEnrollmentId = enrollmentId || bankId;
    const resolvedEnrollmentSecret =
      enrollmentSecret ||
      process.env.BETWEENNETWORK_DEFAULT_BANK_ENROLLMENT_SECRET ||
      `${String(bankId).toLowerCase()}pw`;

    try {
      await caClient.register(
        {
          affiliation: affiliation || config.affiliation,
          enrollmentID: resolvedEnrollmentId,
          enrollmentSecret: resolvedEnrollmentSecret,
          role: 'client'
        },
        registrarUserContext
      );
    } catch (error) {
      if (!String(error.message || '').toLowerCase().includes('already registered')) {
        throw error;
      }
    }

    const enrollment = await caClient.enroll({
      enrollmentID: resolvedEnrollmentId,
      enrollmentSecret: resolvedEnrollmentSecret
    });

    const identity = {
      label: bankId,
      walletPath,
      mspId: config.mspId,
      type: 'X.509',
      version: 1,
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    };

    await IdentityStoreService.persistIdentity(walletPath, identity);
    return identity;
  }
}

module.exports = FabricCaEnrollmentService;
