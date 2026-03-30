// DTOs for Bank Application APIs

/**
 * DTO for creating a new bank application (POST /banks/applications)
 */
class CreateBankApplicationDTO {
  constructor(data) {
    this.legal_entity_name = data.legal_entity_name;
    this.registered_address = data.registered_address;
    this.license_number = data.license_number;
    this.regulator_name = data.regulator_name;
    this.webhook_url = data.webhook_url;
    this.ip_allowlist = data.ip_allowlist;
  }
}

/**
 * DTO for updating a draft bank application (PATCH /banks/applications/:id)
 */
class UpdateBankApplicationDTO {
  constructor(data) {
    this.legal_entity_name = data.legal_entity_name;
    this.registered_address = data.registered_address;
    this.license_number = data.license_number;
    this.regulator_name = data.regulator_name;
    this.webhook_url = data.webhook_url;
    this.ip_allowlist = data.ip_allowlist;
  }
}

/**
 * DTO for submitting a bank application (POST /banks/applications/:id/submit)
 */
class SubmitBankApplicationDTO {
  constructor(data) {
    this.bank_id = data.bank_id;
  }
}

/**
 * DTO for admin review action (POST /banks/applications/:id/review)
 */
class ReviewBankApplicationDTO {
  constructor(data) {
    this.status = data.status; // UNDER_REVIEW
    this.risk_review_notes = data.risk_review_notes;
  }
}

/**
 * DTO for admin approval (POST /banks/applications/:id/approve)
 * This activates the bank on-chain
 */
class ApproveBankApplicationDTO {
  constructor(data) {
    this.bic_swift_code = data.bic_swift_code;
    this.country_code = data.country_code;
    this.msp_id = data.msp_id;
    this.supported_currencies = data.supported_currencies; // CSV or Array
    this.settlement_model = data.settlement_model;
    this.public_key_hash = data.public_key_hash;
    this.certificate_thumbprint_hash = data.certificate_thumbprint_hash;
  }
}

/**
 * DTO for admin rejection (POST /banks/applications/:id/reject)
 */
class RejectBankApplicationDTO {
  constructor(data) {
    this.rejection_reason = data.rejection_reason;
  }
}

/**
 * DTO for participant response (GET /participants/:bankId)
 */
class ParticipantResponseDTO {
  constructor(data) {
    this.id = data.id;
    this.bank_id = data.bank_id;
    this.bank_display_name = data.bank_display_name;
    this.bic_swift_code = data.bic_swift_code;
    this.country_code = data.country_code;
    this.msp_id = data.msp_id;
    this.status = data.status;
    this.supported_currencies = data.supported_currencies;
    this.settlement_model = data.settlement_model;
    this.joined_date = data.joined_date;
  }
}

/**
 * DTO for suspend participant action (POST /participants/:bankId/suspend)
 */
class SuspendParticipantDTO {
  constructor(data) {
    this.reason = data.reason;
  }
}

/**
 * DTO for revoke participant action (POST /participants/:bankId/revoke)
 */
class RevokeParticipantDTO {
  constructor(data) {
    this.reason = data.reason;
  }
}

/**
 * DTO for reactivate participant action (POST /participants/:bankId/reactivate)
 */
class ReactivateParticipantDTO {
  constructor(data) {
    this.reason = data.reason;
  }
}

module.exports = {
  CreateBankApplicationDTO,
  UpdateBankApplicationDTO,
  SubmitBankApplicationDTO,
  ReviewBankApplicationDTO,
  ApproveBankApplicationDTO,
  RejectBankApplicationDTO,
  ParticipantResponseDTO,
  SuspendParticipantDTO,
  RevokeParticipantDTO,
  ReactivateParticipantDTO
};
