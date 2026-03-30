const AdminApprovalService = require('../services/admin-approval.service');

class AdminApprovalController {
  static async reviewApplication(req, res, next) {
    try {
      const result = await AdminApprovalService.reviewApplication(
        req.params.id,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async activateParticipantDirect(req, res, next) {
    try {
      const result = await AdminApprovalService.activateParticipantDirect(
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async approveApplication(req, res, next) {
    try {
      const result = await AdminApprovalService.approveApplication(
        req.params.id,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async onboardBlockchainOrganization(req, res, next) {
    try {
      const result = await AdminApprovalService.onboardBlockchainOrganization(
        req.params.id,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async rejectApplication(req, res, next) {
    try {
      const result = await AdminApprovalService.rejectApplication(
        req.params.id,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async suspendParticipant(req, res, next) {
    try {
      const result = await AdminApprovalService.suspendParticipant(
        req.params.bankId,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async revokeParticipant(req, res, next) {
    try {
      const result = await AdminApprovalService.revokeParticipant(
        req.params.bankId,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async reactivateParticipant(req, res, next) {
    try {
      const result = await AdminApprovalService.reactivateParticipant(
        req.params.bankId,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getChaincodeParticipant(req, res, next) {
    try {
      const result = await AdminApprovalService.getChaincodeParticipant(
        req.params.bankId,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getChaincodeParticipantByMSP(req, res, next) {
    try {
      const result = await AdminApprovalService.getChaincodeParticipantByMSP(
        req.params.mspId,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAllChaincodeParticipants(req, res, next) {
    try {
      const result = await AdminApprovalService.getAllChaincodeParticipants(
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const offset = parseInt(req.query.offset, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 50;
      const result = await AdminApprovalService.getAuditLogs(
        req.adminContext,
        { offset, limit }
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAllMintRequests(req, res, next) {
    try {
      const result = await AdminApprovalService.getAllMintRequests(req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getPendingMintRequests(req, res, next) {
    try {
      const result = await AdminApprovalService.getPendingMintRequests(req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getApprovedMintHistory(req, res, next) {
    try {
      const result = await AdminApprovalService.getApprovedMintHistory(req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getMintRequestById(req, res, next) {
    try {
      const result = await AdminApprovalService.getMintRequestById(req.params.requestId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async approveMintRequest(req, res, next) {
    try {
      const result = await AdminApprovalService.approveMintRequest(req.params.requestId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async rejectMintRequest(req, res, next) {
    try {
      const result = await AdminApprovalService.rejectMintRequest(
        req.params.requestId,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getAllSettlements(req, res, next) {
    try {
      const result = await AdminApprovalService.getAllSettlements(req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getSettlementById(req, res, next) {
    try {
      const result = await AdminApprovalService.getSettlementById(req.params.settlementId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getSettlementStatus(req, res, next) {
    try {
      const result = await AdminApprovalService.getSettlementStatus(req.params.settlementId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async approveSettlement(req, res, next) {
    try {
      const result = await AdminApprovalService.approveSettlement(req.params.settlementId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async rejectSettlement(req, res, next) {
    try {
      const result = await AdminApprovalService.rejectSettlement(
        req.params.settlementId,
        req.body,
        req.adminContext
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async executeSettlement(req, res, next) {
    try {
      const result = await AdminApprovalService.executeSettlement(req.params.settlementId, req.adminContext);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminApprovalController;
