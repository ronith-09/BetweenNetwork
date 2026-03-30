const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const BankApplicationRepository = require('../repositories/BankApplicationRepository');
const ParticipantWalletPackageService = require('./ParticipantWalletPackageService');
const WalletService = require('../blockchain/wallet/wallet.service');

class BankAuthService {
  static getSessionTtlHours() {
    return parseInt(process.env.BANK_SESSION_TTL_HOURS || '24', 10);
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Signup a new bank institution
   */
  static async signup(payload) {
    const { 
      bank_id, 
      legal_entity_name, 
      email, 
      password,
      registered_address,
      license_number,
      regulator_name
    } = payload;

    if (!bank_id || !email || !password) {
      throw { statusCode: 400, message: 'bank_id, email, and password are required' };
    }

    const existing = await BankApplicationRepository.getByBankId(bank_id.toUpperCase());
    if (existing) {
      throw { statusCode: 409, message: 'Bank ID already registered' };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const application = await BankApplicationRepository.create({
      bank_id: bank_id.toUpperCase(),
      legal_entity_name,
      registered_address,
      license_number,
      regulator_name,
      email,
      password_hash: passwordHash
    });

    return {
      success: true,
      data: {
        id: application.id,
        bank_id: application.bank_id,
        status: application.status
      },
      message: 'Bank signup successful. Application is pending admin approval.'
    };
  }

  /**
   * Bank Login
   */
  static async login(payload) {
    const { bank_id, password } = payload;

    if (!bank_id || !password) {
      throw { statusCode: 400, message: 'bank_id and password are required' };
    }

    const application = await BankApplicationRepository.getByBankId(bank_id.toUpperCase());
    if (!application || !application.password_hash) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const isValid = await bcrypt.compare(password, application.password_hash);
    if (!isValid) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    // Token generation logic (Session-based via DB or simple JWT)
    // For now, consistent with Admin, we just return the app info and mock a token
    const token = crypto.randomBytes(32).toString('hex');

    return {
      success: true,
      data: {
        token,
        bank: {
          id: application.id,
          bank_id: application.bank_id,
          legal_entity_name: application.legal_entity_name,
          status: application.status
        }
      },
      message: 'Bank login successful'
    };
  }

  static async getWalletPackage(bankId) {
    const normalizedBankId = String(bankId || '').trim().toUpperCase();
    let application = await BankApplicationRepository.getByBankId(normalizedBankId);

    if (!application) {
      throw { statusCode: 404, message: 'Bank application not found' };
    }

    let walletPackage = await ParticipantWalletPackageService.getEncryptedPackage(normalizedBankId);

    if (!walletPackage) {
      const activationRequest = application.internal_review_metadata?.activation_request || {};
      const identity = await WalletService.materializeParticipantIdentity(normalizedBankId, {
        orgDomain: activationRequest.org_domain || null,
        mspId: activationRequest.msp_id || null
      });

      if (identity) {
        const createdPackage = await ParticipantWalletPackageService.createEncryptedPackage({
          application,
          identity,
          approvalData: {
            ...activationRequest,
            bank_id: normalizedBankId
          },
          orgOnboarding: {
            success: true,
            onboarding: {
              domain: activationRequest.org_domain || null
            }
          }
        });

        if (createdPackage?.success) {
          application = await BankApplicationRepository.update(application.id, {
            wallet_delivery_status: 'GENERATED',
            internal_review_metadata: {
              ...(application.internal_review_metadata || {}),
              wallet_package: createdPackage.metadata
            }
          });
          walletPackage = await ParticipantWalletPackageService.getEncryptedPackage(normalizedBankId);
        }
      }
    }

    if (!walletPackage) {
      throw {
        statusCode: 404,
        message: `Encrypted wallet package is not available yet for ${normalizedBankId}`
      };
    }

    if (application.wallet_delivery_status !== 'GENERATED') {
      application = await BankApplicationRepository.update(application.id, {
        wallet_delivery_status: 'GENERATED',
        internal_review_metadata: {
          ...(application.internal_review_metadata || {}),
          wallet_package: {
            ...(application.internal_review_metadata?.wallet_package || {}),
            available: true,
            file_path: walletPackage.file_path,
            download_name: walletPackage.download_name,
            generated_at: walletPackage.generated_at,
            cipher: walletPackage.cipher,
            kdf: walletPackage.kdf,
            checksum_sha256: walletPackage.checksum_sha256
          }
        }
      });
    }

    return {
      success: true,
      data: {
        bank_id: normalizedBankId,
        wallet_delivery_status:
          application.wallet_delivery_status === 'GENERATED'
            ? application.wallet_delivery_status
            : 'GENERATED',
        wallet_package: walletPackage
      },
      message: 'Encrypted wallet package loaded successfully'
    };
  }
}

module.exports = BankAuthService;
