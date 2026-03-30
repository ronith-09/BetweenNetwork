'use strict';

const path = require('path');
const {
  buildCAClient,
  buildWallet,
  getAdminContext,
  readArg,
  requireArg,
  resolveOrgConfig
} = require('./fabricIdentityUtils');

async function main() {
  const bankBic = requireArg('--bankBic');
  const password = requireArg('--password');
  const enrollmentId = readArg('--userId') || bankBic;
  const adminUser = readArg('--adminUser') || 'admin';
  const adminWalletName = readArg('--adminWallet') || adminUser;
  const config = resolveOrgConfig({
    org: readArg('--org'),
    bankBic
  });

  const adminWalletPath = path.join(process.cwd(), 'wallets', 'betweennetwork', 'admins', adminWalletName);
  const adminWallet = await buildWallet(adminWalletPath);
  const adminUserContext = await getAdminContext(adminWallet, adminUser);

  const userWalletPath = path.join(config.walletPath, bankBic);
  const userWallet = await buildWallet(userWalletPath);
  const existingIdentity = await userWallet.get(bankBic);
  if (existingIdentity) {
    console.log(`Bank identity "${bankBic}" already exists in wallet: ${userWalletPath}`);
    return;
  }

  const caClient = buildCAClient(config);
  await caClient.register({
    affiliation: readArg('--affiliation') || config.affiliation,
    enrollmentID: enrollmentId,
    enrollmentSecret: password,
    role: 'client'
  }, adminUserContext);

  const enrollment = await caClient.enroll({
    enrollmentID: enrollmentId,
    enrollmentSecret: password
  });

  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    },
    mspId: readArg('--mspId') || config.mspId,
    type: 'X.509',
    version: 1
  };

  await userWallet.put(bankBic, x509Identity);

  console.log('Bank user registered and enrolled successfully');
  console.log(`org: ${config.key}`);
  console.log(`mspId: ${readArg('--mspId') || config.mspId}`);
  console.log(`bankBic: ${bankBic}`);
  console.log(`enrollmentId: ${enrollmentId}`);
  console.log(`walletPath: ${userWalletPath}`);
}

main().catch((error) => {
  console.error(`registerUser.js failed: ${error.message}`);
  process.exit(1);
});
