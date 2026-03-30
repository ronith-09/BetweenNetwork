const SettlementService = require('../services/SettlementService');

class SettlementController {
  static async createSettlementRequest(req, res, next) {
    try {
      const result = await SettlementService.createSettlementRequest(req.body, req.bankContext);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getOwnSettlementHistory(req, res, next) {
    try {
      const result = await SettlementService.getOwnSettlementHistory(req.params.bankId, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getSettlementStatus(req, res, next) {
    try {
      const result = await SettlementService.getSettlementStatus(
        req.params.settlementId,
        req.params.bankId,
        req.bankContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getSettlementById(req, res, next) {
    try {
      const result = await SettlementService.getSettlementById(
        req.params.settlementId,
        req.params.bankId,
        req.bankContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async investigateSettlement(req, res, next) {
    try {
      const result = await SettlementService.investigateSettlement(
        req.params.settlementId,
        req.params.bankId,
        req.bankContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async validateSettlement(req, res, next) {
    try {
      const result = await SettlementService.validateSettlement(req.body, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async hasSufficientBalance(req, res, next) {
    try {
      const payload = {
        ...req.body,
        bank_id: req.params.bankId || req.body.bank_id || req.body.bankId
      };
      const result = await SettlementService.hasSufficientBalance(payload, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async checkDuplicateSettlement(req, res, next) {
    try {
      const result = await SettlementService.checkDuplicateSettlement(req.body, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SettlementController;
