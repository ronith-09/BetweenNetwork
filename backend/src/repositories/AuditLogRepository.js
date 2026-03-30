const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Audit Log Repository
 * Handles logging of all admin actions and status changes
 */
class AuditLogRepository {
  /**
   * Create an audit log entry
   */
  static async log(data) {
    const id = uuidv4();
    const query = `
      INSERT INTO audit_logs (
        id, action, entity_type, entity_id, admin_id,
        old_status, new_status, details, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      id,
      data.action,
      data.entity_type,
      data.entity_id,
      data.admin_id,
      data.old_status || null,
      data.new_status || null,
      data.details ? JSON.stringify(data.details) : null,
      data.ip_address || null
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get audit logs for an entity
   */
  static async getByEntity(entityType, entityId, limit = 50) {
    const query = `
      SELECT * FROM audit_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY timestamp DESC
      LIMIT $3;
    `;
    const result = await db.query(query, [entityType, entityId, limit]);
    return result.rows;
  }

  /**
   * Get audit logs for a specific action
   */
  static async getByAction(action, limit = 50) {
    const query = `
      SELECT * FROM audit_logs
      WHERE action = $1
      ORDER BY timestamp DESC
      LIMIT $2;
    `;
    const result = await db.query(query, [action, limit]);
    return result.rows;
  }

  /**
   * Get all audit logs with pagination
   */
  static async getAll(offset = 0, limit = 50) {
    const query = `
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      OFFSET $1 LIMIT $2;
    `;
    const result = await db.query(query, [offset, limit]);
    return result.rows;
  }
}

module.exports = AuditLogRepository;
