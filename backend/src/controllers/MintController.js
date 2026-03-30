const MintService = require('../services/MintService');

class MintController {
  static async createMintRequest(req, res, next) {
    try {
      const result = await MintService.createMintRequest(req.body, req.bankContext);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getOwnMintRequests(req, res, next) {
    try {
      const result = await MintService.getOwnMintRequests(req.params.bankId, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getOwnMintRequestById(req, res, next) {
    try {
      const result = await MintService.getOwnMintRequestById(
        req.params.bankId,
        req.params.requestId,
        req.bankContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getWallet(req, res, next) {
    try {
      const result = await MintService.getWallet(req.params.bankId, req.bankContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MintController;
