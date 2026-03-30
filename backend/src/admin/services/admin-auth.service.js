const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AdminAuthRepository = require('../repositories/admin-auth.repository');
const WalletService = require('../../blockchain/wallet/wallet.service');
const FabricCaEnrollmentService = require('../../blockchain/wallet/fabric-ca-enrollment.service');

class AdminAuthService {
  static isRecoverableAdminWalletError(error) {
    const message = String(error?.message || error || '');
    return (
      message.includes('ECONNREFUSED') ||
      message.includes('Calling enroll endpoint failed') ||
      message.includes('wallet identity') ||
      message.includes('not found')
    );
  }

  static getSessionTtlHours() {
    return parseInt(process.env.BETWEENNETWORK_SESSION_TTL_HOURS || '12', 10);
  }

  static normalizeName(name) {
    return String(name || '').trim();
  }

  static validateCredentials(name, password) {
    if (!name) {
      throw {
        statusCode: 400,
        message: 'name is required'
      };
    }

    if (!password || password.length < 6) {
      throw {
        statusCode: 400,
        message: 'password must be at least 6 characters'
      };
    }
  }

  static sanitizeAdmin(admin) {
    return {
      id: admin.id,
      name: admin.name,
      msp_id: admin.msp_id,
      wallet_label: admin.wallet_label,
      wallet_path: admin.wallet_path,
      created_at: admin.created_at,
      updated_at: admin.updated_at
    };
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  static async signup(payload) {
    const name = this.normalizeName(payload.name);
    const password = String(payload.password || '');
    this.validateCredentials(name, password);

    const existing = await AdminAuthRepository.findAdminByName(name);
    const passwordHash = await bcrypt.hash(password, 12);
    let walletIdentity = null;
    let walletWarning = null;

    try {
      walletIdentity = await FabricCaEnrollmentService.registerAndEnrollAdmin({
        username: name,
        password,
        org: 'between',
        mspId: payload.msp_id || process.env.BETWEENNETWORK_ADMIN_MSP_ID || null
      });
    } catch (error) {
      if (!this.isRecoverableAdminWalletError(error)) {
        throw error;
      }

      walletWarning =
        'Admin wallet was not enrolled because the Fabric CA is unavailable. Admin can still sign in, but blockchain actions will require wallet enrollment later.';
    }

    const mspId =
      walletIdentity?.mspId ||
      payload.msp_id ||
      process.env.BETWEENNETWORK_ADMIN_MSP_ID ||
      process.env.FABRIC_MSP_ID ||
      'BetweenMSP';
    const admin = existing
      ? await AdminAuthRepository.updateAdmin({
          id: existing.id,
          passwordHash,
          mspId,
          walletLabel: walletIdentity?.label || existing.wallet_label || `${name}-wallet`,
          walletPath: walletIdentity?.walletPath || existing.wallet_path || `wallets/${name}`
        })
      : await AdminAuthRepository.createAdmin({
          name,
          passwordHash,
          mspId,
          walletLabel: walletIdentity?.label || `${name}-wallet`,
          walletPath: walletIdentity?.walletPath || `wallets/${name}`
        });

    return {
      success: true,
      data: {
        admin: this.sanitizeAdmin(admin),
        wallet: walletIdentity,
        walletWarning
      },
      message: existing
        ? walletWarning
          ? 'BetweenNetwork admin updated. Wallet enrollment is pending.'
          : 'BetweenNetwork admin wallet reconnected successfully'
        : walletWarning
          ? 'BetweenNetwork admin registered. Wallet enrollment is pending.'
          : 'BetweenNetwork admin registered successfully'
    };
  }

  static async login(payload) {
    const name = this.normalizeName(payload.name);
    const password = String(payload.password || '');
    this.validateCredentials(name, password);

    const admin = await AdminAuthRepository.findAdminByName(name);
    if (!admin) {
      throw {
        statusCode: 401,
        message: 'Invalid name or password'
      };
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatches) {
      throw {
        statusCode: 401,
        message: 'Invalid name or password'
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.getSessionTtlHours() * 60 * 60 * 1000);
    await AdminAuthRepository.createSession({
      adminId: admin.id,
      tokenHash,
      expiresAt
    });

    let walletIdentity = null;
    let walletWarning = null;
    try {
      walletIdentity = await WalletService.getBetweenNetworkAdminIdentity(admin.name);
    } catch (error) {
      if (!this.isRecoverableAdminWalletError(error)) {
        throw error;
      }

      walletWarning =
        'Admin wallet identity is not enrolled yet. Blockchain actions will fail until wallet enrollment is completed.';
    }

    return {
      success: true,
      data: {
        token: rawToken,
        expires_at: expiresAt.toISOString(),
        admin: this.sanitizeAdmin(admin),
        wallet: walletIdentity,
        walletWarning
      },
      message: 'BetweenNetwork admin login successful'
    };
  }

  static async authenticateBearerToken(token) {
    if (!token) {
      throw {
        statusCode: 401,
        message: 'Unauthorized: Missing bearer token'
      };
    }

    const tokenHash = this.hashToken(token);
    const session = await AdminAuthRepository.findSessionByTokenHash(tokenHash);
    if (!session) {
      throw {
        statusCode: 401,
        message: 'Unauthorized: Invalid or expired token'
      };
    }

    let walletIdentity = null;
    try {
      walletIdentity = await WalletService.getBetweenNetworkAdminIdentity(session.name);
    } catch (error) {
      if (!this.isRecoverableAdminWalletError(error)) {
        throw error;
      }
    }

    return {
      adminId: session.id,
      adminName: session.name,
      role: 'BETWEENNETWORK_ADMIN',
      mspId: session.msp_id,
      walletIdentity
    };
  }
}

module.exports = AdminAuthService;
