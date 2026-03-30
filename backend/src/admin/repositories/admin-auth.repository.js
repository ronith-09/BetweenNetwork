const db = require('../../config/database');

class AdminAuthRepository {
  static async createAdmin({ name, passwordHash, mspId, walletLabel, walletPath }) {
    const query = `
      INSERT INTO betweennetwork_admins (
        name,
        password_hash,
        msp_id,
        wallet_label,
        wallet_path
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, msp_id, wallet_label, wallet_path, created_at, updated_at;
    `;

    const values = [name, passwordHash, mspId, walletLabel, walletPath];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findAdminByName(name) {
    const query = `
      SELECT id, name, password_hash, msp_id, wallet_label, wallet_path, created_at, updated_at
      FROM betweennetwork_admins
      WHERE name = $1;
    `;
    const result = await db.query(query, [name]);
    return result.rows[0];
  }

  static async findAdminById(id) {
    const query = `
      SELECT id, name, msp_id, wallet_label, wallet_path, created_at, updated_at
      FROM betweennetwork_admins
      WHERE id = $1;
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  static async updateAdmin({ id, passwordHash, mspId, walletLabel, walletPath }) {
    const query = `
      UPDATE betweennetwork_admins
      SET
        password_hash = $2,
        msp_id = $3,
        wallet_label = $4,
        wallet_path = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, name, msp_id, wallet_label, wallet_path, created_at, updated_at;
    `;

    const values = [id, passwordHash, mspId, walletLabel, walletPath];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async createSession({ adminId, tokenHash, expiresAt }) {
    const query = `
      INSERT INTO betweennetwork_admin_sessions (
        admin_id,
        token_hash,
        expires_at
      ) VALUES ($1, $2, $3)
      RETURNING id, admin_id, expires_at, created_at;
    `;
    const result = await db.query(query, [adminId, tokenHash, expiresAt]);
    return result.rows[0];
  }

  static async findSessionByTokenHash(tokenHash) {
    const query = `
      SELECT
        s.id AS session_id,
        s.admin_id,
        s.expires_at,
        a.id,
        a.name,
        a.msp_id,
        a.wallet_label,
        a.wallet_path,
        a.created_at,
        a.updated_at
      FROM betweennetwork_admin_sessions s
      INNER JOIN betweennetwork_admins a ON a.id = s.admin_id
      WHERE s.token_hash = $1
        AND s.expires_at > CURRENT_TIMESTAMP;
    `;
    const result = await db.query(query, [tokenHash]);
    return result.rows[0];
  }
}

module.exports = AdminAuthRepository;
