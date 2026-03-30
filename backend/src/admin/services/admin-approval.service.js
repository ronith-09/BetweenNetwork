const crypto = require('crypto');
const BankApplicationRepository = require('../../repositories/BankApplicationRepository');
const AuditLogRepository = require('../../repositories/AuditLogRepository');
const { OffChainStatuses } = require('../../types/enums');
const BlockchainService = require('../../blockchain/services/blockchain.service');
const ParticipantRegistryService = require('../../blockchain/services/participant-registry.service');
const WalletService = require('../../blockchain/wallet/wallet.service');
const EnrollmentService = require('../../blockchain/wallet/enrollment.service');
const IdentityStoreService = require('../../blockchain/wallet/identity-store.service');
const MintService = require('../../services/MintService');
const SettlementService = require('../../services/SettlementService');
const BlockchainOrgOnboardingService = require('../../services/BlockchainOrgOnboardingService');
const BankDockerRuntimeService = require('../../services/BankDockerRuntimeService');
const ParticipantWalletPackageService = require('../../services/ParticipantWalletPackageService');

class AdminApprovalService {
  static normalizeCountryCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  static resolveReusableCountryCode(onChainValue, fallbackValue) {
    const normalizedOnChain = this.normalizeCountryCode(onChainValue);
    if (/^[A-Z]{2}$/.test(normalizedOnChain)) {
      return normalizedOnChain;
    }

    return this.normalizeCountryCode(fallbackValue);
  }

  static isParticipantAlreadyExistsError(error) {
    const message = String(error?.message || error || '');
    return message.includes('already exists');
  }

  static normalizeOnChainParticipantData(participant = {}, fallbackPayload = {}) {
    return {
      bank_id: participant.bankId || fallbackPayload.bank_id,
      bank_display_name: participant.bankDisplayName || fallbackPayload.bank_display_name,
      bic_swift_code: participant.bicSwiftCode || fallbackPayload.bic_swift_code,
      country_code: this.resolveReusableCountryCode(
        participant.countryCode,
        fallbackPayload.country_code
      ),
      msp_id: participant.mspId || fallbackPayload.msp_id,
      supported_currencies: participant.supportedCurrencies || fallbackPayload.supported_currencies,
      settlement_model: participant.settlementModel || fallbackPayload.settlement_model,
      public_key_hash: participant.publicKeyHash || fallbackPayload.public_key_hash,
      certificate_thumbprint_hash:
        participant.certificateThumbprintHash || fallbackPayload.certificate_thumbprint_hash
    };
  }

  static isRecoverableIdentityEnrollmentError(error) {
    const message = String(error?.message || error || '');
    return (
      message.includes('ECONNREFUSED') ||
      message.includes('Calling enroll endpoint failed') ||
      message.includes('fabric-ca-client') ||
      message.includes('Unable to resolve organization for enrollment')
    );
  }

  static async getAdminWallet(adminContext) {
    return (
      adminContext.walletIdentity ||
      WalletService.getBetweenNetworkAdminIdentity(adminContext.adminName || adminContext.adminId)
    );
  }

  static assertAdminContext(adminContext) {
    if (!adminContext || !adminContext.adminId) {
      throw {
        statusCode: 403,
        message: 'BetweenNetwork admin authorization required'
      };
    }
  }

  static async getApplicationOrThrow(applicationId) {
    const application = await BankApplicationRepository.getById(applicationId);
    if (!application) {
      throw {
        statusCode: 404,
        message: 'Application not found'
      };
    }

    return application;
  }

  static validateApprovalPayload(payload) {
    const requiredFields = [
      'bic_swift_code',
      'country_code',
      'msp_id',
      'public_key_hash',
      'certificate_thumbprint_hash'
    ];

    for (const field of requiredFields) {
      if (!payload[field]) {
        throw {
          statusCode: 400,
          message: `Missing required field for activation: ${field}`
        };
      }
    }

    const normalizedCountryCode = String(payload.country_code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
      throw {
        statusCode: 400,
        message: 'country_code must be a 2-letter ISO country code, for example IN or US'
      };
    }
  }

  static getActivationRequest(application) {
    return application?.internal_review_metadata?.activation_request || {};
  }

