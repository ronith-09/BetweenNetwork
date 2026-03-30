const express = require('express');
const BankApplicationController = require('../controllers/BankApplicationController');
const BankAuthController = require('../controllers/BankAuthController');
const MintController = require('../controllers/MintController');
const requireBankAuth = require('../middleware/requireBankAuth');
const SettlementController = require('../controllers/SettlementController');
const ParticipantController = require('../controllers/ParticipantController');
const adminRoutes = require('../admin/routes/admin.routes');

const router = express.Router();

// ==================== Bank Auth Routes ====================

router.post('/banks/auth/signup', BankAuthController.signup);
router.post('/banks/auth/login', BankAuthController.login);
router.get('/banks/me', requireBankAuth, BankAuthController.me);
router.get('/banks/me/wallet-package', requireBankAuth, BankAuthController.getWalletPackage);

// Backward-compatible aliases for existing automation/clients
router.post('/banks/signup', BankAuthController.signup);
router.post('/banks/login', BankAuthController.login);

// ==================== Bank Application Routes ====================

/**
 * POST /banks/applications
 * Create a new bank application
 */
router.post('/banks/applications', BankApplicationController.createApplication);

/**
 * GET /banks/applications
 * Get all bank applications
 */
router.get('/banks/applications', BankApplicationController.getAllApplications);

/**
 * GET /banks/applications/:id
 * Get a specific bank application
 */
router.get('/banks/applications/:id', BankApplicationController.getApplicationById);

/**
 * PATCH /banks/applications/:id
 * Update a bank application (only in APPLIED status)
 */
router.patch('/banks/applications/:id', BankApplicationController.updateApplication);

/**
 * POST /banks/applications/:id/submit
 * Submit application for review
 */
router.post('/banks/applications/:id/submit', BankApplicationController.submitApplication);

// ==================== Participant Routes ====================

/**
 * GET /participants
 * Get all active participants
 */
router.get('/participants', ParticipantController.getAllParticipants);

/**
 * GET /participants/msp/:mspId
 * Get participant by MSP ID
 */
router.get('/participants/msp/:mspId', ParticipantController.getParticipantByMSP);

/**
 * GET /participants/:bankId/wallet-eligibility
 * Check if the participant can access wallet features
 */
router.get('/participants/:bankId/wallet-eligibility', ParticipantController.getWalletEligibility);

/**
 * GET /participants/:bankId/active
 * Check participant ACTIVE status directly on chaincode
 */
router.get('/participants/:bankId/active', ParticipantController.isParticipantActive);

/**
 * POST /participants/:bankId/require-active
 * Assert participant is ACTIVE using chaincode validation
 */
router.post('/participants/:bankId/require-active', ParticipantController.requireActiveParticipant);

/**
 * GET /participants/:bankId
 * Get participant by bank ID
 */
router.get('/participants/:bankId', ParticipantController.getParticipantByBankId);

/**
 * POST /mint-requests
 * Create a mint request for a bank wallet
 */
router.post('/mint-requests', requireBankAuth, MintController.createMintRequest);

/**
 * GET /banks/:bankId/mint-requests
 * Get mint request history for a bank
 */
router.get('/banks/:bankId/mint-requests', requireBankAuth, MintController.getOwnMintRequests);

/**
 * GET /banks/:bankId/mint-requests/:requestId
 * Get a single mint request for a bank
 */
router.get('/banks/:bankId/mint-requests/:requestId', requireBankAuth, MintController.getOwnMintRequestById);

/**
 * GET /wallets/:bankId
 * Get wallet balances for a bank
 */
router.get('/wallets/:bankId', requireBankAuth, MintController.getWallet);

/**
 * POST /settlements/validate
 * Validate a settlement request with chaincode rules
 */
router.post('/settlements/validate', requireBankAuth, SettlementController.validateSettlement);

/**
 * POST /settlements/check-duplicate
 * Check whether a settlement request is duplicate
 */
router.post('/settlements/check-duplicate', requireBankAuth, SettlementController.checkDuplicateSettlement);

/**
 * POST /settlements
 * Create a settlement request
 */
router.post('/settlements', requireBankAuth, SettlementController.createSettlementRequest);

/**
 * POST /wallets/:bankId/check-balance
 * Check whether the wallet has sufficient balance
 */
router.post('/wallets/:bankId/check-balance', requireBankAuth, SettlementController.hasSufficientBalance);

/**
 * GET /banks/:bankId/settlements
 * Get settlement history for a bank
 */
router.get('/banks/:bankId/settlements', requireBankAuth, SettlementController.getOwnSettlementHistory);

/**
 * GET /banks/:bankId/settlements/:settlementId/status
 * Get settlement status for a bank-visible settlement
 */
router.get('/banks/:bankId/settlements/:settlementId/status', requireBankAuth, SettlementController.getSettlementStatus);

/**
 * GET /banks/:bankId/settlements/:settlementId/investigation
 * Investigate a settlement from the bank side
 */
router.get('/banks/:bankId/settlements/:settlementId/investigation', requireBankAuth, SettlementController.investigateSettlement);

/**
 * GET /banks/:bankId/settlements/:settlementId
 * Get a single settlement for a bank
 */
router.get('/banks/:bankId/settlements/:settlementId', requireBankAuth, SettlementController.getSettlementById);

// ==================== Admin Routes ====================

router.use('/admin', adminRoutes);

module.exports = router;
