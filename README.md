# BetweenNetwork - Bank Onboarding & Participant Activation System

A production-grade bank onboarding and participant activation system that separates off-chain onboarding workflows from on-chain trusted participant identity management.

## Architecture Overview

### Core Principle: Separation of Concerns

**Off-Chain (PostgreSQL + Node.js Backend)**
- Full bank onboarding application process
- Sensitive data storage (legal documents, compliance notes, etc.)
- Application workflow management (APPLIED → UNDER_REVIEW → REJECTED/APPROVED_PENDING_ACTIVATION)
- Admin review and approval workflows
- Audit logging

**On-Chain (Hyperledger Fabric Chaincode)**
- Trusted participant identity records
- Minimal required fields (bank ID, BIC, country, MSP ID, status)
- Status management (ACTIVE, SUSPENDED, REVOKED)
- Authorization-based governance (only BetweenNetworkMSP)
- Event-based settlement and transaction logic

## Project Structure

```
betweennetwork/
├── backend/                          # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/              # HTTP request handlers
│   │   │   ├── BankApplicationController.js
│   │   │   └── ParticipantController.js
│   │   ├── services/                 # Business logic layer
│   │   │   ├── BankApplicationService.js
│   │   │   ├── ParticipantService.js
│   │   │   └── BlockchainService.js
│   │   ├── repositories/             # Data access layer
│   │   │   ├── BankApplicationRepository.js
│   │   │   ├── ParticipantRepository.js
│   │   │   └── AuditLogRepository.js
│   │   ├── middleware/               # Express middleware
│   │   │   └── auth.js               # Admin authorization, error handling
│   │   ├── config/                   # Configuration files
│   │   │   └── database.js           # PostgreSQL connection pool
│   │   ├── dtos/                     # Data transfer objects (request/response)
│   │   │   └── index.js
│   │   ├── types/                    # TypeScript enums and types
│   │   │   └── enums.js
│   │   ├── routes/                   # Route definitions
│   │   │   └── index.js
│   │   ├── utils/                    # Utility functions
│   │   └── server.js                 # Express app initialization
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── migrations/
│       └── 001_create_tables.sql     # PostgreSQL schema
├── chaincode/
│   └── participant-chaincode/        # Hyperledger Fabric chaincode
│       ├── participant.go            # Main chaincode implementation
│       └── go.mod                    # Go module dependencies
├── frontend/                         # Frontend placeholder
├── SAMPLE_PAYLOADS.md               # API request/response examples
└── README.md                         # This file
```

## Database Schema

### Minimal Parameters (Off-Chain Focus)

#### `bank_applications` Table
Stores off-chain onboarding application data.

**Fields:**
- `id` (UUID, Primary Key)
- `bank_id` (VARCHAR, Unique) - Assigned after submission
- `legal_entity_name` (VARCHAR) - Registered company name
- `registered_address` (VARCHAR) - Physical address
- `license_number` (VARCHAR) - Regulatory license
- `regulator_name` (VARCHAR) - Regulatory authority
- `status` (VARCHAR) - APPLIED | UNDER_REVIEW | REJECTED | APPROVED_PENDING_ACTIVATION
- `bic_swift_code` (VARCHAR) - Bank SWIFT code
- `country_code` (VARCHAR) - ISO 3166 country code
- `msp_id` (VARCHAR) - Fabric MSP identifier
- `wallet_delivery_status` (VARCHAR) - Wallet key delivery progress
- `webhook_url` (VARCHAR) - Bank webhook endpoint
- `ip_allowlist` (VARCHAR) - Allowed IP ranges
- `risk_review_notes` (TEXT) - Admin compliance notes
- `internal_review_metadata` (JSONB) - Additional review data
- Timestamps: `applied_at`, `reviewed_at`, `approved_at`, `rejected_at`, `created_at`, `updated_at`

#### `participants` Table
Stores on-chain participant identity (mirrored from blockchain).

