# Bank Approval & Activation Flow - Pseudocode

This document outlines the complete approval and on-chain activation workflow.

---

## Overall Flow Diagram

```
BANK APPLICATION                BETWEENNETWORK ADMIN              BLOCKCHAIN
       │                                 │                              │
       │   Step 1: Apply                │                              │
       ├────────────────────────────────>│                              │
       │   (Create Application)          │                              │
       │                                 │                              │
       │   Status: APPLIED               │                              │
       │                                 │                              │
       │   Step 2: Submit                │                              │
       ├────────────────────────────────>│                              │
       │   (bank_id)                     │                              │
       │                                 │                              │
       │   Status: UNDER_REVIEW          │                              │
       │                                 │                              │
       │                                 │   Step 3: Review             │
       │                                 │   (compliance checks)        │
       │                                 │                              │
       │                                 │   Step 4: Approve & Activate │
       │                                 │   (with on-chain params)     │
       │                                 ├─────────────────────────────>│
       │                                 │   Invoke ActivateParticipant │
       │                                 │<─────────────────────────────┤
       │                                 │   Blockchain TX ID returned  │
       │                                 │                              │
       │                                 │   Step 5: Update DB          │
       │                                 │   Create/Update Participant  │
       │                                 │   Write Audit Log            │
       │                                 │                              │
       │<────────────────────────────────┤                              │
       │   Success Response              │                              │
       │   Participant ACTIVE            │                              │
       │                                 │                              │
       Status: Ready to settle transactions                             │
```

---

## 1. Application Creation

```javascript
// User creates application (public endpoint)
CREATE_BANK_APPLICATION(legalEntityName, registeredAddress, licenseNumber, etc.)
{
  // Validate input
  IF NOT all_required_fields_present:
    RETURN error (400)
  
  // Create application record
  application = {
    id: UUID(),
    legal_entity_name: legalEntityName,
    registered_address: registeredAddress,
    license_number: licenseNumber,
    regulator_name: regulatorName,
    webhook_url: webhookUrl,
    ip_allowlist: ipAllowlist,
    status: "APPLIED",
    created_at: NOW(),
    updated_at: NOW()
  }
  
  // Save to database
  INSERT INTO bank_applications VALUES (application)
  
  // Return response
  RETURN {
    success: true,
    data: application,
    message: "Bank application created successfully"
  }
}
```

---

## 2. Submission for Review

```javascript
SUBMIT_BANK_APPLICATION(applicationId, bankId)
{
  // Fetch application from database
  application = SELECT * FROM bank_applications WHERE id = applicationId
  
  IF application NOT FOUND:
    RETURN error (404, "Application not found")
  
  // Validate application status
  IF application.status != "APPLIED":
    RETURN error (400, "Only APPLIED applications can be submitted")
  
  // Validate required fields
  IF NOT application.legal_entity_name OR NOT application.license_number:
    RETURN error (400, "Missing required fields")
  
  // Update application
  UPDATE bank_applications
  SET status = "UNDER_REVIEW",
      bank_id = bankId,
      updated_at = NOW()
  WHERE id = applicationId
  
  // Return success
  RETURN {
    success: true,
    data: updated_application,
    message: "Application submitted for review"
  }
}
```

---

## 3. Admin Review

```javascript
REVIEW_BANK_APPLICATION(applicationId, reviewNotes, adminId)
{
  // Verify admin authorization
  IF NOT is_admin(adminId):
    RETURN error (403, "Admin authorization required")
  
  // Fetch application
  application = SELECT * FROM bank_applications WHERE id = applicationId
  
  IF application NOT FOUND:
    RETURN error (404)
  
  // Update with review notes
  UPDATE bank_applications
  SET risk_review_notes = reviewNotes,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = applicationId
  
  // Log audit entry
  INSERT INTO audit_logs VALUES {
    action: "APPLICATION_REVIEWED",
    entity_type: "BANK_APPLICATION",
    entity_id: applicationId,
    admin_id: adminId,
    old_status: application.status,
    new_status: "UNDER_REVIEW",
    details: {notes: reviewNotes},
    timestamp: NOW()
  }
  
  RETURN {
    success: true,
    data: updated_application,
    message: "Application reviewed"
  }
}
```

