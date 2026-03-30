const BlockchainService = require('./BlockchainService');
const ParticipantService = require('./ParticipantService');
const AuditLogRepository = require('../repositories/AuditLogRepository');

class SettlementService {
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

  static normalizeSettlement(settlement = {}) {
    return {
      settlement_id: settlement.settlement_id || settlement.settlementId || null,
      from_bank: settlement.from_bank || settlement.fromBank || null,
      to_bank: settlement.to_bank || settlement.toBank || null,
      currency: settlement.currency || null,
      amount: typeof settlement.amount === 'number' ? settlement.amount : Number(settlement.amount || 0),
      reference: settlement.reference || null,
      purpose: settlement.purpose || null,
      status: settlement.status || null,
      created_at: settlement.created_at || settlement.createdAt || null,
      approved_at: settlement.approved_at || settlement.approvedAt || null,
      approved_by: settlement.approved_by || settlement.approvedBy || null,
      rejection_reason: settlement.rejection_reason || settlement.rejectionReason || null,
      completed_at: settlement.completed_at || settlement.completedAt || null,
      executed_by: settlement.executed_by || settlement.executedBy || null,
      execution_tx_id: settlement.execution_tx_id || settlement.executionTxId || null
    };
  }

  static normalizeInvestigation(payload = {}) {
    return {
      settlement_id: payload.settlement_id || payload.settlementId || null,
      current_status: payload.current_status || payload.currentStatus || null,
      stopped_at_step: payload.stopped_at_step || payload.stoppedAtStep || null,
      pending_with: payload.pending_with || payload.pendingWith || null,
      reason: payload.reason || null,
      action_history: payload.action_history || payload.actionHistory || [],
      last_updated_at: payload.last_updated_at || payload.lastUpdatedAt || null
    };
  }

  static async createSettlementRequest(payload, bankContext = {}) {
    const fromBank = String(payload.from_bank || payload.fromBank || '').trim().toUpperCase();
    const toBank = String(payload.to_bank || payload.toBank || '').trim().toUpperCase();
    const currency = String(payload.currency || '').trim().toUpperCase();
    const amount = Number(payload.amount);
    const reference = String(payload.reference || '').trim();
    const purpose = String(payload.purpose || '').trim();

    if (!fromBank || !toBank) {
      throw { statusCode: 400, message: 'from_bank and to_bank are required' };
    }
    if (!currency) {
      throw { statusCode: 400, message: 'currency is required' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw { statusCode: 400, message: 'amount must be greater than zero' };
    }

    await ParticipantService.assertWalletEligible(fromBank);
    await ParticipantService.assertWalletEligible(toBank);

    const [isValid, hasBalance, isDuplicate] = await Promise.all([
      BlockchainService.validateSettlement({
        fromBank,
        toBank,
        currency,
        amount: String(Math.trunc(amount))
      }, this.buildBankBlockchainContext(bankContext)),
      BlockchainService.hasSufficientBalance({
        bankId: fromBank,
        currency,
        amount: String(Math.trunc(amount))
      }, this.buildBankBlockchainContext(bankContext)),
      BlockchainService.checkDuplicateSettlement({
        fromBank,
        toBank,
        currency,
        amount: String(Math.trunc(amount)),
        reference
      }, this.buildBankBlockchainContext(bankContext))
    ]);

    if (!isValid.data) {
      throw { statusCode: 400, message: 'Settlement validation failed' };
    }
    if (!hasBalance.data) {
      throw { statusCode: 400, message: `Insufficient ${currency} balance for ${fromBank}` };
    }
    if (isDuplicate.data) {
      throw { statusCode: 409, message: `Duplicate settlement detected for reference ${reference}` };
    }

    const blockchain = await BlockchainService.createSettlementRequest({
      fromBank,
      toBank,
      currency,
      amount: String(Math.trunc(amount)),
      reference,
      purpose
    }, this.buildBankBlockchainContext(bankContext));

    const settlement = this.normalizeSettlement(blockchain.data);

    await AuditLogRepository.log({
      action: 'SETTLEMENT_REQUEST_CREATED',
      entity_type: 'SETTLEMENT',
      entity_id: settlement.settlement_id,
      admin_id: null,
      old_status: null,
      new_status: settlement.status,
      details: {
        from_bank: settlement.from_bank,
        to_bank: settlement.to_bank,
        currency: settlement.currency,
        amount: settlement.amount,
        txId: blockchain.txId
      }
    });

    return {
      success: true,
      data: settlement,
      blockchain,
      message: 'Settlement request created'
    };
  }

  static async getOwnSettlementHistory(bankId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const result = await BlockchainService.getOwnSettlementHistory(
      normalizedBankId,
      this.buildBankBlockchainContext(bankContext)
    );
    const settlements = Array.isArray(result.data)
      ? result.data.map((settlement) => this.normalizeSettlement(settlement))
      : [];

    return {
      success: true,
      data: settlements,
      count: settlements.length
    };
  }

  static async getSettlementById(settlementId, bankId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const history = await this.getOwnSettlementHistory(normalizedBankId, bankContext);
    const allowed = history.data.some((settlement) => settlement.settlement_id === settlementId);
    if (!allowed) {
      throw { statusCode: 404, message: 'Settlement not found for this bank' };
    }

    const result = await BlockchainService.getSettlementById(
      settlementId,
      this.buildBankBlockchainContext(bankContext)
    );

    return {
      success: true,
      data: this.normalizeSettlement(result.data)
    };
  }

  static async getSettlementStatus(settlementId, bankId = '', bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const history = await BlockchainService.getOwnSettlementHistory(
      normalizedBankId,
      this.buildBankBlockchainContext(bankContext)
    );
    const match = Array.isArray(history.data)
      ? history.data.find((settlement) => String(settlement.settlementId || settlement.settlement_id) === settlementId)
      : null;

    if (!match) {
      throw { statusCode: 404, message: 'Settlement not found for this bank' };
    }

    const result = await BlockchainService.getSettlementStatus(
      settlementId,
      this.buildBankBlockchainContext(bankContext)
    );

    return {
      success: true,
      data: {
        settlement_id: settlementId,
        status: result.data || match.status || null
      }
    };
  }

  static async investigateSettlement(settlementId, bankId, bankContext = {}) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    const history = await this.getOwnSettlementHistory(normalizedBankId, bankContext);
    const allowed = history.data.some((settlement) => settlement.settlement_id === settlementId);
    if (!allowed) {
      throw { statusCode: 404, message: 'Settlement not found for this bank' };
    }

    const result = await BlockchainService.investigateSettlement(
      settlementId,
      this.buildBankBlockchainContext(bankContext)
    );
    return {
      success: true,
      data: this.normalizeInvestigation(result.data)
    };
  }

