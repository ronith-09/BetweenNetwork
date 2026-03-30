const BlockchainService = require('./BlockchainService');
const ParticipantService = require('./ParticipantService');
const AuditLogRepository = require('../repositories/AuditLogRepository');

class MintService {
  static buildBankBlockchainContext(bankContext = {}) {
    const context = {};

    if (bankContext?.participantIdentity) {
      context.participantIdentity = bankContext.participantIdentity;
    }
    if (bankContext?.gatewayProfile) {
      context.gatewayProfile = bankContext.gatewayProfile;
    }
    if (bankContext?.connectionProfile) {
      context.connectionProfile = bankContext.connectionProfile;
    }

    return context;
  }

  static normalizeMintRequest(request = {}) {
    return {
      request_id: request.request_id || request.requestId || null,
      bank_id: request.bank_id || request.bankId || null,
      currency: request.currency || null,
      amount: typeof request.amount === 'number' ? request.amount : Number(request.amount || 0),
      reason: request.reason || null,
      status: request.status || null,
      requested_at: request.requested_at || request.requestedAt || null,
      reviewed_at: request.reviewed_at || request.reviewedAt || null,
      reviewed_by: request.reviewed_by || request.reviewedBy || null,
      rejection_reason: request.rejection_reason || request.rejectionReason || null,
      approval_tx_id: request.approval_tx_id || request.approvalTxId || null,
      wallet_snapshot_id: request.wallet_snapshot_id || request.walletSnapshotId || null
    };
  }

  static normalizeWallet(wallet = {}) {
    return {
      wallet_id: wallet.wallet_id || wallet.walletId || null,
      bank_id: wallet.bank_id || wallet.bankId || null,
      msp_id: wallet.msp_id || wallet.mspId || null,
      status: wallet.status || null,
      updated_at: wallet.updated_at || wallet.updatedAt || null,
      balances: Array.isArray(wallet.balances || wallet.Balances)
        ? (wallet.balances || wallet.Balances).map((balance) => ({
            currency: balance.currency || balance.Currency || null,
            balance: typeof balance.balance === 'number' ? balance.balance : Number(balance.balance || 0)
          }))
        : []
    };
  }

  static async createMintRequest(payload, bankContext = {}) {
    const bankId = String(payload.bank_id || payload.bankId || '').trim().toUpperCase();
    const currency = String(payload.currency || '').trim().toUpperCase();
    const amount = Number(payload.amount);
    const reason = String(payload.reason || '').trim();

    if (!bankId) {
      throw { statusCode: 400, message: 'bank_id is required' };
    }
    if (!currency) {
      throw { statusCode: 400, message: 'currency is required' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw { statusCode: 400, message: 'amount must be greater than zero' };
    }

    await ParticipantService.assertWalletEligible(bankId);

    const blockchain = await BlockchainService.createMintRequest({
      bankId,
      currency,
      amount: String(Math.trunc(amount)),
      reason
    }, this.buildBankBlockchainContext(bankContext));

    const request = this.normalizeMintRequest(blockchain.data);

    await AuditLogRepository.log({
      action: 'MINT_REQUEST_CREATED',
      entity_type: 'MINT_REQUEST',
      entity_id: request.request_id,
      admin_id: null,
      old_status: null,
      new_status: request.status,
      details: {
        bank_id: request.bank_id,
        currency: request.currency,
        amount: request.amount,
        txId: blockchain.txId
      }
    });

    return {
      success: true,
      data: request,
      blockchain,
      message: 'Mint request created'
    };
  }

  static async getOwnMintRequests(bankId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const result = await BlockchainService.getOwnMintRequests(
      normalizedBankId,
      this.buildBankBlockchainContext(bankContext)
    );
    return {
      success: true,
      data: Array.isArray(result.data) ? result.data.map((request) => this.normalizeMintRequest(request)) : [],
      count: Array.isArray(result.data) ? result.data.length : 0
    };
  }

  static async getOwnMintRequestById(bankId, requestId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const result = await BlockchainService.getOwnMintRequestById(
      normalizedBankId,
      requestId,
      this.buildBankBlockchainContext(bankContext)
    );
    return {
      success: true,
      data: this.normalizeMintRequest(result.data)
    };
  }

  static async getWallet(bankId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    await ParticipantService.assertWalletEligible(normalizedBankId);
    const result = await BlockchainService.getWallet(
      normalizedBankId,
      this.buildBankBlockchainContext(bankContext)
    );
    return {
      success: true,
      data: this.normalizeWallet(result.data)
    };
  }
}

module.exports = MintService;
