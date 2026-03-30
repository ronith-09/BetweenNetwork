const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/config/database');
const AdminApprovalService = require('../src/admin/services/admin-approval.service');
const WalletService = require('../src/blockchain/wallet/wallet.service');
const { OffChainStatuses } = require('../src/types/enums');

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function getRecoveryAdminContext() {
  const result = await db.query(
    `SELECT id, name FROM betweennetwork_admins ORDER BY created_at ASC LIMIT 1;`
  );

  const admin = result.rows[0];
  if (!admin) {
    throw new Error('No BetweenNetwork admin found in the database. Create an admin account before running recovery.');
  }

  const walletIdentity = await WalletService.getBetweenNetworkAdminIdentity(admin.name);
  return {
    adminId: admin.id,
    adminName: admin.name,
    walletIdentity
  };
}

function buildApprovalPayload(application) {
  const internalReviewMetadata = parseJson(application.internal_review_metadata);
  const activationRequest = internalReviewMetadata.activation_request || {};

  return {
    bank_id: application.bank_id,
    bic_swift_code: activationRequest.bic_swift_code || application.bic_swift_code,
    country_code: activationRequest.country_code || application.country_code,
    msp_id: activationRequest.msp_id || application.msp_id,
    supported_currencies: activationRequest.supported_currencies || [],
    settlement_model: activationRequest.settlement_model || null,
    public_key_hash: activationRequest.public_key_hash,
    certificate_thumbprint_hash: activationRequest.certificate_thumbprint_hash,
    enrollment_id: activationRequest.enrollment_id || application.bank_id,
    affiliation: activationRequest.affiliation || null,
    bank_password: activationRequest.bank_password || null,
    org_name: activationRequest.org_name || application.legal_entity_name || null,
    org_domain: activationRequest.org_domain || null,
    channel_name: activationRequest.channel_name || process.env.FABRIC_CHANNEL_NAME || 'betweennetwork',
    peer_port: null,
    operations_port: null,
    create_participant_identity: false,
    run_blockchain_org_onboarding: true
  };
}

function hasActivationMetadata(application) {
  const internalReviewMetadata = parseJson(application.internal_review_metadata);
  const activationRequest = internalReviewMetadata.activation_request || {};
  return Boolean(
    application.bank_id &&
    (activationRequest.msp_id || application.msp_id) &&
    activationRequest.public_key_hash &&
    activationRequest.certificate_thumbprint_hash &&
    (activationRequest.bic_swift_code || application.bic_swift_code) &&
    (activationRequest.country_code || application.country_code)
  );
}

function isPeerContainerRunning(application) {
  const internalReviewMetadata = parseJson(application.internal_review_metadata);
  const activationRequest = internalReviewMetadata.activation_request || {};
  const orgDomain = activationRequest.org_domain;

  if (!orgDomain || application.blockchain_onboarding_status !== 'COMPLETED') {
    return false;
  }

  const peerHost = `peer0.${String(orgDomain).trim().toLowerCase()}`;

  try {
    const output = execFileSync('docker', ['inspect', '-f', '{{.State.Running}}', peerHost], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();

    return output === 'true';
  } catch {
    return false;
  }
}

async function getRecoverableApplications() {
  const result = await db.query(
    `
      SELECT *
      FROM bank_applications
      WHERE status = ANY($1::text[])
      ORDER BY approved_at NULLS LAST, created_at ASC;
    `,
    [[OffChainStatuses.ACTIVE, OffChainStatuses.APPROVED_PENDING_ACTIVATION]]
  );

  return result.rows;
}

async function main() {
  const adminContext = await getRecoveryAdminContext();
  const applications = await getRecoverableApplications();

  console.log(`Found ${applications.length} approved application(s) eligible for recovery checks.`);

  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const application of applications) {
    if (!hasActivationMetadata(application)) {
      skipped += 1;
      console.warn(`Skipping ${application.bank_id || application.id}: missing activation metadata.`);
      continue;
    }

    if (process.env.FORCE_BANK_RECOVERY !== 'true' && isPeerContainerRunning(application)) {
      skipped += 1;
      console.log(`Skipping ${application.bank_id}: peer container is already running.`);
      continue;
    }

    const approvalPayload = buildApprovalPayload(application);

    try {
      const result = await AdminApprovalService.approveApplication(
        application.id,
        approvalPayload,
        adminContext
      );

      restored += 1;
      console.log(
        `Recovered ${application.bank_id}: status=${result.data.application.status}, ` +
        `onboarding=${result.data.orgOnboarding?.success === true ? 'ok' : 'skipped_or_failed'}`
      );
    } catch (error) {
      failed += 1;
      console.error(`Failed to recover ${application.bank_id}: ${error.message || error}`);
    }
  }

  console.log(`Recovery summary: restored=${restored}, skipped=${skipped}, failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end().catch(() => {});
  });
