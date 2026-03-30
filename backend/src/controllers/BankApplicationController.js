const BankApplicationService = require('../services/BankApplicationService');

/**
 * Bank Application Controller
 * Handles HTTP requests for bank onboarding
 */
class BankApplicationController {
  /**
   * POST /banks/applications
   * Create a new bank application
   */
  static async createApplication(req, res, next) {
    try {
      const result = await BankApplicationService.createApplication(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /banks/applications/:id
   * Get bank application by ID
   */
  static async getApplicationById(req, res, next) {
    try {
      const result = await BankApplicationService.getApplicationById(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /banks/applications/:id
   * Update bank application
   */
  static async updateApplication(req, res, next) {
    try {
      const result = await BankApplicationService.updateApplication(
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /banks/applications/:id/submit
   * Submit application for review
   */
  static async submitApplication(req, res, next) {
    try {
      const result = await BankApplicationService.submitApplication(
        req.params.id,
        req.body.bank_id
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /banks/applications
   * Get all applications
   */
  static async getAllApplications(req, res, next) {
    try {
      const offset = parseInt(req.query.offset) || 0;
      const limit = parseInt(req.query.limit) || 20;
      
      const result = await BankApplicationService.getAllApplications(offset, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BankApplicationController;