  static resolveApprovalPayload(application, approvalData) {
    const activationRequest = this.getActivationRequest(application);
    return {
      bank_id: approvalData.bank_id || application.bank_id,
      bic_swift_code: approvalData.bic_swift_code || application.bic_swift_code || activationRequest.bic_swift_code,
      country_code: String(
        approvalData.country_code || application.country_code || activationRequest.country_code || ''
      ).trim().toUpperCase(),
      msp_id: approvalData.msp_id || application.msp_id || activationRequest.msp_id,
      supported_currencies: this.normalizeSupportedCurrencies(
        approvalData.supported_currencies || activationRequest.supported_currencies || []
      ),
      settlement_model: approvalData.settlement_model || activationRequest.settlement_model || null,
      public_key_hash: approvalData.public_key_hash || activationRequest.public_key_hash,
      certificate_thumbprint_hash:
        approvalData.certificate_thumbprint_hash || activationRequest.certificate_thumbprint_hash,
      enrollment_id: approvalData.enrollment_id || activationRequest.enrollment_id || application.bank_id,
      affiliation: approvalData.affiliation || activationRequest.affiliation || null,
      bank_password:
        approvalData.bank_password ||
        approvalData.password ||
        approvalData.enrollment_secret ||
        activationRequest.bank_password ||
        null,
      org_name: approvalData.org_name || activationRequest.org_name || null,
      org_domain: approvalData.org_domain || activationRequest.org_domain || null,
      peer_port: approvalData.peer_port || activationRequest.peer_port || null,
      operations_port: approvalData.operations_port || activationRequest.operations_port || null,
      channel_name: approvalData.channel_name || activationRequest.channel_name || null
    };
  }

  static deriveIdentityHashes(identity) {
    if (!identity?.certificate) {
      return {};
    }

    let publicKeyHash = null;
    try {
      const certificate = new crypto.X509Certificate(identity.certificate);
      const publicKeyPem = certificate.publicKey.export({ type: 'spki', format: 'pem' });
      publicKeyHash = crypto.createHash('sha256').update(String(publicKeyPem)).digest('hex');
    } catch (error) {
      publicKeyHash = crypto.createHash('sha256').update(String(identity.certificate)).digest('hex');
    }

    const certificateThumbprintHash = crypto
      .createHash('sha256')
      .update(String(identity.certificate))
      .digest('hex');

    return {
      public_key_hash: publicKeyHash,
      certificate_thumbprint_hash: certificateThumbprintHash
    };
  }

  static buildParticipantPayload(application, payload) {
    return {
      bank_id: application.bank_id || payload.bank_id,
      bank_display_name: application.legal_entity_name,
      bic_swift_code: payload.bic_swift_code,
      country_code: payload.country_code,
      msp_id: payload.msp_id,
      supported_currencies: payload.supported_currencies || [],
      settlement_model: payload.settlement_model || null,
      public_key_hash: payload.public_key_hash,
      certificate_thumbprint_hash: payload.certificate_thumbprint_hash
    };
  }

  static buildApprovalMetadata(application, payload) {
    return {
      ...(application.internal_review_metadata || {}),
      activation_request: {
        ...(application.internal_review_metadata?.activation_request || {}),
        bank_id: payload.bank_id,
        bic_swift_code: payload.bic_swift_code,
        country_code: payload.country_code,
        msp_id: payload.msp_id,
        supported_currencies: payload.supported_currencies || [],
        settlement_model: payload.settlement_model || null,
        public_key_hash: payload.public_key_hash,
        certificate_thumbprint_hash: payload.certificate_thumbprint_hash,
        enrollment_id: payload.enrollment_id || payload.bank_id,
        affiliation: payload.affiliation || null,
        bank_password: payload.bank_password || null,
        org_name: payload.org_name || null,
        org_domain: payload.org_domain || null,
        peer_port: payload.peer_port || null,
        operations_port: payload.operations_port || null,
        channel_name: payload.channel_name || null
      },
      activation_request_updated_at: new Date().toISOString()
    };
  }

  static buildWalletPackageMetadata(existingMetadata = {}, walletPackageResult, warning) {
    return {
      ...existingMetadata,
      wallet_package: walletPackageResult?.success
        ? walletPackageResult.metadata
        : {
            available: false,
            generated_at: null,
            warning: warning || walletPackageResult?.message || null
          }
    };
  }

