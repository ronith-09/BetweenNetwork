const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

function requireArg(flag, fallback = null) {
  const value = readArg(flag) || fallback;
  if (!value) {
    throw new Error(`Missing required argument: ${flag}`);
  }
  return value;
}

function buildDefaultOrgConfigs() {
  const testNetworkDir = path.resolve(__dirname, '..', '..', '..', 'test-network');
  const caBaseDir = path.join(testNetworkDir, 'organizations', 'fabric-ca');

  return {
    between: {
      key: 'between',
      mspId: process.env.BETWEEN_CA_MSP_ID || 'BetweenMSP',
      caName: process.env.BETWEEN_CA_NAME || 'ca-org1',
      caUrl: process.env.BETWEEN_CA_URL || 'https://localhost:7054',
      caCertPath: process.env.BETWEEN_CA_CERT || path.join(caBaseDir, 'org1', 'ca-cert.pem'),
      affiliation: process.env.BETWEEN_CA_AFFILIATION || 'org1.department1',
      walletPath: path.join(process.cwd(), 'wallets', 'betweennetwork', 'admins')
    },
    bank1: {
      key: 'bank1',
      mspId: process.env.BANK1_CA_MSP_ID || 'Bank1MSP',
      caName: process.env.BANK1_CA_NAME || 'ca-org2',
      caUrl: process.env.BANK1_CA_URL || 'https://localhost:8054',
      caCertPath: process.env.BANK1_CA_CERT || path.join(caBaseDir, 'org2', 'ca-cert.pem'),
      affiliation: process.env.BANK1_CA_AFFILIATION || 'org2.department1',
      walletPath: path.join(process.cwd(), 'wallets', 'participants')
    },
    bank2: {
      key: 'bank2',
      mspId: process.env.BANK2_CA_MSP_ID || 'Bank2MSP',
      caName: process.env.BANK2_CA_NAME || 'ca-bank2',
      caUrl: process.env.BANK2_CA_URL || 'https://localhost:9055',
      caCertPath: process.env.BANK2_CA_CERT || path.join(caBaseDir, 'bankc', 'ca-cert.pem'),
      affiliation: process.env.BANK2_CA_AFFILIATION || 'bank2.department1',
      walletPath: path.join(process.cwd(), 'wallets', 'participants')
    }
  };
}

function buildBicOrgMap() {
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

function resolveOrgConfig({ org, bankBic }) {
  const configs = buildDefaultOrgConfigs();
  const normalizedOrg = org ? String(org).trim().toLowerCase() : null;

  if (normalizedOrg && configs[normalizedOrg]) {
    return configs[normalizedOrg];
  }

  const bic = String(bankBic || '').trim().toUpperCase();
  const mappedOrg = buildBicOrgMap()[bic];
  if (mappedOrg && configs[mappedOrg]) {
    return configs[mappedOrg];
  }

  throw new Error(
    'Unable to resolve organization. Pass --org between|bank1|bank2 or define BETWEENNETWORK_BIC_ORG_MAP.'
  );
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function buildCAClient(config) {
  ensureFileExists(config.caCertPath, 'CA certificate');
  const caTLSCACerts = fs.readFileSync(config.caCertPath, 'utf8');
  return new FabricCAServices(
    config.caUrl,
    { trustedRoots: caTLSCACerts, verify: false },
    config.caName
  );
}

async function buildWallet(walletPath) {
  return Wallets.newFileSystemWallet(walletPath);
}

async function getAdminContext(wallet, adminUserId = 'admin') {
  const adminIdentity = await wallet.get(adminUserId);
  if (!adminIdentity) {
    throw new Error(`Admin identity "${adminUserId}" does not exist in wallet`);
  }

  const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
  return provider.getUserContext(adminIdentity, adminUserId);
}

module.exports = {
  buildCAClient,
  buildWallet,
  getAdminContext,
  readArg,
  requireArg,
  resolveOrgConfig
};
