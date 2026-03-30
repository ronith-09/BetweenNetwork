const ParticipantRepository = require('../../repositories/ParticipantRepository');
const AuditLogRepository = require('../../repositories/AuditLogRepository');
const { OnChainStatuses } = require('../../types/enums');

class ParticipantRegistryService {
  static normalizeParticipantPayload(data = {}) {
    return {
      ...data,
      bank_id: String(data.bank_id || '').trim().toUpperCase(),
      bic_swift_code: String(data.bic_swift_code || '').trim().toUpperCase(),
      country_code: String(data.country_code || '').trim().toUpperCase(),
      msp_id: String(data.msp_id || '').trim()
    };
  }

  static validateParticipantPayload(data = {}) {
    const requiredFields = ['bank_id', 'bank_display_name', 'bic_swift_code', 'country_code', 'msp_id'];

    for (const field of requiredFields) {
      if (!data[field]) {
        throw {
          statusCode: 400,
          message: `Missing required participant field: ${field}`
        };
      }
    }

    if (!/^[A-Z]{2}$/.test(data.country_code)) {
      throw {
        statusCode: 400,
        message: 'country_code must be a 2-letter ISO country code, for example IN or US'
      };
    }
  }

  static async activateParticipant(data, options = {}) {
    try {
      const normalizedData = this.normalizeParticipantPayload(data);
      this.validateParticipantPayload(normalizedData);

      let participant = await ParticipantRepository.getByBankId(normalizedData.bank_id);

      if (participant) {
        participant = await ParticipantRepository.update(participant.id, {
          status: OnChainStatuses.ACTIVE,
          bank_display_name: normalizedData.bank_display_name,
          bic_swift_code: normalizedData.bic_swift_code,
          country_code: normalizedData.country_code,
          msp_id: normalizedData.msp_id,
          supported_currencies: normalizedData.supported_currencies,
          settlement_model: normalizedData.settlement_model,
          public_key_hash: normalizedData.public_key_hash,
          certificate_thumbprint_hash: normalizedData.certificate_thumbprint_hash
        });
      } else {
        participant = await ParticipantRepository.create({
          ...normalizedData,
          status: OnChainStatuses.ACTIVE,
          joined_date: new Date()
        });
      }

      if (options.adminId) {
        await AuditLogRepository.log({
          action: 'PARTICIPANT_ACTIVATED',
          entity_type: 'PARTICIPANT',
          entity_id: normalizedData.bank_id,
          admin_id: options.adminId,
          old_status: null,
          new_status: OnChainStatuses.ACTIVE,
          details: { txId: options.txId || null }
        });
      }

      return {
        success: true,
        data: participant,
        message: 'Participant activated successfully'
      };
    } catch (error) {
      throw {
        statusCode: error.statusCode || 500,
        message: 'Failed to activate participant: ' + error.message
      };
    }
  }

  static async getParticipant(bankId) {
    const participant = await ParticipantRepository.getByBankId(bankId);
    if (!participant) {
      throw {
        statusCode: 404,
        message: 'Participant not found'
      };
    }

    return {
      success: true,
      data: participant
    };
  }

  static async updateParticipantStatus(bankId, status, action, reason, adminId, options = {}) {
    const participant = await ParticipantRepository.getByBankId(bankId);
    if (!participant) {
      throw {
        statusCode: 404,
        message: 'Participant not found'
      };
    }

    const updated = await ParticipantRepository.updateStatus(bankId, status);

    await AuditLogRepository.log({
      action,
      entity_type: 'PARTICIPANT',
      entity_id: bankId,
      admin_id: adminId,
      old_status: participant.status,
      new_status: status,
      details: {
        reason: reason || null,
        txId: options.txId || null
      }
    });

    return {
      success: true,
      data: updated,
      message: `Participant status updated to ${status}`
    };
  }

  static async suspendParticipant(bankId, reason, adminId, options = {}) {
    return this.updateParticipantStatus(
      bankId,
      OnChainStatuses.SUSPENDED,
      'PARTICIPANT_SUSPENDED',
      reason,
      adminId,
      options
    );
  }

  static async revokeParticipant(bankId, reason, adminId, options = {}) {
    return this.updateParticipantStatus(
      bankId,
      OnChainStatuses.REVOKED,
      'PARTICIPANT_REVOKED',
      reason,
      adminId,
      options
    );
  }

  static async reactivateParticipant(bankId, reason, adminId, options = {}) {
    return this.updateParticipantStatus(
      bankId,
      OnChainStatuses.ACTIVE,
      'PARTICIPANT_REACTIVATED',
      reason,
      adminId,
      options
    );
  }
}

module.exports = ParticipantRegistryService;
