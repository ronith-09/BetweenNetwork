const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Participant Repository
 * Handles all database operations for on-chain participants
 */
class ParticipantRepository {
  /**
   * Create a new participant
   */
  static async create(data) {
    const id = uuidv4();
    const query = `
      INSERT INTO participants (
        id, bank_id, bank_display_name, bic_swift_code, country_code,
        msp_id, status, supported_currencies, settlement_model,
        public_key_hash, certificate_thumbprint_hash, joined_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;
    const values = [
      id,
      data.bank_id,
      data.bank_display_name,
      data.bic_swift_code,
      data.country_code,
      data.msp_id,
      data.status || 'ACTIVE',
      data.supported_currencies,
      data.settlement_model,
      data.public_key_hash,
      data.certificate_thumbprint_hash,
      data.joined_date || new Date()
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get participant by ID
   */
  static async getById(id) {
    const query = 'SELECT * FROM participants WHERE id = $1;';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get participant by bank_id
   */
  static async getByBankId(bankId) {
    const query = 'SELECT * FROM participants WHERE bank_id = $1;';
    const result = await db.query(query, [bankId]);
    return result.rows[0];
  }

  /**
   * Get participant by MSP ID
   */
  static async getByMspId(mspId) {
    const query = 'SELECT * FROM participants WHERE msp_id = $1;';
    const result = await db.query(query, [mspId]);
    return result.rows[0];
  }

  /**
   * Get all participants
   */
  static async getAll(offset = 0, limit = 20) {
    const query = `
      SELECT * FROM participants
      WHERE status != 'REVOKED'
      ORDER BY joined_date DESC
      OFFSET $1 LIMIT $2;
    `;
    const result = await db.query(query, [offset, limit]);
    return result.rows;
  }

  /**
   * Get active participants only
   */
  static async getActive(offset = 0, limit = 20) {
    const query = `
      SELECT * FROM participants
      WHERE status = 'ACTIVE'
      ORDER BY joined_date DESC
      OFFSET $1 LIMIT $2;
    `;
    const result = await db.query(query, [offset, limit]);
    return result.rows;
  }

  /**
   * Update participant status
   */
  static async updateStatus(bankId, newStatus) {
    const query = `
      UPDATE participants
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE bank_id = $2
      RETURNING *;
    `;
    const result = await db.query(query, [newStatus, bankId]);
    return result.rows[0];
  }

  /**
   * Update participant
   */
  static async update(id, data) {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const query = `
      UPDATE participants
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const values = [id, ...Object.values(data)];
    const result = await db.query(query, values);
    return result.rows[0];
  }
}

module.exports = ParticipantRepository;
