const BankApplicationRepository = require('../repositories/BankApplicationRepository');
const { OffChainStatuses } = require('../types/enums');

/**
 * Bank Application Service
 * Handles business logic for bank onboarding
 */
class BankApplicationService {
  static normalizeBankId(bankId) {
    return String(bankId || '').trim().toUpperCase();
  }

  static validateCreatePayload(data) {
    const bankId = this.normalizeBankId(data.bank_id);
    if (!bankId) {
      throw {
        statusCode: 400,
        message: 'bank_id is required'
      };
    }

    if (!String(data.legal_entity_name || '').trim()) {
      throw {
        statusCode: 400,
        message: 'legal_entity_name is required'
      };
    }

    if (!String(data.license_number || '').trim()) {
      throw {
        statusCode: 400,
        message: 'license_number is required'
      };
    }

    return {
      ...data,
      bank_id: bankId
    };
  }

  static buildActivationRequest(data = {}) {
    return {
      bic_swift_code: String(data.bic_swift_code || '').trim().toUpperCase() || null,
      country_code: String(data.country_code || '').trim().toUpperCase() || null,
      msp_id: String(data.msp_id || '').trim() || null,
      supported_currencies: Array.isArray(data.supported_currencies)
        ? data.supported_currencies
        : String(data.supported_currencies || '')
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
      settlement_model: String(data.settlement_model || '').trim() || null,
      public_key_hash: String(data.public_key_hash || '').trim() || null,
      certificate_thumbprint_hash: String(data.certificate_thumbprint_hash || '').trim() || null,
      enrollment_id: String(data.enrollment_id || '').trim() || null,
      affiliation: String(data.affiliation || '').trim() || null,
      bank_password: String(data.bank_password || '').trim() || null,
      org_name: String(data.org_name || '').trim() || null,
      org_domain: String(data.org_domain || '').trim().toLowerCase() || null,
      peer_port: data.peer_port ? Number(data.peer_port) : null,
      operations_port: data.operations_port ? Number(data.operations_port) : null,
      channel_name: String(data.channel_name || '').trim() || null
    };
  }

  static mergeMetadata(application, patch = {}) {
    return {
      ...(application.internal_review_metadata || {}),
      ...patch
    };
  }

  static canEditPrimaryApplication(status) {
    return status === OffChainStatuses.APPLIED;
  }

  static canEditActivationRequest(status) {
    return status === OffChainStatuses.UNDER_REVIEW;
  }

  /**
   * Create a new bank application
   */
  static async createApplication(data) {
    try {
      const payload = this.validateCreatePayload(data);

      const existing = await BankApplicationRepository.getByBankId(payload.bank_id);
      if (existing) {
        throw {
          statusCode: 409,
          message: `Bank application already exists for ${payload.bank_id}`
        };
      }

      const application = await BankApplicationRepository.create(payload);
      return {
        success: true,
        data: application,
        message: 'Bank application created successfully'
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }

      throw {
        statusCode: 500,
        message: 'Failed to create bank application: ' + error.message
      };
    }
  }

  /**
   * Get application by ID
   */
  static async getApplicationById(id) {
    try {
      const application = await BankApplicationRepository.getById(id);
      if (!application) {
        throw {
          statusCode: 404,
          message: 'Application not found'
        };
      }
      return {
        success: true,
        data: application
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update application
   */
  static async updateApplication(id, data) {
    try {
      const application = await BankApplicationRepository.getById(id);
      if (!application) {
        throw {
          statusCode: 404,
          message: 'Application not found'
        };
      }

      if (![OffChainStatuses.APPLIED, OffChainStatuses.UNDER_REVIEW].includes(application.status)) {
        throw {
          statusCode: 400,
          message: 'Application can only be updated in APPLIED or UNDER_REVIEW status'
        };
      }

      let payload = {};

      if (this.canEditPrimaryApplication(application.status)) {
        payload = {
          ...data
        };
      }

      if (data.activation_request) {
        if (!this.canEditActivationRequest(application.status)) {
          throw {
            statusCode: 400,
            message: 'Activation request can only be updated after the first application is submitted for review'
          };
        }

        payload.internal_review_metadata = this.mergeMetadata(application, {
          activation_request: this.buildActivationRequest(data.activation_request),
          activation_request_updated_at: new Date().toISOString()
        });
      }

      if (Object.keys(payload).length === 0) {
        throw {
          statusCode: 400,
          message: 'No valid fields supplied for update'
        };
      }

      const updated = await BankApplicationRepository.update(id, payload);
      return {
        success: true,
        data: updated,
        message: 'Application updated successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submit application for review
   */
  static async submitApplication(id, bankId) {
    try {
      const application = await BankApplicationRepository.getById(id);
      if (!application) {
        throw {
          statusCode: 404,
          message: 'Application not found'
        };
      }

      if (application.status !== OffChainStatuses.APPLIED) {
        throw {
          statusCode: 400,
          message: 'Only applications in APPLIED status can be submitted'
        };
      }

      // Validate required fields
      if (!application.legal_entity_name || !application.license_number) {
        throw {
          statusCode: 400,
          message: 'Missing required fields for submission'
        };
      }

      const normalizedBankId = this.normalizeBankId(bankId || application.bank_id);
      if (!normalizedBankId) {
        throw {
          statusCode: 400,
          message: 'bank_id is required for submission'
        };
      }

      const updated = await BankApplicationRepository.update(id, {
        bank_id: normalizedBankId,
        status: OffChainStatuses.UNDER_REVIEW
      });

      return {
        success: true,
        data: updated,
        message: 'Application submitted for review'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all applications
   */
  static async getAllApplications(offset = 0, limit = 20) {
    try {
      const applications = await BankApplicationRepository.getAll(offset, limit);
      return {
        success: true,
        data: applications
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = BankApplicationService;
