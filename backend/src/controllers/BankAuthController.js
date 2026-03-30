const BankAuthService = require('../services/BankAuthService');

class BankAuthController {
  static async signup(req, res, next) {
    try {
      const result = await BankAuthService.signup(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await BankAuthService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async me(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: req.bankUser
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWalletPackage(req, res, next) {
    try {
      const result = await BankAuthService.getWalletPackage(req.bankUser.bank_id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BankAuthController;