---

## 4. Admin Approval & Blockchain Activation (CRITICAL)

```javascript
APPROVE_AND_ACTIVATE_BANK(applicationId, approvalData, adminId)
{
  // ========== PRE-VALIDATION ==========
  
  // Verify admin authorization
  IF NOT is_admin(adminId):
    RETURN error (403, "Admin authorization required")
  
  // Fetch application
  application = SELECT * FROM bank_applications WHERE id = applicationId
  
  IF application NOT FOUND:
    RETURN error (404, "Application not found")
  
  // Validate all required on-chain activation fields
  REQUIRED_FIELDS = [
    "bic_swift_code",
    "country_code",
    "msp_id",
    "public_key_hash",
    "certificate_thumbprint_hash"
  ]
  
  FOR EACH field IN REQUIRED_FIELDS:
    IF NOT approvalData[field]:
      RETURN error (400, "Missing required field: " + field)
  
  // ========== PHASE 1: UPDATE OFF-CHAIN STATUS ==========
  
  // Update application status to APPROVED_PENDING_ACTIVATION
  UPDATE bank_applications
  SET status = "APPROVED_PENDING_ACTIVATION",
      bic_swift_code = approvalData.bic_swift_code,
      country_code = approvalData.country_code,
      msp_id = approvalData.msp_id,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = applicationId
  
  // ========== PHASE 2: BLOCKCHAIN ACTIVATION (CRITICAL) ==========
  
  TRY:
    // Prepare participant data for blockchain
    participant_payload = {
      bankId: application.bank_id,
      bankDisplayName: application.legal_entity_name,
      bicSwiftCode: approvalData.bic_swift_code,
      countryCode: approvalData.country_code,
      mspId: approvalData.msp_id,
      status: "ACTIVE",
      supportedCurrencies: approvalData.supported_currencies,
      settlementModel: approvalData.settlement_model,
      publicKeyHash: approvalData.public_key_hash,
      certificateThumbprintHash: approvalData.certificate_thumbprint_hash,
      joinedDate: NOW()
    }
    
    // Connect to Fabric network
    gateway = ConnectToFabric(process.env.FABRIC_CONFIG)
    network = gateway.GetNetwork("mychannel")
    contract = network.GetContract("participant-chaincode")
    
    // Invoke ActivateParticipant on-chain
    transaction = contract.CreateTransaction("ActivateParticipant")
    response = transaction.Submit(
      participant_payload.bankId,
      participant_payload.bankDisplayName,
      participant_payload.bicSwiftCode,
      participant_payload.countryCode,
      participant_payload.mspId,
      participant_payload.supportedCurrencies,
      participant_payload.settlementModel,
      participant_payload.publicKeyHash,
      participant_payload.certificateThumbprintHash,
      participant_payload.joinedDate
    )
    
    // Get transaction ID
    txId = transaction.GetTransactionID()
    
  CATCH blockchain_error:
    // Blockchain activation failed
    // Application already marked APPROVED_PENDING_ACTIVATION (rollback not needed for this demo)
    LOG error
    RETURN error (500, "Blockchain activation failed: " + blockchain_error.message, {
      success: false,
      txId: null,
      applicationApproved: true,
      blockchainError: blockchain_error.message
    })
  
  // ========== PHASE 3: CREATE/UPDATE PARTICIPANT IN DB ==========
  
  TRY:
    // Check if participant already exists
    existing_participant = SELECT * FROM participants
                           WHERE bank_id = application.bank_id
    
    IF existing_participant EXISTS:
      // Update existing participant
      UPDATE participants
      SET status = "ACTIVE",
          bank_display_name = application.legal_entity_name,
          bic_swift_code = approvalData.bic_swift_code,
          country_code = approvalData.country_code,
          msp_id = approvalData.msp_id,
          supported_currencies = approvalData.supported_currencies,
          settlement_model = approvalData.settlement_model,
          public_key_hash = approvalData.public_key_hash,
          certificate_thumbprint_hash = approvalData.certificate_thumbprint_hash,
          joined_date = NOW(),
          updated_at = NOW()
      WHERE bank_id = application.bank_id
      
      participant = SELECT * FROM participants WHERE bank_id = application.bank_id
    ELSE:
      // Create new participant
      participant = {
        id: UUID(),
        bank_id: application.bank_id,
        bank_display_name: application.legal_entity_name,
        bic_swift_code: approvalData.bic_swift_code,
        country_code: approvalData.country_code,
        msp_id: approvalData.msp_id,
        status: "ACTIVE",
        supported_currencies: approvalData.supported_currencies,
        settlement_model: approvalData.settlement_model,
        public_key_hash: approvalData.public_key_hash,
        certificate_thumbprint_hash: approvalData.certificate_thumbprint_hash,
        joined_date: NOW(),
        created_at: NOW(),
        updated_at: NOW()
      }
      
      INSERT INTO participants VALUES (participant)
  
  CATCH db_error:
    // Database insert/update failed
    LOG error
    RETURN error (500, "Database error: " + db_error.message, {
      success: false,
      txId: txId,
      blockchainSuccess: true,
      databaseError: db_error.message,
      action: "Manual database update required"
    })
  
  // ========== PHASE 4: AUDIT LOGGING ==========
  
  // Log successful activation
  INSERT INTO audit_logs VALUES {
    action: "APPLICATION_ACTIVATED",
    entity_type: "BANK_APPLICATION",
    entity_id: applicationId,
    admin_id: adminId,
    old_status: "APPROVED_PENDING_ACTIVATION",
    new_status: "ACTIVE",
    details: {
      txId: txId,
      bankId: application.bank_id,
      mspId: approvalData.msp_id
    },
    timestamp: NOW()
  }
  
  // ========== RETURN SUCCESS ==========
  
  RETURN {
    success: true,
    data: {
      application: {
        id: applicationId,
        bank_id: application.bank_id,
        status: "APPROVED_PENDING_ACTIVATION",
        approved_at: application.approved_at
      },
      participant: participant,
      blockchain: {
        txId: txId,
        message: "Participant activated on-chain"
      }
    },
    message: "Bank approved and activated successfully"
  }
}
```