  static normalizeSupportedCurrencies(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean);
    }

    return String(value || '')
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  static buildBlockchainOnboardingRequest(application, approvalData = {}, payload = {}) {
    const activationRequest = this.getActivationRequest(application);
    return {
      bank_id: payload.bank_id || approvalData.bank_id || application.bank_id,
      msp_id: payload.msp_id || approvalData.msp_id || application.msp_id || activationRequest.msp_id,
      org_name:
        approvalData.org_name ||
        approvalData.orgName ||
        activationRequest.org_name ||
        null,
      org_domain:
        approvalData.org_domain ||
        approvalData.domain ||
        activationRequest.org_domain ||
        null,
      peer_port:
        approvalData.peer_port ||
        approvalData.peerPort ||
        activationRequest.peer_port ||
        null,
      operations_port:
        approvalData.operations_port ||
        approvalData.operationsPort ||
        activationRequest.operations_port ||
        null,
      channel_name:
        approvalData.channel_name ||
        approvalData.channelName ||
        activationRequest.channel_name ||
        null
    };
  }

  static async reviewApplication(applicationId, reviewData, adminContext) {
    this.assertAdminContext(adminContext);

    const application = await this.getApplicationOrThrow(applicationId);
    const updated = await BankApplicationRepository.update(applicationId, {
      risk_review_notes: reviewData.risk_review_notes,
      reviewed_at: new Date()
    });

    await AuditLogRepository.log({
      action: 'APPLICATION_REVIEWED',
      entity_type: 'BANK_APPLICATION',
      entity_id: applicationId,
      admin_id: adminContext.adminId,
      old_status: application.status,
      new_status: updated.status,
      details: {
        notes: reviewData.risk_review_notes || null
      }
    });

    return {
      success: true,
      data: updated,
      message: 'Application reviewed'
    };
  }

  static async approveApplication(applicationId, approvalData, adminContext) {
    this.assertAdminContext(adminContext);

    const application = await this.getApplicationOrThrow(applicationId);
    let resolvedApprovalData = this.resolveApprovalPayload(application, approvalData);

    if (!resolvedApprovalData.bank_id) {
      throw {
        statusCode: 400,
        message: 'Application must contain bank_id before approval'
      };
    }

    let participantIdentity = null;
    let identityEnrollmentWarning = null;

    if (approvalData.create_participant_identity !== false) {
      try {
        participantIdentity = await EnrollmentService.ensureParticipantIdentity({
          bankId: resolvedApprovalData.bank_id,
          bankBic: resolvedApprovalData.bic_swift_code,
          mspId: resolvedApprovalData.msp_id,
          enrollmentId: resolvedApprovalData.enrollment_id || resolvedApprovalData.bank_id,
          enrollmentSecret:
            resolvedApprovalData.enrollment_secret ||
            resolvedApprovalData.password ||
            resolvedApprovalData.bank_password ||
            null,
          affiliation: resolvedApprovalData.affiliation || null,
          adminName: adminContext.adminName || null
        });
      } catch (error) {
        if (!this.isRecoverableIdentityEnrollmentError(error)) {
          throw error;
        }

        identityEnrollmentWarning =
          'Participant wallet identity was not generated because the Fabric CA is not reachable or not configured for this org.';
      }
    }

    resolvedApprovalData = {
      ...resolvedApprovalData,
      ...this.deriveIdentityHashes(participantIdentity)
    };

    this.validateApprovalPayload(resolvedApprovalData);
    const participantPayload = this.buildParticipantPayload(application, resolvedApprovalData);

    const adminWallet = await this.getAdminWallet(adminContext);

    let blockchainResult;
    let onChainParticipant = null;

    try {
      blockchainResult = await BlockchainService.activateParticipant({
        participant: participantPayload,
        adminIdentity: adminWallet
      });
    } catch (error) {
      if (!this.isParticipantAlreadyExistsError(error)) {
        throw error;
      }

      const existingParticipantResult = await BlockchainService.getParticipant(
        participantPayload.bank_id,
        { adminIdentity: adminWallet }
      );
      onChainParticipant = existingParticipantResult.data || null;

      blockchainResult = {
        success: true,
        txId: null,
        functionName: 'ActivateParticipant',
        args: [],
        payload: existingParticipantResult.payload || null,
        signer: adminWallet.label,
        channelName: existingParticipantResult.channelName,
        chaincodeName: existingParticipantResult.chaincodeName,
        reusedExistingParticipant: true
      };
    }

    const approvedApplication = await BankApplicationRepository.update(applicationId, {
      status: OffChainStatuses.ACTIVE,
      bic_swift_code: participantPayload.bic_swift_code,
      country_code: participantPayload.country_code,
      msp_id: participantPayload.msp_id,
      approved_at: new Date(),
      wallet_delivery_status: participantIdentity ? 'GENERATED' : 'PENDING',
      internal_review_metadata: this.buildApprovalMetadata(application, resolvedApprovalData)
    });

    const participantResult = await ParticipantRegistryService.activateParticipant(
      onChainParticipant
        ? this.normalizeOnChainParticipantData(onChainParticipant, participantPayload)
        : participantPayload,
      {
        txId: blockchainResult.txId,
        adminId: adminContext.adminId
      }
    );

    const onboardingRequest = this.buildBlockchainOnboardingRequest(
      approvedApplication,
      approvalData,
      participantPayload
    );
    let orgOnboarding = {
      success: false,
      skipped: approvalData.run_blockchain_org_onboarding === false,
      message: 'Blockchain org onboarding skipped'
    };
    let finalApplication = approvedApplication;

    if (approvalData.run_blockchain_org_onboarding !== false) {
      orgOnboarding = await BlockchainOrgOnboardingService.executeOnboarding(
        approvedApplication,
        adminContext,
        onboardingRequest
      );
      finalApplication = orgOnboarding.application;
    }

    const persistedIdentity =
      participantIdentity ||
      await WalletService.materializeParticipantIdentity(resolvedApprovalData.bank_id, {
        orgDomain:
          resolvedApprovalData.org_domain ||
          orgOnboarding?.onboarding?.domain ||
          null,
        mspId: resolvedApprovalData.msp_id || null
      }) ||
      await IdentityStoreService.loadIdentity(
        IdentityStoreService.getParticipantWalletPath(resolvedApprovalData.bank_id)
      );

    let walletPackage = null;
    let walletPackageWarning = null;

    try {
      walletPackage = await ParticipantWalletPackageService.createEncryptedPackage({
        application: finalApplication,
        identity: persistedIdentity,
        approvalData: resolvedApprovalData,
        orgOnboarding
      });

      if (!walletPackage?.success) {
        walletPackageWarning = walletPackage?.message || null;
      }
    } catch (error) {
      walletPackageWarning = `Encrypted wallet package generation failed: ${error.message}`;
    }

    const walletDeliveryStatus = walletPackage?.success
      ? 'GENERATED'
      : persistedIdentity
        ? 'FAILED'
        : 'PENDING';

    finalApplication = await BankApplicationRepository.update(finalApplication.id, {
      wallet_delivery_status: walletDeliveryStatus,
      internal_review_metadata: this.buildWalletPackageMetadata(
        finalApplication.internal_review_metadata || {},
        walletPackage,
        walletPackageWarning || identityEnrollmentWarning
      )
    });

    await AuditLogRepository.log({
      action: 'APPLICATION_APPROVED',
      entity_type: 'BANK_APPLICATION',
      entity_id: applicationId,
      admin_id: adminContext.adminId,
      old_status: application.status,
      new_status: finalApplication.status,
      details: {
        txId: blockchainResult.txId,
        walletPath: persistedIdentity ? persistedIdentity.walletPath : null,
        walletPackagePath: walletPackage?.success ? walletPackage.packagePath : null,
        chaincodeFunction: 'ActivateParticipant',
        reusedExistingParticipant: blockchainResult.reusedExistingParticipant === true,
        blockchainOrgOnboardingSuccess: orgOnboarding.success === true,
        identityEnrollmentWarning,
        walletPackageWarning
      }
    });

    return {
      success: true,
      data: {
        application: finalApplication,
        participant: participantResult.data,
        identity: persistedIdentity,
        walletPackage,
        blockchain: blockchainResult,
        orgOnboarding,
        identityEnrollmentWarning,
        walletPackageWarning
      },
      message: orgOnboarding.success === false && approvalData.run_blockchain_org_onboarding !== false
        ? 'Bank approved and activated. Blockchain org onboarding failed; use the retry endpoint after fixing the issue.'
        : walletPackageWarning
          ? 'Bank approved and activated. Wallet identity exists, but the encrypted delivery package still needs attention.'
        : identityEnrollmentWarning
          ? 'Bank approved and activated. Wallet identity generation was skipped because Fabric CA is unavailable.'
          : 'Bank approved and activated successfully'
    };
  }

  static async onboardBlockchainOrganization(applicationId, onboardingData, adminContext) {
    this.assertAdminContext(adminContext);

    const application = await this.getApplicationOrThrow(applicationId);
    if (![OffChainStatuses.APPROVED_PENDING_ACTIVATION, OffChainStatuses.ACTIVE].includes(application.status)) {
      throw {
        statusCode: 400,
        message: 'Application must be approved before blockchain org onboarding can run'
      };
    }

    const onboardingRequest = this.buildBlockchainOnboardingRequest(application, onboardingData);
    const orgOnboarding = await BlockchainOrgOnboardingService.executeOnboarding(
      application,
      adminContext,
      onboardingRequest
    );

    return {
      success: orgOnboarding.success,
      data: {
        application: orgOnboarding.application,
        orgOnboarding
      },
      message: orgOnboarding.success
        ? 'Blockchain organization onboarding completed'
        : 'Blockchain organization onboarding failed'
    };
  }

  static async rejectApplication(applicationId, rejectionData, adminContext) {
    this.assertAdminContext(adminContext);

    const application = await this.getApplicationOrThrow(applicationId);
    const updated = await BankApplicationRepository.update(applicationId, {
      status: OffChainStatuses.REJECTED,
      rejected_at: new Date()
    });

    await AuditLogRepository.log({
      action: 'APPLICATION_REJECTED',
      entity_type: 'BANK_APPLICATION',
      entity_id: applicationId,
      admin_id: adminContext.adminId,
      old_status: application.status,
      new_status: OffChainStatuses.REJECTED,
      details: {
        reason: rejectionData.rejection_reason || rejectionData.reason || null
      }
    });

    return {
      success: true,
      data: updated,
      message: 'Application rejected'
    };
  }

  static async activateParticipantDirect(payload, adminContext) {
    this.assertAdminContext(adminContext);

    const participantPayload = {
      bank_id: String(payload.bank_id || '').trim().toUpperCase(),
      bank_display_name: String(payload.bank_display_name || '').trim(),
      bic_swift_code: String(payload.bic_swift_code || '').trim().toUpperCase(),
      country_code: String(payload.country_code || '').trim().toUpperCase(),
      msp_id: String(payload.msp_id || '').trim(),
      supported_currencies: this.normalizeSupportedCurrencies(payload.supported_currencies),
      settlement_model: payload.settlement_model || null,
      public_key_hash: String(payload.public_key_hash || '').trim(),
      certificate_thumbprint_hash: String(payload.certificate_thumbprint_hash || '').trim()
    };

    if (!participantPayload.bank_id || !participantPayload.bank_display_name) {
      throw {
        statusCode: 400,
        message: 'bank_id and bank_display_name are required'
      };
    }

    this.validateApprovalPayload(participantPayload);

    const adminWallet = await this.getAdminWallet(adminContext);
    const blockchainResult = await BlockchainService.activateParticipant({
      participant: participantPayload,
      adminIdentity: adminWallet
    });
    const registryResult = await ParticipantRegistryService.activateParticipant(
      participantPayload,
      {
        txId: blockchainResult.txId,
        adminId: adminContext.adminId
      }
    );

    return {
      success: true,
      data: registryResult.data,
      blockchain: blockchainResult,
      message: 'Participant activated'
    };
  }

  static async suspendParticipant(bankId, payload, adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    const blockchainResult = await BlockchainService.suspendParticipant(bankId, {
      adminIdentity: adminWallet,
      reason: payload.reason || null
    });
    const registryResult = await ParticipantRegistryService.suspendParticipant(
      bankId,
      payload.reason,
      adminContext.adminId,
      { txId: blockchainResult.txId }
    );

    return {
      success: true,
      data: registryResult.data,
      blockchain: blockchainResult,
      message: 'Participant suspended'
    };
  }

  static async revokeParticipant(bankId, payload, adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    const blockchainResult = await BlockchainService.revokeParticipant(bankId, {
      adminIdentity: adminWallet,
      reason: payload.reason || null
    });
    const registryResult = await ParticipantRegistryService.revokeParticipant(
      bankId,
      payload.reason,
      adminContext.adminId,
      { txId: blockchainResult.txId }
    );
    let docker = null;
    let dockerWarning = null;

    try {
      docker = await BankDockerRuntimeService.reflectRevocation(bankId);
    } catch (error) {
      dockerWarning = error.message || String(error);
    }

    return {
      success: true,
      data: registryResult.data,
      blockchain: blockchainResult,
      docker,
      dockerWarning,
      message: dockerWarning
        ? 'Participant revoked, but Docker runtime cleanup needs attention'
        : 'Participant revoked'
    };
  }

  static async reactivateParticipant(bankId, payload, adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    const blockchainResult = await BlockchainService.reactivateParticipant(bankId, {
      adminIdentity: adminWallet,
      reason: payload.reason || null
    });
    const registryResult = await ParticipantRegistryService.reactivateParticipant(
      bankId,
      payload.reason,
      adminContext.adminId,
      { txId: blockchainResult.txId }
    );
    let docker = null;
    let dockerWarning = null;

    try {
      docker = await BankDockerRuntimeService.reflectReactivation(bankId);
    } catch (error) {
      dockerWarning = error.message || String(error);
    }

    return {
      success: true,
      data: registryResult.data,
      blockchain: blockchainResult,
      docker,
      dockerWarning,
      message: dockerWarning
        ? 'Participant reactivated, but Docker runtime restart needs attention'
        : 'Participant reactivated'
    };
  }

  static async getChaincodeParticipant(bankId, adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    return BlockchainService.getParticipant(bankId, { adminIdentity: adminWallet });
  }

  static async getChaincodeParticipantByMSP(mspId, adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    return BlockchainService.getParticipantByMSP(mspId, { adminIdentity: adminWallet });
  }

  static async getAllChaincodeParticipants(adminContext) {
    this.assertAdminContext(adminContext);

    const adminWallet = await this.getAdminWallet(adminContext);
    return BlockchainService.getAllParticipants({ adminIdentity: adminWallet });
  }

  static async getAllMintRequests(adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getAllMintRequests({ adminIdentity: adminWallet });

    return {
      success: true,
      data: Array.isArray(result.data) ? result.data.map((request) => MintService.normalizeMintRequest(request)) : [],
      count: Array.isArray(result.data) ? result.data.length : 0
    };
  }

  static async getPendingMintRequests(adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getPendingMintRequests({ adminIdentity: adminWallet });

    return {
      success: true,
      data: Array.isArray(result.data) ? result.data.map((request) => MintService.normalizeMintRequest(request)) : [],
      count: Array.isArray(result.data) ? result.data.length : 0
    };
  }

  static async getApprovedMintHistory(adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getApprovedMintHistory({ adminIdentity: adminWallet });

    return {
      success: true,
      data: Array.isArray(result.data) ? result.data.map((request) => MintService.normalizeMintRequest(request)) : [],
      count: Array.isArray(result.data) ? result.data.length : 0
    };
  }

  static async getMintRequestById(requestId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getMintRequestById(requestId, { adminIdentity: adminWallet });

    return {
      success: true,
      data: MintService.normalizeMintRequest(result.data)
    };
  }

  static async approveMintRequest(requestId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const before = await BlockchainService.getMintRequestById(requestId, { adminIdentity: adminWallet });
    const blockchain = await BlockchainService.approveMintRequest(requestId, { adminIdentity: adminWallet });
    const request = MintService.normalizeMintRequest(blockchain.data);

    await AuditLogRepository.log({
      action: 'MINT_REQUEST_APPROVED',
      entity_type: 'MINT_REQUEST',
      entity_id: request.request_id,
      admin_id: adminContext.adminId,
      old_status: before?.data?.status || 'PENDING',
      new_status: request.status,
      details: {
        bank_id: request.bank_id,
        currency: request.currency,
        amount: request.amount,
        txId: blockchain.txId,
        wallet_snapshot_id: request.wallet_snapshot_id
      }
    });

    return {
      success: true,
      data: request,
      blockchain,
      message: 'Mint request approved'
    };
  }

  static async rejectMintRequest(requestId, payload, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const before = await BlockchainService.getMintRequestById(requestId, { adminIdentity: adminWallet });
    const blockchain = await BlockchainService.rejectMintRequest(
      requestId,
      payload.rejection_reason || payload.reason || '',
      { adminIdentity: adminWallet }
    );
    const request = MintService.normalizeMintRequest(blockchain.data);

    await AuditLogRepository.log({
      action: 'MINT_REQUEST_REJECTED',
      entity_type: 'MINT_REQUEST',
      entity_id: request.request_id,
      admin_id: adminContext.adminId,
      old_status: before?.data?.status || 'PENDING',
      new_status: request.status,
      details: {
        bank_id: request.bank_id,
        currency: request.currency,
        amount: request.amount,
        txId: blockchain.txId,
        rejection_reason: request.rejection_reason
      }
    });

    return {
      success: true,
      data: request,
      blockchain,
      message: 'Mint request rejected'
    };
  }

  static async getAllSettlements(adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getAllSettlements({ adminIdentity: adminWallet });
    const settlements = Array.isArray(result.data)
      ? result.data.map((settlement) => SettlementService.normalizeSettlement(settlement))
      : [];

    return {
      success: true,
      data: settlements,
      count: settlements.length
    };
  }

  static async getSettlementById(settlementId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getSettlementById(settlementId, { adminIdentity: adminWallet });

    return {
      success: true,
      data: SettlementService.normalizeSettlement(result.data)
    };
  }

  static async getSettlementStatus(settlementId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const result = await BlockchainService.getSettlementStatus(settlementId, { adminIdentity: adminWallet });

    return {
      success: true,
      data: {
        settlement_id: settlementId,
        status: result.data
      }
    };
  }

  static async approveSettlement(settlementId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const before = await BlockchainService.getSettlementById(settlementId, { adminIdentity: adminWallet });
    const blockchain = await BlockchainService.approveSettlement(settlementId, { adminIdentity: adminWallet });
    const settlement = SettlementService.normalizeSettlement(blockchain.data);

    await AuditLogRepository.log({
      action: 'SETTLEMENT_APPROVED',
      entity_type: 'SETTLEMENT',
      entity_id: settlement.settlement_id,
      admin_id: adminContext.adminId,
      old_status: before?.data?.status || 'PENDING',
      new_status: settlement.status,
      details: {
        from_bank: settlement.from_bank,
        to_bank: settlement.to_bank,
        currency: settlement.currency,
        amount: settlement.amount,
        txId: blockchain.txId
      }
    });

    return {
      success: true,
      data: settlement,
      blockchain,
      message: 'Settlement approved'
    };
  }

  static async rejectSettlement(settlementId, payload, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const before = await BlockchainService.getSettlementById(settlementId, { adminIdentity: adminWallet });
    const blockchain = await BlockchainService.rejectSettlement(
      settlementId,
      payload.rejection_reason || payload.reason || '',
      { adminIdentity: adminWallet }
    );
    const settlement = SettlementService.normalizeSettlement(blockchain.data);

    await AuditLogRepository.log({
      action: 'SETTLEMENT_REJECTED',
      entity_type: 'SETTLEMENT',
      entity_id: settlement.settlement_id,
      admin_id: adminContext.adminId,
      old_status: before?.data?.status || 'PENDING',
      new_status: settlement.status,
      details: {
        from_bank: settlement.from_bank,
        to_bank: settlement.to_bank,
        currency: settlement.currency,
        amount: settlement.amount,
        txId: blockchain.txId,
        rejection_reason: settlement.rejection_reason
      }
    });

    return {
      success: true,
      data: settlement,
      blockchain,
      message: 'Settlement rejected'
    };
  }

  static async executeSettlement(settlementId, adminContext) {
    this.assertAdminContext(adminContext);
    const adminWallet = await this.getAdminWallet(adminContext);
    const before = await BlockchainService.getSettlementById(settlementId, { adminIdentity: adminWallet });
    const blockchain = await BlockchainService.executeSettlement(settlementId, { adminIdentity: adminWallet });
    const settlement = SettlementService.normalizeSettlement(blockchain.data);

    await AuditLogRepository.log({
      action: 'SETTLEMENT_COMPLETED',
      entity_type: 'SETTLEMENT',
      entity_id: settlement.settlement_id,
      admin_id: adminContext.adminId,
      old_status: before?.data?.status || 'APPROVED',
      new_status: settlement.status,
      details: {
        from_bank: settlement.from_bank,
        to_bank: settlement.to_bank,
        currency: settlement.currency,
        amount: settlement.amount,
        txId: blockchain.txId,
        execution_tx_id: settlement.execution_tx_id
      }
    });

    return {
      success: true,
      data: settlement,
      blockchain,
      message: 'Settlement executed'
    };
  }

  static async getAuditLogs(adminContext, options = {}) {
    this.assertAdminContext(adminContext);

    const offset = Number.isFinite(options.offset) ? options.offset : 0;
    const limit = Number.isFinite(options.limit) ? options.limit : 50;
    const logs = await AuditLogRepository.getAll(offset, limit);

    return {
      success: true,
      data: logs,
      count: logs.length
    };
  }
}

module.exports = AdminApprovalService;