  static async validateSettlement(payload, bankContext = {}) {
    const fromBank = String(payload.from_bank || payload.fromBank || '').trim().toUpperCase();
    const toBank = String(payload.to_bank || payload.toBank || '').trim().toUpperCase();
    const currency = String(payload.currency || '').trim().toUpperCase();
    const amount = Number(payload.amount);

    if (!fromBank || !toBank || !currency || !Number.isFinite(amount) || amount <= 0) {
      throw { statusCode: 400, message: 'from_bank, to_bank, currency and positive amount are required' };
    }

    const result = await BlockchainService.validateSettlement({
      fromBank,
      toBank,
      currency,
      amount: String(Math.trunc(amount))
    }, this.buildBankBlockchainContext(bankContext));

    return {
      success: true,
      data: {
        from_bank: fromBank,
        to_bank: toBank,
        currency,
        amount: Math.trunc(amount),
        valid: Boolean(result.data)
      }
    };
  }

  static async hasSufficientBalance(payload, bankContext = {}) {
    const bankId = String(payload.bank_id || payload.bankId || '').trim().toUpperCase();
    const currency = String(payload.currency || '').trim().toUpperCase();
    const amount = Number(payload.amount);

    if (!bankId || !currency || !Number.isFinite(amount) || amount <= 0) {
      throw { statusCode: 400, message: 'bank_id, currency and positive amount are required' };
    }

    const result = await BlockchainService.hasSufficientBalance({
      bankId,
      currency,
      amount: String(Math.trunc(amount))
    }, this.buildBankBlockchainContext(bankContext));

    return {
      success: true,
      data: {
        bank_id: bankId,
        currency,
        amount: Math.trunc(amount),
        sufficient: Boolean(result.data)
      }
    };
  }

  static async checkDuplicateSettlement(payload, bankContext = {}) {
    const fromBank = String(payload.from_bank || payload.fromBank || '').trim().toUpperCase();
    const toBank = String(payload.to_bank || payload.toBank || '').trim().toUpperCase();
    const currency = String(payload.currency || '').trim().toUpperCase();
    const amount = Number(payload.amount);
    const reference = String(payload.reference || '').trim();

    if (!fromBank || !toBank || !currency || !Number.isFinite(amount) || amount <= 0) {
      throw { statusCode: 400, message: 'from_bank, to_bank, currency and positive amount are required' };
    }

    const result = await BlockchainService.checkDuplicateSettlement({
      fromBank,
      toBank,
      currency,
      amount: String(Math.trunc(amount)),
      reference
    }, this.buildBankBlockchainContext(bankContext));

    return {
      success: true,
      data: {
        from_bank: fromBank,
        to_bank: toBank,
        currency,
        amount: Math.trunc(amount),
        reference,
        duplicate: Boolean(result.data)
      }
    };
  }
}

module.exports = SettlementService;
