# Dynamic Organization Onboarding Edits

This document explains:
- which files were added or edited
- why each file was changed
- the file paths
- the step-by-step onboarding flow

The goal of these changes is to allow a **new approved bank organization** to be added to an **already running Hyperledger Fabric channel** without bringing the network down and without recreating the channel.

---

## 1. Fabric Dynamic Onboarding Script

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/onboard-bank-org.sh`

**Why this file was added:**
- To add a new bank org to an already running channel
- To follow Fabric best practice using a channel config update
- To avoid `network down` and avoid channel recreation

**What this file does step by step:**
1. Generates crypto/MSP for the new org
2. Generates org definition JSON
3. Starts the new peer container
4. Fetches current channel config
5. Merges the new org into the channel `Application` group
6. Computes channel config update
7. Collects signatures from existing orgs
8. Submits update to orderer
9. Fetches the current channel block
10. Joins the new peer to the existing channel
11. Sets anchor peer for the new org
12. Generates connection profile JSON/YAML
13. Updates local org registry

---

## 2. Dynamic Org Registry

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/org-registry.json`

**Why this file was added:**
- To keep track of currently active organizations
- To know which existing orgs should sign future channel config updates
- To store peer host, MSP ID, domain, and ports for onboarded orgs

---

## 3. Org Definition Template

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/configtx-org-template.yaml`

**Why this file was added:**
- To generate the new org definition used by `configtxgen -printOrg`
- To avoid hard-coding one org like `Org3`
- To make the onboarding logic reusable for `BankC`, `BankD`, or future banks

---

## 4. Crypto Template

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/crypto-config-template.yaml`

**Why this file was added:**
- To generate the cryptogen config for any new bank org
- To create MSP and peer crypto material dynamically

---

## 5. Peer Compose Template

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/compose-org-template.yaml`

**Why this file was added:**
- To start a new peer container for the newly onboarded bank org
- To avoid editing the main startup compose file for every new org
- To support peer startup after approval only

---

## 6. Docker Overlay Compose Template

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/docker-compose-org-template.yaml`

**Why this file was added:**
- To inject Docker socket settings required for chaincode builds
- To make the new peer behave like existing Docker-backed peers

---

## 7. Connection Profile Templates

**File paths:**
- `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/connection-profile-template.json`
- `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/templates/connection-profile-template.yaml`

**Why these files were added:**
- To generate connection profiles for the newly onboarded org
- To make the new bank able to connect to the Fabric network using standard profile files

---

## 8. Dynamic Org Generated Files Ignore

**File path:** `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/.gitignore`

**Why this file was added:**
- To avoid committing generated onboarding files accidentally

---

## 9. Backend Blockchain Org Onboarding Service

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/services/BlockchainOrgOnboardingService.js`

**Why this file was added:**
- To let the backend call the Fabric onboarding script after approval
- To separate blockchain org onboarding from simple application approval
- To store onboarding success/failure state in the database
- To keep onboarding logic in a dedicated service

**What this service does:**
1. Builds the onboarding request from application/admin data
2. Marks onboarding as `IN_PROGRESS`
3. Runs the shell script
4. Parses onboarding result JSON
5. Stores success/failure in DB
6. Writes audit logs

---

## 10. Admin Approval Service

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/admin/services/admin-approval.service.js`

**Why this file was edited:**
- To trigger blockchain org onboarding after admin approval
- To keep approval flow under BetweenNetwork admin control
- To add a separate manual/retry onboarding method

**Main changes:**
- approval flow now optionally starts blockchain org onboarding
- added onboarding payload builder
- added retry/manual onboarding function

---

## 11. Admin Approval Controller

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/admin/controllers/admin-approval.controller.js`

**Why this file was edited:**
- To expose a controller method for blockchain org onboarding

---

## 12. Admin Routes

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/admin/routes/admin.routes.js`

**Why this file was edited:**
- To add a new admin API route:
  `POST /admin/applications/:id/onboard-blockchain-org`

This route allows:
- retrying onboarding after failure
- onboarding an already approved bank later

---

## 13. Server Route List

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/server.js`

**Why this file was edited:**
- To include the new onboarding route in the backend route listing

---

## 14. Bank Application Repository

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/repositories/BankApplicationRepository.js`

