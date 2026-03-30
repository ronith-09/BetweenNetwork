// Off-chain statuses for bank applications
const OffChainStatuses = {
  APPLIED: 'APPLIED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  REJECTED: 'REJECTED',
  APPROVED_PENDING_ACTIVATION: 'APPROVED_PENDING_ACTIVATION',
  ACTIVE: 'ACTIVE'
};

// On-chain statuses for participants
const OnChainStatuses = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REVOKED: 'REVOKED'
};

// Document types
const DocumentTypes = {
  INCORPORATION: 'INCORPORATION',
  LICENSE: 'LICENSE',
  FINANCIAL_STATEMENT: 'FINANCIAL_STATEMENT',
  COMPLIANCE_CERTIFICATE: 'COMPLIANCE_CERTIFICATE',
  BANK_REFERENCE: 'BANK_REFERENCE',
  PROOF_OF_ADDRESS: 'PROOF_OF_ADDRESS'
};

// Wallet delivery statuses
const WalletDeliveryStatuses = {
  PENDING: 'PENDING',
  GENERATED: 'GENERATED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED'
};

const BlockchainOnboardingStatuses = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

// Settlement models
const SettlementModels = {
  FULL_SETTLEMENT: 'FULL_SETTLEMENT',
  PAYMENT_VS_PAYMENT: 'PAYMENT_VS_PAYMENT',
  SIMULTANEOUS_SETTLEMENT: 'SIMULTANEOUS_SETTLEMENT'
};

module.exports = {
  OffChainStatuses,
  OnChainStatuses,
  DocumentTypes,
  WalletDeliveryStatuses,
  BlockchainOnboardingStatuses,
  SettlementModels
};
