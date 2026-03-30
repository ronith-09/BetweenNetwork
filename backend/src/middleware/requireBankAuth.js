const BankApplicationRepository = require('../repositories/BankApplicationRepository');
const WalletService = require('../blockchain/wallet/wallet.service');
const ParticipantWalletPackageService = require('../services/ParticipantWalletPackageService');

/**
 * Lightweight bank auth guard.
 * Current login returns an opaque token without persistence, so we validate:
 * 1) Bearer token exists
 * 2) x-bank-id header exists and maps to a known bank application
 */
module.exports = async function requireBankAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing or invalid Authorization header'
      });
    }

    const bankId = String(req.headers['x-bank-id'] || '').trim().toUpperCase();
    if (!bankId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing x-bank-id header'
      });
    }

    const application = await BankApplicationRepository.getByBankId(bankId);
    if (!application) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Unknown bank_id'
      });
    }

    const scopedBankIds = [
      req.params.bankId,
      req.body && (req.body.bank_id || req.body.bankId),
      req.body && (req.body.from_bank || req.body.fromBank),
      req.query.bankId,
      req.query.bank_id
    ]
      .filter(Boolean)
      .map(value => String(value).trim().toUpperCase());

    if (scopedBankIds.some(value => value !== bankId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Bank scope does not match authenticated bank_id'
      });
    }

    req.bankUser = {
      id: application.id,
      bank_id: application.bank_id,
      legal_entity_name: application.legal_entity_name,
      status: application.status
    };

    const activationRequest = application.internal_review_metadata?.activation_request || {};
    const blockchainMetadata = application.blockchain_org_metadata || {};
    const resolvedOrgDomain = (
      activationRequest.org_domain ||
      blockchainMetadata?.onboarding?.domain ||
      blockchainMetadata?.request?.orgDomain ||
      null
    );
    const resolvedMspId = application.msp_id || activationRequest.msp_id || blockchainMetadata?.request?.mspId || null;
    const connectionProfileResult = await ParticipantWalletPackageService.resolveConnectionProfileJson(
      resolvedOrgDomain,
      resolvedMspId,
      blockchainMetadata || {}
    );

    req.bankContext = {
      bankId: application.bank_id,
      participantIdentity: await WalletService.getParticipantIdentity(application.bank_id),
      gatewayProfile: connectionProfileResult.path || null,
      connectionProfile: connectionProfileResult.profile || null
    };

    next();
  } catch (error) {
    next(error);
  }
};
