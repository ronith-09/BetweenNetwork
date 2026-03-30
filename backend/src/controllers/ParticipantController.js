const ParticipantService = require('../services/ParticipantService');

/**
 * Participant Controller
 * Handles HTTP requests for participant management
 */
class ParticipantController {
  /**
   * GET /participants
   * Get all active participants
   */
  static async getAllParticipants(req, res, next) {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await ParticipantService.getAllParticipants(offset, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /participants/:bankId
   * Get participant by bank ID
   */
  static async getParticipantByBankId(req, res, next) {
    try {
      const result = await ParticipantService.getParticipantByBankId(
        req.params.bankId
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /participants/:bankId/wallet-eligibility
   * Check if a participant can access wallet features
   */
  static async getWalletEligibility(req, res, next) {
    try {
      const result = await ParticipantService.getWalletEligibility(req.params.bankId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async isParticipantActive(req, res, next) {
    try {
      const result = await ParticipantService.isParticipantActive(req.params.bankId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async requireActiveParticipant(req, res, next) {
    try {
      const result = await ParticipantService.requireActiveParticipant(req.params.bankId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getParticipantByMSP(req, res, next) {
    try {
      const result = await ParticipantService.getParticipantByMSP(req.params.mspId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

}

module.exports = ParticipantController;
