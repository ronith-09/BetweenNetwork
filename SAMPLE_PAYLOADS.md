# BetweenNetwork - Bank Onboarding System

Sample JSON payloads for API requests and responses.

## Bank Application APIs

### 1. Create Bank Application
**POST /banks/applications**

**Request:**
```json
{
  "legal_entity_name": "Global Finance Bank Ltd.",
  "registered_address": "123 Finance Street, London, UK",
  "license_number": "BK-2024-001",
  "regulator_name": "Financial Conduct Authority",
  "webhook_url": "https://bank.com/webhook",
  "ip_allowlist": "192.168.1.0/24,10.0.0.0/8"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "legal_entity_name": "Global Finance Bank Ltd.",
    "registered_address": "123 Finance Street, London, UK",
    "license_number": "BK-2024-001",
    "regulator_name": "Financial Conduct Authority",
    "status": "APPLIED",
    "webhook_url": "https://bank.com/webhook",
    "ip_allowlist": "192.168.1.0/24,10.0.0.0/8",
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z"
  },
  "message": "Bank application created successfully"
}
```

### 2. Get Bank Application
**GET /banks/applications/{id}**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bank_id": null,
    "legal_entity_name": "Global Finance Bank Ltd.",
    "registered_address": "123 Finance Street, London, UK",
    "license_number": "BK-2024-001",
    "regulator_name": "Financial Conduct Authority",
    "status": "APPLIED",
    "bic_swift_code": null,
    "country_code": null,
    "msp_id": null,
    "webhook_url": "https://bank.com/webhook",
    "ip_allowlist": "192.168.1.0/24,10.0.0.0/8",
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-03-20T10:00:00Z"
  }
}
```

### 3. Update Bank Application
**PATCH /banks/applications/{id}**

**Request:**
```json
{
  "legal_entity_name": "Global Finance Bank Ltd. - Updated",
  "webhook_url": "https://bank.com/webhook/updated"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "legal_entity_name": "Global Finance Bank Ltd. - Updated",
    "webhook_url": "https://bank.com/webhook/updated",
    "status": "APPLIED",
    "updated_at": "2026-03-20T10:05:00Z"
  },
  "message": "Application updated successfully"
}
```

### 4. Submit Bank Application
**POST /banks/applications/{id}/submit**

**Request:**
```json
{
  "bank_id": "GFBK001"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bank_id": "GFBK001",
    "status": "UNDER_REVIEW",
    "updated_at": "2026-03-20T10:10:00Z"
  },
  "message": "Application submitted for review"
}
```

### 5. Admin Review Application
**POST /banks/applications/{id}/review**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "status": "UNDER_REVIEW",
  "risk_review_notes": "Initial compliance check: Bank has valid license. Proceeding with KYC verification."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bank_id": "GFBK001",
    "status": "UNDER_REVIEW",
    "risk_review_notes": "Initial compliance check: Bank has valid license. Proceeding with KYC verification.",
    "reviewed_at": "2026-03-20T10:15:00Z"
  },
  "message": "Application reviewed"
}
```

### 6. Admin Approve Application
**POST /banks/applications/{id}/approve**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "bic_swift_code": "GFBLGB2L",
  "country_code": "GB",
  "msp_id": "GlobalFinanceBank",
  "supported_currencies": "USD,GBP,EUR,JPY",
  "settlement_model": "FULL_SETTLEMENT",
  "public_key_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "certificate_thumbprint_hash": "d4735fea8128e7b9861d1b97f7b96ef2d5d6c7b3e9f8a1b2c3d4e5f6a7b8c9d0"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "bank_id": "GFBK001",
      "legal_entity_name": "Global Finance Bank Ltd.",
      "status": "APPROVED_PENDING_ACTIVATION",
      "bic_swift_code": "GFBLGB2L",
      "country_code": "GB",
      "msp_id": "GlobalFinanceBank",
      "approved_at": "2026-03-20T10:20:00Z"
    },
    "blockchain": {
      "success": true,
      "txId": "tx_1711000400000",
      "message": "Participant activated on-chain",
      "response": {
        "bankId": "GFBK001",
        "bankDisplayName": "Global Finance Bank Ltd.",
        "bicSwiftCode": "GFBLGB2L",
        "countryCode": "GB",
        "mspId": "GlobalFinanceBank",
        "status": "ACTIVE",
        "supportedCurrencies": "USD,GBP,EUR,JPY",
        "settlementModel": "FULL_SETTLEMENT",
        "publicKeyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "certificateThumbprintHash": "d4735fea8128e7b9861d1b97f7b96ef2d5d6c7b3e9f8a1b2c3d4e5f6a7b8c9d0",
        "joinedDate": "2026-03-20T10:20:00Z"
      }
    }
  },
  "message": "Bank approved and activated successfully"
}
```

### 7. Admin Reject Application
**POST /banks/applications/{id}/reject**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "rejection_reason": "Failed compliance checks: Unable to verify regulatory status with FCA."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bank_id": "GFBK001",
    "status": "REJECTED",
    "rejected_at": "2026-03-20T10:25:00Z"
  },
  "message": "Application rejected"
}
```

