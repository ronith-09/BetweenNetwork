'use strict';

const path = require('path');
const {
  buildCAClient,
  buildWallet,
  readArg,
  requireArg,
  resolveOrgConfig
} = require('./fabricIdentityUtils');

async function main() {
  const username = requireArg('--username', readArg('--user'));
  const password = requireArg('--password');
  const config = resolveOrgConfig({ org: readArg('--org') || 'between' });
  const walletPath = path.join(config.walletPath, username);
  const wallet = await buildWallet(walletPath);

  const existingIdentity = await wallet.get(username);
  if (existingIdentity) {
    console.log(`Admin identity "${username}" already exists in wallet: ${walletPath}`);
    return;
  }

  const caClient = buildCAClient(config);
  const enrollment = await caClient.enroll({
    enrollmentID: username,
    enrollmentSecret: password
  });

  const x509Identity = {
    credentials: {
      certificate: enrollment.certificate,
      privateKey: enrollment.key.toBytes()
    },
    mspId: config.mspId,
    type: 'X.509',
    version: 1
  };

  await wallet.put(username, x509Identity);

  console.log('Admin enrolled successfully');
  console.log(`org: ${config.key}`);
  console.log(`mspId: ${config.mspId}`);
  console.log(`walletPath: ${walletPath}`);
  console.log(`label: ${username}`);
}

main().catch((error) => {
  console.error(`adminEnroll.js failed: ${error.message}`);
  process.exit(1);
});
