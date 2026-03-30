const AdminAuthService = require('../services/admin-auth.service');

class AdminAuthController {
  static async signup(req, res, next) {
    try {
      const result = await AdminAuthService.signup(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await AdminAuthService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminAuthController;