---

## 5. Suspend Participant

```javascript
SUSPEND_PARTICIPANT(bankId, reason, adminId)
{
  // ========== AUTHORIZATION & VALIDATION ==========
  
  IF NOT is_admin(adminId):
    RETURN error (403)
  
  // Fetch participant
  participant = SELECT * FROM participants WHERE bank_id = bankId
  
  IF participant NOT FOUND:
    RETURN error (404, "Participant not found")
  
  IF participant.status == "REVOKED":
    RETURN error (400, "Cannot suspend a revoked participant")
  
  // ========== BLOCKCHAIN UPDATE ==========
  
  TRY:
    contract = GetBlockchainContract()
    
    txId = contract.SubmitTransaction(
      "SuspendParticipant",
      bankId,
      reason
    )
  
  CATCH blockchain_error:
    RETURN error (500, "Blockchain update failed: " + blockchain_error.message)
  
  // ========== DATABASE UPDATE ==========
  
  UPDATE participants
  SET status = "SUSPENDED",
      updated_at = NOW()
  WHERE bank_id = bankId
  
  // ========== AUDIT LOG ==========
  
  INSERT INTO audit_logs VALUES {
    action: "PARTICIPANT_SUSPENDED",
    entity_type: "PARTICIPANT",
    entity_id: bankId,
    admin_id: adminId,
    old_status: participant.status,
    new_status: "SUSPENDED",
    details: {reason: reason, txId: txId}
  }
  
  RETURN {
    success: true,
    data: updated_participant,
    blockchain: {txId: txId},
    message: "Participant suspended"
  }
}
```

---

## 6. Revoke Participant

```javascript
REVOKE_PARTICIPANT(bankId, reason, adminId)
{
  // Similar to SUSPEND_PARTICIPANT, but:
  // - New status: "REVOKED"
  // - Cannot be reactivated (different from suspension)
  // - Blockchain function: RevokeParticipant
  // - Audit action: PARTICIPANT_REVOKED
}
```

