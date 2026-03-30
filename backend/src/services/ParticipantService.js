const ParticipantRepository = require('../repositories/ParticipantRepository');
const ParticipantRegistryService = require('../blockchain/services/participant-registry.service');
const { OnChainStatuses } = require('../types/enums');
const BlockchainService = require('./BlockchainService');

/**
 * Participant Service
 * Handles business logic for participant management and blockchain interactions
 */
class ParticipantService {
  static normalizeBankId(bankId) {
    return String(bankId || '').trim().toUpperCase();
  }

  static normalizeParticipantRecord(participant = {}) {
    return {
      bank_id: participant.bank_id || participant.bankId || null,
      bank_display_name: participant.bank_display_name || participant.bankDisplayName || null,
      bic_swift_code: participant.bic_swift_code || participant.bicSwiftCode || null,
      country_code: participant.country_code || participant.countryCode || null,
      msp_id: participant.msp_id || participant.mspId || null,
      status: participant.status || null,
      supported_currencies: participant.supported_currencies || participant.supportedCurrencies || null,
      settlement_model: participant.settlement_model || participant.settlementModel || null,
      public_key_hash: participant.public_key_hash || participant.publicKeyHash || null,
      certificate_thumbprint_hash: participant.certificate_thumbprint_hash || participant.certificateThumbprintHash || null,
      joined_date: participant.joined_date || participant.joinedDate || null,
      client_id: participant.client_id || participant.clientId || null,
      created_by: participant.created_by || participant.createdBy || null,
      last_modified_by: participant.last_modified_by || participant.lastModifiedBy || null,
      last_modified_date: participant.last_modified_date || participant.lastModifiedDate || null
    };
  }

  static withWalletEligibility(participant) {
    if (!participant) {
      return participant;
    }

    return {
      ...participant,
      wallet_enabled: participant.status === OnChainStatuses.ACTIVE
    };
  }

  static async activateParticipant(data, options = {}) {
    return ParticipantRegistryService.activateParticipant(data, options);
  }

  /**
   * Get participant by bank ID
   */
  static async getParticipantByBankId(bankId) {
    try {
      const normalizedBankId = this.normalizeBankId(bankId);
      let participant = null;

      try {
        const chaincodeResult = await BlockchainService.getParticipant(normalizedBankId);
        participant = chaincodeResult?.data ? this.normalizeParticipantRecord(chaincodeResult.data) : null;
      } catch (error) {
        participant = await ParticipantRepository.getByBankId(normalizedBankId);
      }

      if (!participant || !participant.bank_id) {
        throw {
          statusCode: 404,
          message: 'Participant not found'
        };
      }
      return {
        success: true,
        data: this.withWalletEligibility(participant)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all active participants
   */
  static async getAllParticipants(offset = 0, limit = 20) {
    try {
      let participants = [];

      try {
        const chaincodeResult = await BlockchainService.getAllParticipants();
        const allParticipants = Array.isArray(chaincodeResult.data)
          ? chaincodeResult.data.map((participant) => this.normalizeParticipantRecord(participant))
          : [];

        participants = allParticipants
          .filter((participant) => participant.status === OnChainStatuses.ACTIVE)
          .slice(offset, offset + limit);
      } catch (error) {
        participants = await ParticipantRepository.getActive(offset, limit);
      }

      return {
        success: true,
        data: participants.map((participant) => this.withWalletEligibility(participant)),
        count: participants.length
      };
    } catch (error) {
      throw error;
    }
  }

  static async getWalletEligibility(bankId) {
    const normalizedBankId = this.normalizeBankId(bankId);
    let participant = null;
    let walletEnabled = false;

    try {
      const [participantResult, activeResult] = await Promise.all([
        BlockchainService.getParticipant(normalizedBankId),
        BlockchainService.isParticipantActive(normalizedBankId)
      ]);

      participant = participantResult?.data
        ? this.normalizeParticipantRecord(participantResult.data)
        : null;
      walletEnabled = Boolean(activeResult?.data?.active);
    } catch (error) {
      participant = await ParticipantRepository.getByBankId(normalizedBankId);
      walletEnabled = participant?.status === OnChainStatuses.ACTIVE;
    }

    if (!participant) {
      return {
        success: true,
        data: {
          bank_id: normalizedBankId,
          wallet_enabled: false,
          reason: 'Organization is not activated in BetweenNetwork'
        }
      };
    }

    return {
      success: true,
      data: {
        bank_id: participant.bank_id,
        status: participant.status,
        wallet_enabled: walletEnabled,
        reason: walletEnabled
          ? 'Organization is ACTIVE in BetweenNetwork'
          : `Organization status is ${participant.status}; wallet access requires ACTIVE`
      }
    };
  }

  static async isParticipantActive(bankId) {
    const normalizedBankId = this.normalizeBankId(bankId);
    const result = await BlockchainService.isParticipantActive(normalizedBankId);

    return {
      success: true,
      data: {
        bank_id: normalizedBankId,
        active: Boolean(result?.data?.active)
      }
    };
  }

  static async requireActiveParticipant(bankId) {
    const normalizedBankId = this.normalizeBankId(bankId);
    const result = await BlockchainService.requireActiveParticipant(normalizedBankId);

    return {
      success: true,
      data: {
        bank_id: normalizedBankId,
        active: true
      },
      blockchain: result,
      message: `Participant ${normalizedBankId} is ACTIVE`
    };
  }

  static async getParticipantByMSP(mspId) {
    const normalizedMspId = String(mspId || '').trim();
    if (!normalizedMspId) {
      throw {
        statusCode: 400,
        message: 'mspId is required'
      };
    }

    const result = await BlockchainService.getParticipantByMSP(normalizedMspId);
    const participant = result?.data ? this.normalizeParticipantRecord(result.data) : null;

    if (!participant || !participant.bank_id) {
      throw {
        statusCode: 404,
        message: 'Participant not found'
      };
    }

    return {
      success: true,
      data: this.withWalletEligibility(participant)
    };
  }

  static async assertWalletEligible(bankId) {
    const normalizedBankId = this.normalizeBankId(bankId);
    let participant = null;
    let walletEnabled = false;

    try {
      const [participantResult, activeResult] = await Promise.all([
        BlockchainService.getParticipant(normalizedBankId),
        BlockchainService.isParticipantActive(normalizedBankId)
      ]);

      participant = participantResult?.data
        ? this.normalizeParticipantRecord(participantResult.data)
        : null;
      walletEnabled = Boolean(activeResult?.data?.active);
    } catch (error) {
      participant = await ParticipantRepository.getByBankId(normalizedBankId);
      walletEnabled = participant?.status === OnChainStatuses.ACTIVE;
    }

    if (!participant) {
      throw {
        statusCode: 403,
        message: `Wallet access denied: organization ${normalizedBankId} is not activated in BetweenNetwork`
      };
    }

    if (!walletEnabled) {
      throw {
        statusCode: 403,
        message: `Wallet access denied: organization ${normalizedBankId} status is ${participant.status || 'UNKNOWN'}; ACTIVE is required`
      };
    }

    return participant;
  }

  static async suspendParticipant(bankId, reason, adminId, options = {}) {
    return ParticipantRegistryService.suspendParticipant(bankId, reason, adminId, options);
  }

  static async revokeParticipant(bankId, reason, adminId, options = {}) {
    return ParticipantRegistryService.revokeParticipant(bankId, reason, adminId, options);
  }

  static async reactivateParticipant(bankId, reason, adminId, options = {}) {
    return ParticipantRegistryService.reactivateParticipant(bankId, reason, adminId, options);
  }
}

module.exports = ParticipantService;