---

## Participant APIs

### 1. Get All Participants
**GET /participants?offset=0&limit=20**

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "bank_id": "GFBK001",
      "bank_display_name": "Global Finance Bank Ltd.",
      "bic_swift_code": "GFBLGB2L",
      "country_code": "GB",
      "msp_id": "GlobalFinanceBank",
      "status": "ACTIVE",
      "supported_currencies": "USD,GBP,EUR,JPY",
      "settlement_model": "FULL_SETTLEMENT",
      "joined_date": "2026-03-20T10:20:00Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "bank_id": "INTBANK02",
      "bank_display_name": "International Bank Corporation",
      "bic_swift_code": "INTBDE33",
      "country_code": "DE",
      "msp_id": "InternationalBank",
      "status": "ACTIVE",
      "supported_currencies": "EUR,USD",
      "settlement_model": "PAYMENT_VS_PAYMENT",
      "joined_date": "2026-03-15T14:30:00Z"
    }
  ],
  "count": 2
}
```

### 2. Get Participant by Bank ID
**GET /participants/{bankId}**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "bank_id": "GFBK001",
    "bank_display_name": "Global Finance Bank Ltd.",
    "bic_swift_code": "GFBLGB2L",
    "country_code": "GB",
    "msp_id": "GlobalFinanceBank",
    "status": "ACTIVE",
    "supported_currencies": "USD,GBP,EUR,JPY",
    "settlement_model": "FULL_SETTLEMENT",
    "joined_date": "2026-03-20T10:20:00Z"
  }
}
```

### 3. Suspend Participant
**POST /participants/{bankId}/suspend**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "reason": "Regulatory compliance violation detected in audit"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "bank_id": "GFBK001",
    "status": "SUSPENDED",
    "updated_at": "2026-03-20T11:00:00Z"
  },
  "blockchain": {
    "success": true,
    "txId": "tx_1711003600000",
    "message": "Participant suspended on-chain"
  },
  "message": "Participant suspended"
}
```

### 4. Revoke Participant
**POST /participants/{bankId}/revoke**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "reason": "License revoked by regulatory authority"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "bank_id": "GFBK001",
    "status": "REVOKED",
    "updated_at": "2026-03-20T11:05:00Z"
  },
  "blockchain": {
    "success": true,
    "txId": "tx_1711003900000",
    "message": "Participant revoked on-chain"
  },
  "message": "Participant revoked"
}
```

### 5. Reactivate Participant
**POST /participants/{bankId}/reactivate**
*Requires: x-admin-api-key header*

**Request:**
```json
{
  "reason": "Compliance issue resolved. License reinstated by regulatory authority."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "bank_id": "GFBK001",
    "status": "ACTIVE",
    "updated_at": "2026-03-20T11:10:00Z"
  },
  "blockchain": {
    "success": true,
    "txId": "tx_1711004200000",
    "message": "Participant reactivated on-chain"
  },
  "message": "Participant reactivated"
}
```

---

## Error Responses

### 403 Forbidden (Missing Admin Authorization)
```json
{
  "success": false,
  "message": "Forbidden: Admin authorization required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Application not found"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required field for activation: bic_swift_code"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create bank application: Database connection error"
}
```

---

## Header Requirements

All admin-only endpoints require the following header:

```
x-admin-api-key: <your_admin_api_key>
x-admin-id: <admin_user_id> (optional, will default to 'admin-system')
```

Example using cURL:
```bash
curl -X POST http://localhost:3000/banks/applications/550e8400-e29b-41d4-a716-446655440000/approve \
  -H "x-admin-api-key: your_admin_api_key" \
  -H "x-admin-id: admin-user-001" \
  -H "Content-Type: application/json" \
  -d '{...request body...}'
```