**Fields:**
- `id` (UUID, Primary Key)
- `bank_id` (VARCHAR, Unique)
- `bank_display_name` (VARCHAR)
- `bic_swift_code` (VARCHAR)
- `country_code` (VARCHAR)
- `msp_id` (VARCHAR, Unique)
- `status` (VARCHAR) - ACTIVE | SUSPENDED | REVOKED
- `supported_currencies` (VARCHAR) - CSV list
- `settlement_model` (VARCHAR) - Settlement approach
- `public_key_hash` (VARCHAR) - Public key hash
- `certificate_thumbprint_hash` (VARCHAR) - Certificate hash
- `joined_date` (TIMESTAMP)
- Timestamps: `created_at`, `updated_at`

#### `audit_logs` Table
Comprehensive logging of all admin actions.

**Fields:**
- `id` (UUID, Primary Key)
- `action` (VARCHAR) - Action name
- `entity_type` (VARCHAR) - BANK_APPLICATION | PARTICIPANT
- `entity_id` (VARCHAR) - Reference ID
- `admin_id` (VARCHAR) - Admin user ID
- `old_status` (VARCHAR) - Previous status
- `new_status` (VARCHAR) - New status
- `details` (JSONB) - Additional context
- `ip_address` (VARCHAR)
- `timestamp` (TIMESTAMP)

#### Supporting Tables
- `bank_contacts` - Multiple contacts per application
- `bank_documents` - Uploaded documents and compliance files
- `bank_review_notes` - Admin review comments

---

## API Endpoints

### Bank Application Onboarding

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/banks/applications` | Public | Create new application |
| GET | `/banks/applications` | Public | List all applications |
| GET | `/banks/applications/{id}` | Public | Get application details |
| PATCH | `/banks/applications/{id}` | Public | Update draft application |
| POST | `/banks/applications/{id}/submit` | Public | Submit for review |
| POST | `/banks/applications/{id}/review` | Admin Only | Mark as under review |
| POST | `/banks/applications/{id}/approve` | Admin Only | Approve & activate on-chain |
| POST | `/banks/applications/{id}/reject` | Admin Only | Reject application |

### Participant Management

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| GET | `/participants` | Public | List active participants |
| GET | `/participants/{bankId}` | Public | Get participant details |
| POST | `/participants/{bankId}/suspend` | Admin Only | Suspend participant |
| POST | `/participants/{bankId}/revoke` | Admin Only | Revoke participant |
| POST | `/participants/{bankId}/reactivate` | Admin Only | Reactivate participant |

---

## Admin Authorization

All admin-only endpoints require the `x-admin-api-key` header:

```bash
curl -X POST http://localhost:3000/banks/applications/{id}/approve \
  -H "x-admin-api-key: your_admin_key" \
  -H "x-admin-id: admin-user-001" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Chaincode Functions (Go)

### ActivateParticipant
Creates a new ACTIVE participant on-chain.

**Authorization:** Only BetweenNetworkMSP
**Parameters:** bankId, bankDisplayName, bicSwiftCode, countryCode, mspId, supportedCurrencies, settlementModel, publicKeyHash, certificateThumbprintHash, joinedDate
**Event:** `ParticipantActivated`

### GetParticipant
Retrieves a participant by bank ID.

**Parameters:** bankId
**Returns:** Participant object

### GetParticipantByMSP
Finds participant by MSP ID.

**Parameters:** mspId
**Returns:** Participant object

### SuspendParticipant
Changes participant status to SUSPENDED.

**Authorization:** Only BetweenNetworkMSP
**Parameters:** bankId, reason
**Event:** `ParticipantSuspended`

### RevokeParticipant
Changes participant status to REVOKED.

**Authorization:** Only BetweenNetworkMSP
**Parameters:** bankId, reason
**Event:** `ParticipantRevoked`

### ReactivateParticipant
Changes participant status from SUSPENDED/REVOKED back to ACTIVE.

**Authorization:** Only BetweenNetworkMSP
**Parameters:** bankId, reason
**Event:** `ParticipantReactivated`

### GetAllParticipants
Queries all participants from the ledger.

**Returns:** Array of Participant objects

---

## Bank Activation Workflow

### Step-by-Step Process