**Why this file was edited:**
- To support saving `blockchain_org_metadata` as JSON
- To store onboarding result details and error information

---

## 15. Bank Application Service

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/services/BankApplicationService.js`

**Why this file was edited:**
- To allow onboarding-related fields inside application activation metadata

**Added support for:**
- `org_name`
- `org_domain`
- `peer_port`
- `operations_port`
- `channel_name`

---

## 16. Enums

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/src/types/enums.js`

**Why this file was edited:**
- To add dedicated blockchain onboarding states

**Added values:**
- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED`

---

## 17. Database Migration for Onboarding Tracking

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/database/migrations/003_add_blockchain_onboarding_tracking.sql`

**Why this file was added:**
- To track blockchain org onboarding separately from normal application review
- To store onboarding timestamps and failure reasons
- To allow application status to move to `ACTIVE`

**New DB fields added:**
- `blockchain_onboarding_status`
- `blockchain_onboarding_started_at`
- `blockchain_onboarding_completed_at`
- `blockchain_onboarding_failed_at`
- `blockchain_onboarding_last_error`
- `blockchain_org_metadata`

---

## 18. Backend Environment Example

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/backend/.env.example`

**Why this file was edited:**
- To document the env variables needed by the onboarding service

**Added entries:**
- `TEST_NETWORK_DIR`
- `BLOCKCHAIN_ORG_ONBOARDING_SCRIPT`

---

## 19. Main Dynamic Onboarding Documentation

**File path:** `/home/ronithpatel/fabric/fabric-samples/betweennetwork/DYNAMIC_ORG_ONBOARDING.md`

**Why this file was added:**
- To explain the overall dynamic onboarding architecture
- To document API usage, direct script usage, and prerequisites

---

# Step-by-Step Execution Flow

## A. Business Flow

1. Bank submits off-chain application
2. BetweenNetwork admin reviews the application
3. Admin approves the bank
4. Existing participant activation logic runs
5. Blockchain org onboarding starts
6. New org is added to running channel
7. New peer joins channel
8. Backend stores onboarding result
9. Approved bank can move forward for dashboard/API usage

---

## B. Fabric Technical Flow

1. Build new org details:
   - bank ID
   - MSP ID
   - domain
   - peer port
   - operations port

2. Generate org crypto material using cryptogen

3. Generate org definition JSON with `configtxgen -printOrg`

4. Start peer container using generated compose files

5. Fetch current config block from existing running channel

6. Decode current channel config

7. Merge new org definition into:
   `channel_group.groups.Application.groups`

8. Compute config update using `configtxlator`

9. Sign config update using currently active orgs from:
   `/home/ronithpatel/fabric/fabric-samples/test-network/dynamic-org/org-registry.json`

10. Submit config update to orderer

11. Fetch latest channel block for new org

12. Join new peer to the channel

13. Set new org anchor peer

14. Generate connection profile JSON/YAML

15. Update registry so this org can participate in future org onboarding updates

---

## C. Backend Flow

1. Admin calls approval endpoint
2. Backend activates participant through existing blockchain logic
3. Backend calls `BlockchainOrgOnboardingService`
4. Service runs the shell script
5. Service records:
   - `IN_PROGRESS`
   - `COMPLETED`
   - or `FAILED`
6. Audit log entry is created
7. Application is marked `ACTIVE` only after successful blockchain org onboarding

---

# Important Design Rule

These edits were made so that:
- existing network startup flow is not used for late org onboarding
- existing orgs are not restarted
- channel is not recreated
- only approved banks get blockchain org onboarding
- blockchain org onboarding is separate from simple application registration

---

# Manual Prerequisites

Before using this flow, these still need to exist:

1. Running Fabric network and running channel
2. Fabric binaries installed:
   - `cryptogen`
   - `configtxgen`
   - `configtxlator`
3. `jq` installed
4. Docker and Docker Compose working
5. Existing org admin MSP material available
6. Database migration `003_add_blockchain_onboarding_tracking.sql` applied

---

# Example Direct Test Command

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

---

# Example Admin API Retry Command

```bash
POST /admin/applications/:id/onboard-blockchain-org
```

This is used when:
- a bank is already approved
- blockchain onboarding failed earlier
- admin wants to trigger onboarding again later
