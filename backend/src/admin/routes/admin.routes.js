const express = require('express');
const AdminApprovalController = require('../controllers/admin-approval.controller');
const AdminAuthController = require('../controllers/admin-auth.controller');
const requireBetweenNetworkAdmin = require('../middleware/requireBetweenNetworkAdmin');

const router = express.Router();

router.post('/signup', AdminAuthController.signup);
router.post('/login', AdminAuthController.login);

router.use(requireBetweenNetworkAdmin);

router.post('/chaincode/participants/activate', AdminApprovalController.activateParticipantDirect);
router.post('/applications/:id/review', AdminApprovalController.reviewApplication);
router.post('/applications/:id/approve', AdminApprovalController.approveApplication);
router.post('/applications/:id/onboard-blockchain-org', AdminApprovalController.onboardBlockchainOrganization);
router.post('/applications/:id/reject', AdminApprovalController.rejectApplication);

router.post('/participants/:bankId/suspend', AdminApprovalController.suspendParticipant);
router.post('/participants/:bankId/revoke', AdminApprovalController.revokeParticipant);
router.post('/participants/:bankId/reactivate', AdminApprovalController.reactivateParticipant);
router.get('/chaincode/participants', AdminApprovalController.getAllChaincodeParticipants);
router.get('/chaincode/participants/bank/:bankId', AdminApprovalController.getChaincodeParticipant);
router.get('/chaincode/participants/msp/:mspId', AdminApprovalController.getChaincodeParticipantByMSP);
router.get('/mint-requests', AdminApprovalController.getAllMintRequests);
router.get('/mint-requests/pending', AdminApprovalController.getPendingMintRequests);
router.get('/mint-requests/approved', AdminApprovalController.getApprovedMintHistory);
router.get('/mint-requests/:requestId', AdminApprovalController.getMintRequestById);
router.post('/mint-requests/:requestId/approve', AdminApprovalController.approveMintRequest);
router.post('/mint-requests/:requestId/reject', AdminApprovalController.rejectMintRequest);
router.get('/settlements', AdminApprovalController.getAllSettlements);
router.get('/settlements/:settlementId', AdminApprovalController.getSettlementById);
router.get('/settlements/:settlementId/status', AdminApprovalController.getSettlementStatus);
router.post('/settlements/:settlementId/approve', AdminApprovalController.approveSettlement);
router.post('/settlements/:settlementId/reject', AdminApprovalController.rejectSettlement);
router.post('/settlements/:settlementId/execute', AdminApprovalController.executeSettlement);
router.get('/audit-logs', AdminApprovalController.getAuditLogs);

module.exports = router;