---

## 7. Reactivate Participant

```javascript
REACTIVATE_PARTICIPANT(bankId, reason, adminId)
{
  // ========== AUTHORIZATION & VALIDATION ==========
  
  IF NOT is_admin(adminId):
    RETURN error (403)
  
  // Fetch participant
  participant = SELECT * FROM participants WHERE bank_id = bankId
  
  IF participant NOT FOUND:
    RETURN error (404)
  
  IF participant.status == "ACTIVE":
    RETURN error (400, "Participant already active")
  
  IF participant.status == "REVOKED":
    RETURN error (400, "Cannot reactivate a revoked participant")
  
  // ========== BLOCKCHAIN UPDATE ==========
  
  TRY:
    contract = GetBlockchainContract()
    
    txId = contract.SubmitTransaction(
      "ReactivateParticipant",
      bankId,
      reason
    )
  
  CATCH blockchain_error:
    RETURN error (500, "Blockchain update failed")
  
  // ========== DATABASE UPDATE ==========
  
  UPDATE participants
  SET status = "ACTIVE",
      updated_at = NOW()
  WHERE bank_id = bankId
  
  // ========== AUDIT LOG ==========
  
  INSERT INTO audit_logs VALUES {
    action: "PARTICIPANT_REACTIVATED",
    entity_type: "PARTICIPANT",
    entity_id: bankId,
    admin_id: adminId,
    old_status: participant.status,
    new_status: "ACTIVE",
    details: {reason: reason, txId: txId}
  }
  
  RETURN {
    success: true,
    data: updated_participant,
    message: "Participant reactivated"
  }
}
```

---

## Key Flow Principles

1. **Admin-Only Governance:** Only BetweenNetworkMSP can perform approval, suspension, and revocation.

2. **Atomic Activation:** When approving, the system:
   - Updates application status first (de-risks if blockchain fails)
   - Invokes blockchain transaction
   - Creates participant record in database
   - Logs all changes with transaction ID

3. **Transaction Safety:** If blockchain fails during activation, the admin API returns a clear error and the state can be inspected for manual recovery.

4. **Immutable Audit Trail:** Every status change is logged with:
   - Admin ID
   - Timestamp
   - Old/new status
   - Blockchain transaction ID
   - Contextual details

5. **Status Consistency:** Off-chain (database) and on-chain (blockchain) statuses should remain in sync. All operations update both simultaneously.

---

## Error Scenarios & Recovery

### Scenario 1: Blockchain Fails During Activation

```
Application Status: APPROVED_PENDING_ACTIVATION ✓ (updated in DB)
Participant Record: NOT created (blockchain invocation failed)
Blockchain: ActivateParticipant NOT invoked
Response: 500 Internal Server Error with:
  - txId: null
  - blockchainError: "Connection timeout"
  - applicationApproved: true (already committed)

Recovery:
1. Retry activation with same approval data
2. Or check blockchain logs to determine if transaction was actually recorded
3. If on-chain data exists, manually create participant record
4. If blockchain was never reached, simply retry
```

### Scenario 2: Database Fails During Participant Creation

```
Application Status: APPROVED_PENDING_ACTIVATION ✓ (updated)
Blockchain Status: ActivateParticipant ✓ (successful, txId received)
Participant Record: NOT created (database connection lost)
Response: 500 Internal Server Error with:
  - txId: "tx_1711000400000" (blockchain succeeded)
  - databaseError: "Connection pool exhausted"
  - action: "Manual database update required"

Recovery:
1. Wait for database to recover
2. Manually execute: INSERT INTO participants (from approved application data)
3. Manually insert audit log with the txId from response
4. Verify consistency between blockchain and database
```

---

## Performance Considerations

- **Blockchain Timeout:** Set reasonable timeouts (10-30 seconds) for blockchain invocations
- **Database Connection Pooling:** Maintain sufficient pool size for concurrent approvals
- **Async Updates:** Consider storing audit logs asynchronously if volume is high
- **Batch Operations:** Support bulk suspension/revocation for compliance events

