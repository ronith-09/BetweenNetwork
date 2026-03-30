# Dynamic Fabric Organization Onboarding

This project now supports onboarding a newly approved bank organization to an already running Fabric channel without bringing the network down and without recreating the channel.

## What This Adds

- Reusable dynamic organization onboarding script under:
  `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/onboard-bank-org.sh`
- Template-based org crypto/config/compose generation for new banks
- Live channel config update flow using `configtxlator` and `peer channel update`
- Peer startup and channel join for the new organization
- Backend onboarding status tracking for approved bank applications
- Admin API endpoint to retry or manually trigger blockchain org onboarding

## High-Level Flow

1. Bank application is submitted in the BetweenNetwork backend.
2. BetweenNetwork admin reviews and approves the application.
3. Existing chaincode-based participant activation still runs first.
4. Backend then triggers blockchain org onboarding using the dynamic onboarding service.
5. The onboarding script:
   - generates crypto/MSP for the new org
   - generates the org definition JSON
   - starts the new peer container
   - fetches the current channel config
   - merges the new org into the `Application` group
   - computes a config update
   - signs the update using currently active organizations from `dynamic-org/org-registry.json`
   - submits the channel config update to the orderer
   - fetches the existing channel block
   - joins the new peer to the existing channel
   - sets the new org anchor peer
   - generates connection profile JSON/YAML for the new org
6. Backend stores onboarding result and marks the application `ACTIVE` only after org onboarding succeeds.

## Backend Files Added or Updated

### 1. `backend/src/services/BlockchainOrgOnboardingService.js`
Why:
- Adds the backend service that invokes the reusable Fabric onboarding script
- Tracks onboarding state in the database
- Stores onboarding output metadata
- Logs success and failure to audit logs

### 2. `backend/src/admin/services/admin-approval.service.js`
Why:
- Hooks blockchain org onboarding into the approval flow
- Allows approval to trigger onboarding automatically
- Adds a separate retry/manual onboarding method for already approved applications

### 3. `backend/src/admin/controllers/admin-approval.controller.js`
Why:
- Exposes controller method for admin-triggered blockchain org onboarding

### 4. `backend/src/admin/routes/admin.routes.js`
Why:
- Adds:
  `POST /admin/applications/:id/onboard-blockchain-org`

### 5. `backend/src/server.js`
Why:
- Documents the new admin route in the route listing response

### 6. `backend/src/repositories/BankApplicationRepository.js`
Why:
- Adds support for persisting `blockchain_org_metadata` JSON in updates

### 7. `backend/src/services/BankApplicationService.js`
Why:
- Allows activation request metadata to store org onboarding fields such as:
  `org_name`
  `org_domain`
  `peer_port`
  `operations_port`
  `channel_name`

### 8. `backend/src/types/enums.js`
Why:
- Adds explicit blockchain onboarding status values:
  `NOT_STARTED`
  `IN_PROGRESS`
  `COMPLETED`
  `FAILED`

## Database Changes

### 9. `database/migrations/003_add_blockchain_onboarding_tracking.sql`
Why:
- Adds dedicated onboarding tracking columns to `bank_applications`
- Allows application status to move to `ACTIVE`
- Stores timestamps and error details for blockchain org onboarding

New columns:
- `blockchain_onboarding_status`
- `blockchain_onboarding_started_at`
- `blockchain_onboarding_completed_at`
- `blockchain_onboarding_failed_at`
- `blockchain_onboarding_last_error`
- `blockchain_org_metadata`

## Fabric Dynamic Onboarding Files Added

### 10. `test-network/dynamic-org/onboard-bank-org.sh`
Why:
- Main reusable script for adding a new organization to a running channel
- Reuses Hyperledger Fabric best practice:
  live config fetch, config merge, config update, peer join, anchor peer update
- Avoids network teardown and channel recreation

### 11. `test-network/dynamic-org/org-registry.json`
Why:
- Tracks active orgs that can sign future channel config updates
- Seeded with current organizations:
  `Between`
  `Bank1`
  `Bank2`
  `BankD`

### 12. `test-network/dynamic-org/templates/*`
Why:
- Template-based generation for:
  org configtx definition
  cryptogen config
  peer docker compose
  docker overlay compose
  connection profile JSON
  connection profile YAML

### 13. `test-network/dynamic-org/.gitignore`
Why:
- Prevents generated onboarding artifacts from being committed accidentally

## API Usage

### Approve and auto-onboard

Use the existing approval endpoint. Unless explicitly disabled, it now also triggers blockchain org onboarding.

Example:

```bash
curl -X POST http://localhost:3000/admin/applications/<APPLICATION_ID>/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{
    "bank_id": "BANKC",
    "bic_swift_code": "BANKCINBBXXX",
    "country_code": "IN",
    "msp_id": "BankCMSP",
    "supported_currencies": ["USD", "INR"],
    "settlement_model": "FULL_SETTLEMENT",
    "public_key_hash": "placeholder-public-key-hash",
    "certificate_thumbprint_hash": "placeholder-cert-thumbprint-hash",
    "org_name": "BankC",
    "org_domain": "bankc.example.com",
    "peer_port": 13051,
    "operations_port": 9449
  }'
```

### Retry onboarding for an already approved bank

```bash
curl -X POST http://localhost:3000/admin/applications/<APPLICATION_ID>/onboard-blockchain-org \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -d '{
    "msp_id": "BankCMSP",
    "org_name": "BankC",
    "org_domain": "bankc.example.com",
    "peer_port": 13051,
    "operations_port": 9449
  }'
```

## Direct Script Test Command

This command tests onboarding a new org like `BankC` directly against the running channel:

```bash
cd /home/ronithpatel/fabric/fabric-samples/test-network
./dynamic-org/onboard-bank-org.sh \
  --channel betweennetwork \
  --bank-id BANKC \
  --org-name BankC \
  --msp-id BankCMSP \
  --domain bankc.example.com \
  --peer-port 13051 \
  --operations-port 9449
```

## Manual Prerequisites

These items still need to be present on the machine:

- `cryptogen`
- `configtxgen`
- `configtxlator`
- `jq`
- Docker / Docker Compose
- Running Fabric network and existing running channel
- Existing active org admin MSP material for the orgs that will sign the update
- Database migration `003_add_blockchain_onboarding_tracking.sql` applied before using backend onboarding status tracking

## Important Constraints Preserved

- No network shutdown is required for new org onboarding
- No channel recreation is performed
- Existing startup/genesis flow is not reused for dynamic onboarding
- Existing orgs remain untouched
- Only approved banks should proceed into blockchain org onboarding
