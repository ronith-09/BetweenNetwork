const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Bank Application Repository
 * Handles all database operations for bank applications
 */
class BankApplicationRepository {
  /**
   * Create a new bank application
   */
  static async create(data) {
    const id = uuidv4();
    const query = `
      INSERT INTO bank_applications (
        id, bank_id, legal_entity_name, registered_address, license_number,
        regulator_name, webhook_url, ip_allowlist, status, email, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      id,
      data.bank_id,
      data.legal_entity_name,
      data.registered_address,
      data.license_number,
      data.regulator_name,
      data.webhook_url,
      data.ip_allowlist,
      'APPLIED',
      data.email,
      data.password_hash
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get bank application by ID
   */
  static async getById(id) {
    const query = 'SELECT * FROM bank_applications WHERE id = $1;';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get bank application by bank_id
   */
  static async getByBankId(bankId) {
    const query = 'SELECT * FROM bank_applications WHERE bank_id = $1;';
    const result = await db.query(query, [bankId]);
    return result.rows[0];
  }

  /**
   * Update bank application
   */
  static async update(id, data) {
    const entries = Object.entries(data);
    const values = [id];
    const jsonColumns = new Set(['internal_review_metadata', 'blockchain_org_metadata']);
    const setClause = entries
      .map(([key, value], index) => {
        values.push(jsonColumns.has(key) ? JSON.stringify(value) : value);
        const placeholder = `$${index + 2}`;
        return jsonColumns.has(key)
          ? `${key} = ${placeholder}::jsonb`
          : `${key} = ${placeholder}`;
      })
      .join(', ');
    
    const query = `
      UPDATE bank_applications
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *;
    `;
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all applications with pagination
   */
  static async getAll(offset = 0, limit = 20) {
    const query = `
      SELECT * FROM bank_applications
      ORDER BY created_at DESC
      OFFSET $1 LIMIT $2;
    `;
    const result = await db.query(query, [offset, limit]);
    return result.rows;
  }

  /**
   * Get applications by status
   */
  static async getByStatus(status, offset = 0, limit = 20) {
    const query = `
      SELECT * FROM bank_applications
      WHERE status = $1
      ORDER BY created_at DESC
      OFFSET $2 LIMIT $3;
    `;
    const result = await db.query(query, [status, offset, limit]);
    return result.rows;
  }

  /**
   * Update status
   */
  static async updateStatus(id, newStatus) {
    const query = `
      UPDATE bank_applications
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    const result = await db.query(query, [newStatus, id]);
    return result.rows[0];
  }
}

module.exports = BankApplicationRepository;