1. **Bank Applies** (User)
   - POST `/banks/applications` with legal entity details
   - Status: `APPLIED`

2. **Bank Submits** (User)
   - POST `/banks/applications/{id}/submit` with bank_id
   - Status: `UNDER_REVIEW`
   - Application ready for admin review

3. **Admin Reviews** (BetweenNetwork Admin)
   - POST `/banks/applications/{id}/review` with compliance notes
   - Internal due diligence completed

4. **Admin Approves & Activates** (BetweenNetwork Admin)
   - POST `/banks/applications/{id}/approve` with on-chain parameters
   - **Atomic Multi-Step:**
     - Validate required activation fields
     - Invoke `ActivateParticipant` chaincode
     - Confirm blockchain transaction
     - Create/update participant record in PostgreSQL
     - Update application status: `APPROVED_PENDING_ACTIVATION` → application completed
     - Create participant with status: `ACTIVE`
     - Write audit log with transaction ID
   - Status: Application `APPROVED_PENDING_ACTIVATION`, Participant `ACTIVE`

5. **Bank is Now Active**
   - Participant exists on-chain and off-chain
   - Can participate in network settlements
   - Subject to governance (suspend/revoke by admin)

---

## Governance Operations

### Suspend Participant
Admin can temporarily suspend an ACTIVE participant:
- POST `/participants/{bankId}/suspend`
- Blockchain: Invoke `SuspendParticipant`
- Database: Update status to `SUSPENDED`
- Cannot participate in transactions
- Can be reactivated

### Revoke Participant
Admin can permanently revoke a participant:
- POST `/participants/{bankId}/revoke`
- Blockchain: Invoke `RevokeParticipant`
- Database: Update status to `REVOKED`
- Removed from active participant list
- Cannot be reactivated (must go through new onboarding)

### Reactivate Participant
Admin can reactivate a SUSPENDED participant:
- POST `/participants/{bankId}/reactivate`
- Blockchain: Invoke `ReactivateParticipant`
- Database: Update status back to `ACTIVE`
- Restored to active participant list

---

## Setup Instructions

### 1. Database Setup

```bash
# Create PostgreSQL database
createdb betweennetwork

# Run migration
psql betweennetwork < database/migrations/001_create_tables.sql
```

### 2. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Install dependencies
npm install

# Start development server
npm run dev

# Or production
npm start
```

### 3. Chaincode Deployment

```bash
cd chaincode/participant-chaincode

# Download Go dependencies
go mod download

# Deploy using Fabric scripts
# (Refer to your test-network configuration)
```

---

## Sample Request/Response

See [SAMPLE_PAYLOADS.md](./SAMPLE_PAYLOADS.md) for complete API request and response examples for all endpoints.

---

## Error Handling

- **400 Bad Request:** Missing/invalid required fields
- **403 Forbidden:** Insufficient authorization (missing admin key)
- **404 Not Found:** Resource does not exist
- **500 Internal Server Error:** Database or blockchain operation failure

---

## Audit Trail

All admin actions are logged in `audit_logs` table:

- Application created, reviewed, approved, rejected
- Participant activated, suspended, revoked, reactivated
- Blockchain transaction IDs recorded
- Admin ID, timestamp, and contextual details captured

---

## Security Considerations

1. **Admin API Key:** Should be rotated regularly
2. **Database Credentials:** Use environment variables, never commit
3. **Blockchain MSP:** Only BetweenNetworkMSP can perform governance actions
4. **Sensitive Data:** Legal documents and compliance notes remain off-chain
5. **Audit Logging:** All state changes are immutably logged

---

## Future Enhancements

- [ ] JWT-based admin authentication
- [ ] Two-factor approval for critical actions
- [ ] Real-time webhook notifications
- [ ] Document management and archival
- [ ] Advanced compliance rule engine
- [ ] Participant tier levels (Gold, Silver, Bronze)
- [ ] Rate limiting and transaction quotas
- [ ] Multi-signature approval workflows

---

## License

Confidential - BetweenNetwork

---

## Support

Contact: engineering@betweennetwork.com
