import React, { useEffect, useState } from 'react';
import { API_BASE, DetailRow, StatusBadge, escapeText } from './common.jsx';

const BANK_APPLICATION_STORAGE_KEY = 'betweennetwork_bank_application';
const EMPTY_APPLICATION_FORM = {
  id: '',
  bank_id: '',
  legal_entity_name: '',
  registered_address: '',
  license_number: '',
  regulator_name: '',
  webhook_url: '',
  ip_allowlist: ''
};
const EMPTY_ACTIVATION_FORM = {
  bic_swift_code: '',
  country_code: '',
  msp_id: '',
  supported_currencies: 'INR,USD',
  settlement_model: '',
  public_key_hash: '',
  certificate_thumbprint_hash: '',
  enrollment_id: '',
  affiliation: '',
  bank_password: ''
};
const EMPTY_BANK_LOOKUP_FORM = { bankId: '' };
const EMPTY_MINT_FORM = {
  bank_id: '',
  currency: '',
  amount: '',
  reason: ''
};
const EMPTY_SETTLEMENT_FORM = {
  from_bank: '',
  to_bank: '',
  currency: '',
  amount: '',
  reference: '',
  purpose: ''
};
const EMPTY_SETTLEMENT_LOOKUP = { settlement_id: '' };
const EMPTY_SETTLEMENT_PRECHECK = {
  valid: null,
  sufficient: null,
  duplicate: null,
  checked_at: null
};

function readStoredApplication() {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? JSON.parse(window.localStorage.getItem(BANK_APPLICATION_STORAGE_KEY) || 'null')
      : null;
  } catch {
    return null;
  }
}

function writeStoredApplication(application) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!application) {
        window.localStorage.removeItem(BANK_APPLICATION_STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(BANK_APPLICATION_STORAGE_KEY, JSON.stringify(application));
    }
  } catch {}
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

function normalizeBankId(value) {
  return String(value || '').trim().toUpperCase();
}

function canEditPrimaryApplication(application) {
  return !application?.id || application?.status === 'APPLIED';
}

function canEditActivationRequest(application) {
  return ['UNDER_REVIEW', 'APPROVED_PENDING_ACTIVATION', 'ACTIVE'].includes(
    String(application?.status || '').toUpperCase()
  );
}

export default function BankDashboard({ user, token, onBack }) {
  const [activeSection, setActiveSection] = useState('application');
  const [flash, setFlash] = useState(null);
  const [backendStatus, setBackendStatus] = useState({ reachable: null, message: 'Checking backend...' });
  const [apiCatalog, setApiCatalog] = useState({ public: [], admin: [] });
  const [applicationForm, setApplicationForm] = useState(EMPTY_APPLICATION_FORM);
  const [activationForm, setActivationForm] = useState(EMPTY_ACTIVATION_FORM);
  const [applicationRecord, setApplicationRecord] = useState(user);
  const [publicParticipants, setPublicParticipants] = useState([]);
  const [bankLookupForm, setBankLookupForm] = useState(EMPTY_BANK_LOOKUP_FORM);
  const [bankProfile, setBankProfile] = useState(null);
  const [walletEligibility, setWalletEligibility] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [mintRequests, setMintRequests] = useState([]);
  const [mintForm, setMintForm] = useState(EMPTY_MINT_FORM);
  const [mintSubmitting, setMintSubmitting] = useState(false);
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [settlementForm, setSettlementForm] = useState(EMPTY_SETTLEMENT_FORM);
  const [settlementLookupForm, setSettlementLookupForm] = useState(EMPTY_SETTLEMENT_LOOKUP);
  const [selectedSettlementStatus, setSelectedSettlementStatus] = useState(null);
  const [selectedSettlementRecord, setSelectedSettlementRecord] = useState(null);
  const [selectedSettlementInvestigation, setSelectedSettlementInvestigation] = useState(null);
  const [settlementPrecheck, setSettlementPrecheck] = useState(EMPTY_SETTLEMENT_PRECHECK);
  const [bankLookupLoading, setBankLookupLoading] = useState(false);

  useEffect(() => {
    checkBackendHealth();
    loadApiCatalog();
  }, []);

  useEffect(() => {
    loadPublicParticipants();
  }, []);

  useEffect(() => {
    if (!applicationRecord) {
      return;
    }

    setApplicationForm({
      id: applicationRecord.id || '',
      bank_id: applicationRecord.bank_id || '',
      legal_entity_name: applicationRecord.legal_entity_name || '',
      registered_address: applicationRecord.registered_address || '',
      license_number: applicationRecord.license_number || '',
      regulator_name: applicationRecord.regulator_name || '',
      webhook_url: applicationRecord.webhook_url || '',
      ip_allowlist: applicationRecord.ip_allowlist || ''
    });
    setActivationForm({
      bic_swift_code: applicationRecord.internal_review_metadata?.activation_request?.bic_swift_code || '',
      country_code: applicationRecord.internal_review_metadata?.activation_request?.country_code || '',
      msp_id: applicationRecord.internal_review_metadata?.activation_request?.msp_id || '',
      supported_currencies:
        (applicationRecord.internal_review_metadata?.activation_request?.supported_currencies || []).join(',') ||
        'INR,USD',
      settlement_model: applicationRecord.internal_review_metadata?.activation_request?.settlement_model || '',
      public_key_hash: applicationRecord.internal_review_metadata?.activation_request?.public_key_hash || '',
      certificate_thumbprint_hash:
        applicationRecord.internal_review_metadata?.activation_request?.certificate_thumbprint_hash || '',
      enrollment_id:
        applicationRecord.internal_review_metadata?.activation_request?.enrollment_id ||
        applicationRecord.bank_id ||
        '',
      affiliation: applicationRecord.internal_review_metadata?.activation_request?.affiliation || '',
      bank_password: applicationRecord.internal_review_metadata?.activation_request?.bank_password || ''
    });
    setBankLookupForm({ bankId: applicationRecord.bank_id || '' });
  }, [applicationRecord]);

  async function apiFetch(path, options = {}) {
    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-bank-id': user?.bank_id || '',
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (error) {
      setBackendStatus({
        reachable: false,
        message: `Cannot reach backend at ${API_BASE}`
      });
      throw new Error(`Cannot reach backend API at ${API_BASE}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || `Request failed with status ${response.status}`);
    }

    return payload;
  }

  async function checkBackendHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || `Health check failed with status ${response.status}`);
      }

      setBackendStatus({
        reachable: true,
        message: payload.message || 'Backend reachable'
      });
    } catch (error) {
      setBackendStatus({
        reachable: false,
        message: `Cannot reach backend at ${API_BASE}`
      });
    }
  }

  function showFlash(message, tone = 'neutral') {
    setFlash({ message, tone });
    window.clearTimeout(showFlash.timer);
    showFlash.timer = window.setTimeout(() => setFlash(null), 4000);
  }

  async function loadPublicParticipants() {
    try {
      const result = await apiFetch('/participants');
      setPublicParticipants(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      showFlash(`Failed to load active participants: ${error.message}`, 'danger');
    }
  }

  async function loadApiCatalog() {
    try {
      const result = await apiFetch('/routes');
      setApiCatalog({
        public: Array.isArray(result.data?.public) ? result.data.public : [],
        admin: Array.isArray(result.data?.admin) ? result.data.admin : []
      });
    } catch {}
  }

  async function loadApplicationById(applicationId) {
    const result = await apiFetch(`/banks/applications/${encodeURIComponent(applicationId)}`);
    const record = result.data || null;
    setApplicationRecord(record);
    writeStoredApplication(record);
    return record;
  }

  async function handleCreateApplication(event) {
    event.preventDefault();

    try {
      const result = await apiFetch('/banks/applications', {
        method: 'POST',
        body: {
          bank_id: String(applicationForm.bank_id || '').trim().toUpperCase(),
          legal_entity_name: applicationForm.legal_entity_name,
          registered_address: applicationForm.registered_address,
          license_number: applicationForm.license_number,
          regulator_name: applicationForm.regulator_name,
          webhook_url: applicationForm.webhook_url,
          ip_allowlist: applicationForm.ip_allowlist
        }
      });

      setApplicationRecord(result.data || null);
      writeStoredApplication(result.data || null);
      setBankLookupForm({ bankId: result.data?.bank_id || '' });
      showFlash(result.message || 'Bank application created.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleUpdateApplication(event) {
    event.preventDefault();

    if (!applicationRecord?.id) {
      showFlash('Create or load an application first.', 'warning');
      return;
    }

    try {
      const result = await apiFetch(`/banks/applications/${encodeURIComponent(applicationRecord.id)}`, {
        method: 'PATCH',
        body: {
          bank_id: String(applicationForm.bank_id || '').trim().toUpperCase(),
          legal_entity_name: applicationForm.legal_entity_name,
          registered_address: applicationForm.registered_address,
          license_number: applicationForm.license_number,
          regulator_name: applicationForm.regulator_name,
          webhook_url: applicationForm.webhook_url,
          ip_allowlist: applicationForm.ip_allowlist
        }
      });

      setApplicationRecord(result.data || null);
      writeStoredApplication(result.data || null);
      showFlash(result.message || 'Application updated.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleSubmitApplication(event) {
    event.preventDefault();

    if (!applicationRecord?.id) {
      showFlash('Create or load an application first.', 'warning');
      return;
    }

    try {
      const result = await apiFetch(`/banks/applications/${encodeURIComponent(applicationRecord.id)}/submit`, {
        method: 'POST',
        body: {
          bank_id: String(applicationForm.bank_id || '').trim().toUpperCase()
        }
      });

      setApplicationRecord(result.data || null);
      writeStoredApplication(result.data || null);
      setActiveSection('profile');
      showFlash(result.message || 'Application submitted for review.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleSaveActivationRequest(event) {
    event.preventDefault();

    if (!applicationRecord?.id) {
      showFlash('Create and submit the first application first.', 'warning');
      return;
    }

    try {
      const result = await apiFetch(`/banks/applications/${encodeURIComponent(applicationRecord.id)}`, {
        method: 'PATCH',
        body: {
          activation_request: {
            ...activationForm,
            enrollment_id: activationForm.enrollment_id || applicationRecord.bank_id
          }
        }
      });

      setApplicationRecord(result.data || null);
      writeStoredApplication(result.data || null);
      showFlash('Activation details saved for BetweenNetwork approval.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleRefreshApplication() {
    if (!applicationRecord?.id) {
      showFlash('No saved application yet.', 'warning');
      return;
    }

    try {
      await loadApplicationById(applicationRecord.id);
      showFlash('Application status refreshed.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function loadBankOperationalData(bankId) {
    const [walletResult, mintHistoryResult, settlementHistoryResult] = await Promise.all([
      apiFetch(`/wallets/${encodeURIComponent(bankId)}`),
      apiFetch(`/banks/${encodeURIComponent(bankId)}/mint-requests`),
      apiFetch(`/banks/${encodeURIComponent(bankId)}/settlements`)
    ]);

    setWallet(walletResult.data || null);
    setMintRequests(Array.isArray(mintHistoryResult.data) ? mintHistoryResult.data : []);
    setSettlementRequests(Array.isArray(settlementHistoryResult.data) ? settlementHistoryResult.data : []);
  }

  async function handleBankLookup(event) {
    event.preventDefault();
    const bankId = normalizeBankId(bankLookupForm.bankId);

    if (!bankId) {
      showFlash('Enter a bank ID first.', 'warning');
      return;
    }

    setBankLookupLoading(true);

    try {
      const [participantResult, eligibilityResult, activeResult] = await Promise.all([
        apiFetch(`/participants/${encodeURIComponent(bankId)}`),
        apiFetch(`/participants/${encodeURIComponent(bankId)}/wallet-eligibility`),
        apiFetch(`/participants/${encodeURIComponent(bankId)}/active`)
      ]);

      setBankProfile(participantResult.data || null);
      setWalletEligibility({
        ...(eligibilityResult.data || {}),
        on_chain_active: Boolean(activeResult.data?.active)
      });
      setMintForm((current) => ({ ...current, bank_id: bankId }));
      setSettlementForm((current) => ({ ...current, from_bank: bankId }));
      setSettlementLookupForm(EMPTY_SETTLEMENT_LOOKUP);
      setSelectedSettlementRecord(null);
      setSelectedSettlementStatus(null);
      setSelectedSettlementInvestigation(null);
      setSettlementPrecheck(EMPTY_SETTLEMENT_PRECHECK);

      if (eligibilityResult.data?.wallet_enabled) {
        await loadBankOperationalData(bankId);
      } else {
        setWallet(null);
        setMintRequests([]);
        setSettlementRequests([]);
      }

      setActiveSection('dashboard');
      showFlash(`Loaded bank dashboard for ${bankId}.`, 'success');
    } catch (error) {
      setBankProfile(null);
      setWalletEligibility(null);
      setWallet(null);
      setMintRequests([]);
      setSettlementRequests([]);
      setSelectedSettlementRecord(null);
      setSelectedSettlementStatus(null);
      setSelectedSettlementInvestigation(null);
      setSettlementPrecheck(EMPTY_SETTLEMENT_PRECHECK);
      showFlash(error.message, 'danger');
    } finally {
      setBankLookupLoading(false);
    }
  }

  async function resolveBankProfileForOperation(bankId) {
    const normalizedBankId = normalizeBankId(bankId);
    const [participantResult, eligibilityResult, activeResult] = await Promise.all([
      apiFetch(`/participants/${encodeURIComponent(normalizedBankId)}`),
      apiFetch(`/participants/${encodeURIComponent(normalizedBankId)}/wallet-eligibility`),
      apiFetch(`/participants/${encodeURIComponent(normalizedBankId)}/active`)
    ]);

    const nextEligibility = {
      ...(eligibilityResult.data || {}),
      on_chain_active: Boolean(activeResult.data?.active)
    };

    setBankProfile(participantResult.data || null);
    setWalletEligibility(nextEligibility);
    setBankLookupForm({ bankId: normalizedBankId });
    setMintForm((current) => ({ ...current, bank_id: normalizedBankId }));
    setSettlementForm((current) => ({ ...current, from_bank: normalizedBankId }));

    if (nextEligibility.wallet_enabled) {
      await loadBankOperationalData(normalizedBankId);
    }

    return nextEligibility;
  }

  async function handleCreateMintRequest(event) {
    event.preventDefault();
    const bankId = normalizeBankId(mintForm.bank_id);

    if (!bankId) {
      showFlash('Load a bank first.', 'warning');
      return;
    }

    try {
      setMintSubmitting(true);
      showFlash(`Verifying ${bankId} and submitting mint request...`, 'warning');
      let currentEligibility = walletEligibility;

      if (!currentEligibility || normalizeBankId(currentEligibility.bank_id) !== bankId) {
        currentEligibility = await resolveBankProfileForOperation(bankId);
      }

      if (!currentEligibility?.wallet_enabled) {
        throw new Error(currentEligibility?.reason || `Organization ${bankId} is not ACTIVE in BetweenNetwork.`);
      }

      await apiFetch('/mint-requests', {
        method: 'POST',
        body: {
          bank_id: bankId,
          currency: String(mintForm.currency || '').trim().toUpperCase(),
          amount: Number(mintForm.amount),
          reason: mintForm.reason
        }
      });

      await loadBankOperationalData(bankId);
      setMintForm((current) => ({ ...current, currency: '', amount: '', reason: '' }));
      showFlash('Mint request created.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    } finally {
      setMintSubmitting(false);
    }
  }

  async function handleCreateSettlementRequest(event) {
    event.preventDefault();
    const fromBank = normalizeBankId(settlementForm.from_bank);
    const toBank = normalizeBankId(settlementForm.to_bank);
    const currency = String(settlementForm.currency || '').trim().toUpperCase();
    const amount = Number(settlementForm.amount);
    const reference = String(settlementForm.reference || '').trim();

    if (!fromBank) {
      showFlash('Load a bank first.', 'warning');
      return;
    }

    try {
      const [validationResult, balanceResult, duplicateResult] = await Promise.all([
        apiFetch('/settlements/validate', {
          method: 'POST',
          body: {
            from_bank: fromBank,
            to_bank: toBank,
            currency,
            amount
          }
        }),
        apiFetch(`/wallets/${encodeURIComponent(fromBank)}/check-balance`, {
          method: 'POST',
          body: {
            currency,
            amount
          }
        }),
        apiFetch('/settlements/check-duplicate', {
          method: 'POST',
          body: {
            from_bank: fromBank,
            to_bank: toBank,
            currency,
            amount,
            reference
          }
        })
      ]);

      const precheckState = {
        valid: Boolean(validationResult.data?.valid),
        sufficient: Boolean(balanceResult.data?.sufficient),
        duplicate: Boolean(duplicateResult.data?.duplicate),
        checked_at: new Date().toISOString()
      };
      setSettlementPrecheck(precheckState);

      if (!precheckState.valid) {
        throw new Error('Settlement validation failed.');
      }
      if (!precheckState.sufficient) {
        throw new Error(`Insufficient ${currency} balance for ${fromBank}.`);
      }
      if (precheckState.duplicate) {
        throw new Error(`Duplicate settlement detected for reference ${reference || '(blank reference)'}.`);
      }

      await apiFetch('/settlements', {
        method: 'POST',
        body: {
          from_bank: fromBank,
          to_bank: toBank,
          currency,
          amount,
          reference,
          purpose: settlementForm.purpose
        }
      });

      await loadBankOperationalData(fromBank);
      setSettlementForm((current) => ({
        ...current,
        to_bank: '',
        currency: '',
        amount: '',
        reference: '',
        purpose: ''
      }));
      showFlash('Settlement request created.', 'success');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleSettlementLookup(event) {
    event.preventDefault();
    const bankId = String(bankProfile?.bank_id || walletEligibility?.bank_id || '').trim();
    const settlementId = String(settlementLookupForm.settlement_id || '').trim();

    if (!bankId || !settlementId) {
      showFlash('Load a bank and enter a settlement ID first.', 'warning');
      return;
    }

    try {
      const [recordResult, statusResult, investigationResult] = await Promise.all([
        apiFetch(`/banks/${encodeURIComponent(bankId)}/settlements/${encodeURIComponent(settlementId)}`),
        apiFetch(`/banks/${encodeURIComponent(bankId)}/settlements/${encodeURIComponent(settlementId)}/status`),
        apiFetch(`/banks/${encodeURIComponent(bankId)}/settlements/${encodeURIComponent(settlementId)}/investigation`)
      ]);

      setSelectedSettlementRecord(recordResult.data || null);
      setSelectedSettlementStatus(statusResult.data || null);
      setSelectedSettlementInvestigation(investigationResult.data || null);
      showFlash(`Loaded settlement trace for ${settlementId}.`, 'success');
    } catch (error) {
      setSelectedSettlementRecord(null);
      setSelectedSettlementStatus(null);
      setSelectedSettlementInvestigation(null);
      showFlash(error.message, 'danger');
    }
  }

  function updateForm(setter) {
    return (event) => {
      const { name, value } = event.target;
      setter((current) => ({ ...current, [name]: value }));
    };
  }

  const selectedBankId = bankProfile?.bank_id || walletEligibility?.bank_id || '-';
  const walletBalances = Array.isArray(wallet?.balances) ? wallet.balances : [];
  const walletTotalBalance = walletBalances.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const pendingSettlements = settlementRequests.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
  const activeTransactions = settlementRequests.filter((item) => ['PENDING', 'APPROVED'].includes(String(item.status || '').toUpperCase())).length;
  const totalSentToday = settlementRequests
    .filter((item) => item.from_bank === selectedBankId && isToday(item.completed_at || item.created_at))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalReceivedToday = settlementRequests
    .filter((item) => item.to_bank === selectedBankId && isToday(item.completed_at || item.created_at))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const recentSettlements = settlementRequests.slice(0, 5);
  const recentMintRequests = mintRequests.slice(0, 5);
  const mintActionLockedReason = !walletEligibility
    ? 'Enter a bank_id and submit. The frontend will verify the profile automatically.'
    : walletEligibility.wallet_enabled
      ? ''
      : walletEligibility.reason || 'Minting is available only for ACTIVE organizations.';
  const bankAlerts = [
    ...settlementRequests
      .filter((item) => String(item.status || '').toUpperCase() === 'REJECTED')
      .slice(0, 2)
      .map((item) => `Settlement ${item.settlement_id} was rejected.`),
    ...mintRequests
      .filter((item) => String(item.status || '').toUpperCase() === 'REJECTED')
      .slice(0, 2)
      .map((item) => `Mint request ${item.request_id} was rejected.`)
  ].slice(0, 4);
  const primaryApplicationEditable = canEditPrimaryApplication(applicationRecord);
  const activationRequestEditable = canEditActivationRequest(applicationRecord);
  const activationRequestReadyMessage = applicationRecord?.id
    ? activationRequestEditable
      ? 'BetweenNetwork has accepted the first application for review. You can now submit the second-step network details.'
      : 'Submit the first application and wait for BetweenNetwork review before entering network details.'
    : 'Create the first application before the second-step network details become available.';

  function renderPage() {
    switch (activeSection) {
      case 'application':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Bank Application</p>
                  <h3>Create, update, and submit onboarding details</h3>
                </div>
                <button className="secondary-button" type="button" onClick={handleRefreshApplication}>
                  Refresh application
                </button>
              </div>

              <div className="detail-grid bank-status-grid">
                <form className="action-form" onSubmit={handleCreateApplication}>
                  <h4>Create or edit application</h4>
                  <label><span>bank_id</span><input name="bank_id" value={applicationForm.bank_id} onChange={updateForm(setApplicationForm)} placeholder="BANK001" disabled={!primaryApplicationEditable} /></label>
                  <label><span>legal_entity_name</span><input name="legal_entity_name" value={applicationForm.legal_entity_name} onChange={updateForm(setApplicationForm)} placeholder="Global First Bank" disabled={!primaryApplicationEditable} /></label>
                  <label><span>registered_address</span><textarea name="registered_address" rows="3" value={applicationForm.registered_address} onChange={updateForm(setApplicationForm)} placeholder="Registered address" disabled={!primaryApplicationEditable} /></label>
                  <label><span>license_number</span><input name="license_number" value={applicationForm.license_number} onChange={updateForm(setApplicationForm)} placeholder="License number" disabled={!primaryApplicationEditable} /></label>
                  <label><span>regulator_name</span><input name="regulator_name" value={applicationForm.regulator_name} onChange={updateForm(setApplicationForm)} placeholder="Regulator name" disabled={!primaryApplicationEditable} /></label>
                  <label><span>webhook_url</span><input name="webhook_url" value={applicationForm.webhook_url} onChange={updateForm(setApplicationForm)} placeholder="https://bank.example.com/hooks" disabled={!primaryApplicationEditable} /></label>
                  <label><span>ip_allowlist</span><input name="ip_allowlist" value={applicationForm.ip_allowlist} onChange={updateForm(setApplicationForm)} placeholder="10.0.0.10,10.0.0.11" disabled={!primaryApplicationEditable} /></label>
                  <button className="primary-button full-width" type="submit">
                    {applicationRecord?.id ? 'Create new draft' : 'Create draft'}
                  </button>
                  <button className="secondary-button full-width" type="button" onClick={handleUpdateApplication} disabled={!applicationRecord?.id || !primaryApplicationEditable}>
                    Update current draft
                  </button>
                  <button className="success-button full-width" type="button" onClick={handleSubmitApplication} disabled={!applicationRecord?.id || !primaryApplicationEditable}>
                    Submit to admin review
                  </button>
                </form>

                <div className="form-stack">
                  <div className="info-panel">
                    <h4>Current application</h4>
                    <dl className="detail-list compact">
                      <DetailRow label="id" value={applicationRecord?.id} />
                      <DetailRow label="bank_id" value={applicationRecord?.bank_id} />
                      <DetailRow label="status" value={applicationRecord?.status} status />
                      <DetailRow label="legal_entity_name" value={applicationRecord?.legal_entity_name} />
                      <DetailRow label="license_number" value={applicationRecord?.license_number} />
                      <DetailRow label="regulator_name" value={applicationRecord?.regulator_name} />
                      <DetailRow label="bic_swift_code" value={applicationRecord?.bic_swift_code} />
                      <DetailRow label="country_code" value={applicationRecord?.country_code} />
                      <DetailRow label="msp_id" value={applicationRecord?.msp_id} />
                      <DetailRow label="risk_review_notes" value={applicationRecord?.risk_review_notes} />
                      <DetailRow label="approved_at" value={applicationRecord?.approved_at} />
                      <DetailRow label="rejected_at" value={applicationRecord?.rejected_at} />
                    </dl>
                  </div>

                  <div className="info-panel">
                    <h4>How this connects</h4>
                    <ul className="history-list">
                      <li>Step 1: the bank creates and submits only the business application details here.</li>
                      <li>BetweenNetwork reviews that first application and moves it into review.</li>
                      <li>Step 2 becomes available only after that review stage, and the bank then fills BIC, MSP, and wallet/network details.</li>
                      <li>BetweenNetwork approves the final onboarding after the second-step details are present.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </article>

            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Second Application</p>
                  <h3>Bank-owned network details for final approval</h3>
                </div>
                <span className="badge neutral">{applicationRecord?.status || 'Create first application'}</span>
              </div>

              <div className="detail-grid bank-status-grid">
                <form className="action-form" onSubmit={handleSaveActivationRequest}>
                  <h4>Available after BetweenNetwork review</h4>
                  <p>{activationRequestReadyMessage}</p>
                  <label><span>bic_swift_code</span><input name="bic_swift_code" value={activationForm.bic_swift_code} onChange={updateForm(setActivationForm)} placeholder="GFBLGB2L" disabled={!activationRequestEditable} /></label>
                  <label><span>country_code</span><input name="country_code" value={activationForm.country_code} onChange={updateForm(setActivationForm)} placeholder="IN" disabled={!activationRequestEditable} /></label>
                  <label><span>msp_id</span><input name="msp_id" value={activationForm.msp_id} onChange={updateForm(setActivationForm)} placeholder="Bank1MSP" disabled={!activationRequestEditable} /></label>
                  <label><span>supported_currencies</span><input name="supported_currencies" value={activationForm.supported_currencies} onChange={updateForm(setActivationForm)} placeholder="INR,USD" disabled={!activationRequestEditable} /></label>
                  <label><span>settlement_model</span><input name="settlement_model" value={activationForm.settlement_model} onChange={updateForm(setActivationForm)} placeholder="FULL_SETTLEMENT" disabled={!activationRequestEditable} /></label>
                  <label><span>public_key_hash</span><input name="public_key_hash" value={activationForm.public_key_hash} onChange={updateForm(setActivationForm)} disabled={!activationRequestEditable} /></label>
                  <label><span>certificate_thumbprint_hash</span><input name="certificate_thumbprint_hash" value={activationForm.certificate_thumbprint_hash} onChange={updateForm(setActivationForm)} disabled={!activationRequestEditable} /></label>
                  <label><span>enrollment_id</span><input name="enrollment_id" value={activationForm.enrollment_id} onChange={updateForm(setActivationForm)} placeholder={applicationRecord?.bank_id || 'BANK001'} disabled={!activationRequestEditable} /></label>
                  <label><span>affiliation</span><input name="affiliation" value={activationForm.affiliation} onChange={updateForm(setActivationForm)} placeholder="org1.department1" disabled={!activationRequestEditable} /></label>
                  <label><span>bank_password</span><input type="password" name="bank_password" value={activationForm.bank_password} onChange={updateForm(setActivationForm)} placeholder="Wallet enrollment password" disabled={!activationRequestEditable} /></label>
                  <button className="primary-button full-width" type="submit" disabled={!applicationRecord?.id || !activationRequestEditable}>
                    Save activation request
                  </button>
                </form>

                <div className="info-panel">
                  <h4>Approval path</h4>
                  <dl className="detail-list compact">
                    <DetailRow label="application_status" value={applicationRecord?.status} status />
                    <DetailRow label="bic_swift_code" value={applicationRecord?.internal_review_metadata?.activation_request?.bic_swift_code} />
                    <DetailRow label="country_code" value={applicationRecord?.internal_review_metadata?.activation_request?.country_code} />
                    <DetailRow label="msp_id" value={applicationRecord?.internal_review_metadata?.activation_request?.msp_id} />
                    <DetailRow label="enrollment_id" value={applicationRecord?.internal_review_metadata?.activation_request?.enrollment_id} />
                  </dl>
                  <ul className="history-list">
                    <li>The bank cannot fill this second application while the first application is still only a draft.</li>
                    <li>BetweenNetwork must first accept the first application into review.</li>
                    <li>Only then does the bank provide blockchain network details.</li>
                    <li>Final approval uses these values for participant activation and blockchain onboarding.</li>
                  </ul>
                </div>
              </div>
            </article>
          </section>
        );
      case 'dashboard':
        return (
          <>
            <section className="hero bank-hero">
              <div className="hero-copy">
                <p className="eyebrow">Home</p>
                <h3>Operational workspace for wallet, minting, settlements, and tracking.</h3>
                <p>This bank dashboard now opens one lane at a time instead of one long screen.</p>
              </div>
              <div className="hero-metrics">
                <div><span className="metric-value">{walletTotalBalance}</span><span className="metric-label">Wallet balance</span></div>
                <div><span className="metric-value">{pendingSettlements}</span><span className="metric-label">Pending settlements</span></div>
                <div><span className="metric-value">{activeTransactions}</span><span className="metric-label">Active transactions</span></div>
              </div>
            </section>

            <section className="kpi-grid">
              <article className="card kpi-card">
                <p className="kpi-label">Wallet balance</p>
                <div className="kpi-row"><strong>{walletTotalBalance}</strong><span className="badge success">Live</span></div>
                <p className="kpi-note">Combined balance across all wallet currencies.</p>
              </article>
              <article className="card kpi-card">
                <p className="kpi-label">Pending settlements</p>
                <div className="kpi-row"><strong>{pendingSettlements}</strong><span className="badge warning">Queue</span></div>
                <p className="kpi-note">Requests still waiting for completion.</p>
              </article>
              <article className="card kpi-card">
                <p className="kpi-label">Total sent today</p>
                <div className="kpi-row"><strong>{totalSentToday}</strong><span className="badge neutral">Outflow</span></div>
                <p className="kpi-note">Today's sent settlement volume.</p>
              </article>
              <article className="card kpi-card">
                <p className="kpi-label">Total received today</p>
                <div className="kpi-row"><strong>{totalReceivedToday}</strong><span className="badge neutral">Inflow</span></div>
                <p className="kpi-note">Today's received settlement volume.</p>
              </article>
            </section>

            <section className="content-grid bank-grid">
              <article className="card detail-card">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Dashboard</p>
                    <h3>Recent activity</h3>
                  </div>
                </div>

                <div className="dashboard-ops-grid">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>settlement_id</th>
                          <th>to_bank</th>
                          <th>amount</th>
                          <th>status</th>
                          <th>time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSettlements.length === 0 ? (
                          <tr><td colSpan="5">No recent settlements yet.</td></tr>
                        ) : recentSettlements.map((item) => (
                          <tr key={item.settlement_id}>
                            <td>{escapeText(item.settlement_id)}</td>
                            <td>{escapeText(item.to_bank)}</td>
                            <td>{escapeText(item.amount)}</td>
                            <td><StatusBadge status={item.status} /></td>
                            <td>{escapeText(item.completed_at || item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-stack">
                    <div className="action-form">
                      <h4>Quick actions</h4>
                      <button className="primary-button quick-link" type="button" onClick={() => setActiveSection('mint')}>Create mint request</button>
                      <button className="primary-button quick-link" type="button" onClick={() => setActiveSection('settlement')}>Create settlement</button>
                    </div>

                    <div className="info-panel">
                      <h4>Alerts</h4>
                      <ul className="history-list">
                        {bankAlerts.length === 0 ? (
                          <li>No active alerts.</li>
                        ) : bankAlerts.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>request_id</th>
                        <th>amount</th>
                        <th>currency</th>
                        <th>status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMintRequests.length === 0 ? (
                        <tr><td colSpan="4">No mint history yet.</td></tr>
                      ) : recentMintRequests.map((item) => (
                        <tr key={item.request_id}>
                          <td>{escapeText(item.request_id)}</td>
                          <td>{escapeText(item.amount)}</td>
                          <td>{escapeText(item.currency)}</td>
                          <td><StatusBadge status={item.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        );
      case 'participants':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Participants</p>
                  <h3>Other banks on the network</h3>
                </div>
                <button className="secondary-button" type="button" onClick={loadPublicParticipants}>Refresh participants</button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>bank_name</th>
                      <th>bank_id</th>
                      <th>country</th>
                      <th>bic</th>
                      <th>status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicParticipants.length === 0 ? (
                      <tr><td colSpan="5">No active participants returned.</td></tr>
                    ) : publicParticipants.map((participant) => (
                      <tr key={`${participant.bank_id}-${participant.msp_id}`}>
                        <td>{escapeText(participant.bank_display_name)}</td>
                        <td>{escapeText(participant.bank_id)}</td>
                        <td>{escapeText(participant.country_code)}</td>
                        <td>{escapeText(participant.bic_swift_code)}</td>
                        <td><StatusBadge status={participant.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        );
      case 'wallet':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Wallet</p>
                  <h3>Balance, liquidity, and operational history</h3>
                </div>
              </div>

              <div className="detail-grid bank-status-grid">
                <div className="info-panel">
                  <h4>Wallet summary</h4>
                  <dl className="detail-list">
                    <DetailRow label="bank_id" value={selectedBankId} />
                    <DetailRow label="eligibility" value={walletEligibility?.wallet_enabled ? 'ENABLED' : 'DISABLED'} status />
                    <DetailRow label="available_liquidity" value={walletTotalBalance} />
                    <DetailRow label="currency_count" value={walletBalances.length} />
                  </dl>
                </div>

                <div className="info-panel">
                  <h4>Wallet balances</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>currency</th>
                          <th>balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!walletEligibility?.wallet_enabled ? (
                          <tr><td colSpan="2">Wallet is hidden until the organization is ACTIVE.</td></tr>
                        ) : walletBalances.length === 0 ? (
                          <tr><td colSpan="2">No balances yet.</td></tr>
                        ) : walletBalances.map((balance) => (
                          <tr key={balance.currency}>
                            <td>{escapeText(balance.currency)}</td>
                            <td>{escapeText(balance.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </article>
          </section>
        );
      case 'mint':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Mint Requests</p>
                  <h3>Create liquidity request and track history</h3>
                </div>
              </div>

              <div className="split-panel">
                <form className="action-form" onSubmit={handleCreateMintRequest}>
                  <h4>Create mint request</h4>
                  <label><span>bank_id</span><input name="bank_id" value={mintForm.bank_id} onChange={updateForm(setMintForm)} placeholder="BANK001" /></label>
                  <label><span>currency</span><input name="currency" value={mintForm.currency} onChange={updateForm(setMintForm)} placeholder="USD" /></label>
                  <label><span>amount</span><input name="amount" value={mintForm.amount} onChange={updateForm(setMintForm)} placeholder="500000" /></label>
                  <label><span>notes</span><textarea name="reason" rows="3" value={mintForm.reason} onChange={updateForm(setMintForm)} placeholder="Treasury liquidity request" /></label>
                  {mintActionLockedReason ? <p className="form-helper-text">{mintActionLockedReason}</p> : null}
                  <button
                    className="primary-button full-width"
                    type="submit"
                    disabled={mintSubmitting}
                    title={mintActionLockedReason || 'Submit mint request'}
                  >
                    {mintSubmitting ? 'Submitting...' : 'Submit mint request'}
                  </button>
                </form>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>request_id</th>
                        <th>amount</th>
                        <th>currency</th>
                        <th>status</th>
                        <th>date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!walletEligibility?.wallet_enabled ? (
                        <tr><td colSpan="5">Minting is available only for ACTIVE organizations.</td></tr>
                      ) : mintRequests.length === 0 ? (
                        <tr><td colSpan="5">No mint requests yet.</td></tr>
                      ) : mintRequests.map((request) => (
                        <tr key={request.request_id}>
                          <td>{escapeText(request.request_id)}</td>
                          <td>{escapeText(request.amount)}</td>
                          <td>{escapeText(request.currency)}</td>
                          <td><StatusBadge status={request.status} /></td>
                          <td>{escapeText(request.requested_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          </section>
        );
      case 'settlement':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Settlements</p>
                  <h3>Send value to another bank and track progress</h3>
                </div>
              </div>

              <div className="split-panel">
                <form className="action-form" onSubmit={handleCreateSettlementRequest}>
                  <h4>Create settlement</h4>
                  <label><span>from_bank</span><input name="from_bank" value={settlementForm.from_bank} onChange={updateForm(setSettlementForm)} placeholder="BANK001" /></label>
                  <label><span>to_bank</span><input name="to_bank" value={settlementForm.to_bank} onChange={updateForm(setSettlementForm)} placeholder="BANK002" /></label>
                  <label><span>currency</span><input name="currency" value={settlementForm.currency} onChange={updateForm(setSettlementForm)} placeholder="USD" /></label>
                  <label><span>amount</span><input name="amount" value={settlementForm.amount} onChange={updateForm(setSettlementForm)} placeholder="10000" /></label>
                  <label><span>reference</span><input name="reference" value={settlementForm.reference} onChange={updateForm(setSettlementForm)} placeholder="INV-1001" /></label>
                  <label><span>purpose</span><textarea name="purpose" rows="3" value={settlementForm.purpose} onChange={updateForm(setSettlementForm)} placeholder="Treasury settlement" /></label>
                  {settlementPrecheck.checked_at ? (
                    <div className="info-banner">
                      <strong>Latest pre-check</strong>
                      <p>
                        validation: {settlementPrecheck.valid ? 'PASS' : 'FAIL'} | balance: {settlementPrecheck.sufficient ? 'PASS' : 'FAIL'} | duplicate: {settlementPrecheck.duplicate ? 'YES' : 'NO'}
                      </p>
                    </div>
                  ) : null}
                  <button className="primary-button full-width" type="submit" disabled={!walletEligibility?.wallet_enabled}>Create settlement</button>
                </form>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>settlement_id</th>
                        <th>to_bank</th>
                        <th>amount</th>
                        <th>status</th>
                        <th>time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!walletEligibility?.wallet_enabled ? (
                        <tr><td colSpan="5">Settlements are available only for ACTIVE organizations.</td></tr>
                      ) : settlementRequests.length === 0 ? (
                        <tr><td colSpan="5">No settlement requests yet.</td></tr>
                      ) : settlementRequests.map((settlement) => (
                        <tr key={settlement.settlement_id}>
                          <td>{escapeText(settlement.settlement_id)}</td>
                          <td>{escapeText(settlement.to_bank)}</td>
                          <td>{escapeText(settlement.amount)}</td>
                          <td><StatusBadge status={settlement.status} /></td>
                          <td>{escapeText(settlement.completed_at || settlement.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          </section>
        );
      case 'lookup':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Settlement Lookup</p>
                  <h3>Track and investigate one settlement</h3>
                </div>
              </div>

              <form className="action-form bank-lookup-form" onSubmit={handleSettlementLookup}>
                <label><span>bank_id</span><input value={selectedBankId} readOnly /></label>
                <label><span>settlement_id</span><input name="settlement_id" value={settlementLookupForm.settlement_id} onChange={updateForm(setSettlementLookupForm)} placeholder="SETTLEMENT-001" /></label>
                <button className="secondary-button" type="submit" disabled={!walletEligibility?.wallet_enabled}>Search</button>
              </form>

              <div className="detail-grid bank-status-grid">
                <div className="info-panel">
                  <h4>Status</h4>
                  <dl className="detail-list compact">
                    <DetailRow label="from_bank" value={selectedSettlementRecord?.from_bank} />
                    <DetailRow label="to_bank" value={selectedSettlementRecord?.to_bank} />
                    <DetailRow label="amount" value={selectedSettlementRecord?.amount} />
                    <DetailRow label="currency" value={selectedSettlementRecord?.currency} />
                    <DetailRow label="settlement_id" value={selectedSettlementStatus?.settlement_id} />
                    <DetailRow label="status" value={selectedSettlementStatus?.status} status />
                    <DetailRow label="current_status" value={selectedSettlementInvestigation?.current_status} status />
                    <DetailRow label="last_updated_at" value={selectedSettlementInvestigation?.last_updated_at} />
                  </dl>
                </div>

                <div className="info-panel settlement-investigation-panel">
                  <h4>Investigation</h4>
                  <dl className="detail-list compact">
                    <DetailRow label="stopped_at_step" value={selectedSettlementInvestigation?.stopped_at_step} />
                    <DetailRow label="pending_with" value={selectedSettlementInvestigation?.pending_with} />
                    <DetailRow label="reason" value={selectedSettlementInvestigation?.reason} />
                  </dl>
                  <div className="history-block">
                    <h4>Action history</h4>
                    <ul className="history-list">
                      {(selectedSettlementInvestigation?.action_history || []).length === 0 ? (
                        <li>No action history returned.</li>
                      ) : selectedSettlementInvestigation.action_history.map((entry, index) => (
                        <li key={`${entry.step || entry.status || entry.action}-${index}`}>
                          {escapeText(entry.step || entry.status || entry.action)} | {escapeText(entry.at || entry.timestamp || entry.time)} | {escapeText(entry.by || entry.actor || entry.pending_with)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </article>
          </section>
        );
      case 'profile':
      default:
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Profile</p>
                  <h3>Bank identity and eligibility</h3>
                </div>
              </div>

              <form className="action-form bank-lookup-form" onSubmit={handleBankLookup}>
                <label>
                  <span>bankId</span>
                  <input name="bankId" value={bankLookupForm.bankId} onChange={updateForm(setBankLookupForm)} placeholder="BANK001" />
                </label>
                <button className="primary-button" type="submit">
                  {bankLookupLoading ? 'Loading...' : 'Load profile'}
                </button>
              </form>

              <div className="detail-grid bank-status-grid">
                <div className="info-panel">
                  <h4>Bank details</h4>
                  <dl className="detail-list">
                    <DetailRow label="bank_id" value={bankProfile?.bank_id} />
                    <DetailRow label="bank_name" value={bankProfile?.bank_display_name} />
                    <DetailRow label="bic_swift_code" value={bankProfile?.bic_swift_code} />
                    <DetailRow label="country_code" value={bankProfile?.country_code} />
                    <DetailRow label="msp_id" value={bankProfile?.msp_id} />
                    <DetailRow label="status" value={bankProfile?.status} status />
                  </dl>
                </div>

                <div className="info-panel wallet-eligibility-panel">
                  <h4>Eligibility</h4>
                  <div className={`eligibility-banner ${walletEligibility?.wallet_enabled ? 'enabled' : 'disabled'}`}>
                    <strong>{walletEligibility?.wallet_enabled ? 'Wallet enabled' : 'Wallet unavailable'}</strong>
                    <p>{walletEligibility?.reason || 'Load a bank profile to evaluate eligibility.'}</p>
                  </div>
                  <dl className="detail-list compact">
                    <DetailRow label="bank_id" value={walletEligibility?.bank_id} />
                    <DetailRow label="status" value={walletEligibility?.status} status />
                    <DetailRow label="on_chain_active" value={walletEligibility?.on_chain_active ? 'true' : 'false'} />
                    <DetailRow label="wallet_enabled" value={walletEligibility?.wallet_enabled ? 'true' : 'false'} />
                  </dl>
                </div>
              </div>
            </article>
          </section>
        );
      case 'api':
        return (
          <section className="content-grid bank-grid">
            <article className="card detail-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">API Routes</p>
                  <h3>Backend endpoints visible in frontend</h3>
                </div>
                <button className="secondary-button" type="button" onClick={loadApiCatalog}>Refresh routes</button>
              </div>

              <div className="detail-grid bank-status-grid">
                <div className="info-panel">
                  <h4>Public APIs</h4>
                  <ul className="history-list">
                    {apiCatalog.public.length === 0 ? (
                      <li>No public routes loaded.</li>
                    ) : apiCatalog.public.map((route) => (
                      <li key={route}>{route}</li>
                    ))}
                  </ul>
                </div>

                <div className="info-panel">
                  <h4>Admin APIs</h4>
                  <ul className="history-list">
                    {apiCatalog.admin.length === 0 ? (
                      <li>No admin routes loaded.</li>
                    ) : apiCatalog.admin.map((route) => (
                      <li key={route}>{route}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          </section>
        );
    }
  }

  const navItems = [
    { key: 'application', label: 'Bank Application' },
    { key: 'profile', label: 'Profile' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'participants', label: 'Participants' },
    { key: 'wallet', label: 'Wallet' },
    { key: 'mint', label: 'Mint Requests' },
    { key: 'settlement', label: 'Settlements' },
    { key: 'lookup', label: 'Settlement Lookup' },
    { key: 'api', label: 'API Routes' }
  ];

  if (applicationRecord?.status === 'APPLIED' || applicationRecord?.status === 'UNDER_REVIEW') {
    return (
      <div className="app-shell pending-shell">
        <main className="main-content center-focus">
          <div className="promo-card">
            <span className="badge warning large">Registration Pending</span>
            <h2>Thank you for registering, {applicationRecord.legal_entity_name}</h2>
            <p className="promo-copy">
              Your application is currently being reviewed by BetweenNetwork administrators. 
              Once approved, your blockchain infrastructure will be automatically provisioned.
            </p>
            <div className="status-progress">
              <div className="step completed"><span>1</span> Signup</div>
              <div className="step active"><span>2</span> Admin Review</div>
              <div className="step pending"><span>3</span> Blockchain Provisioning</div>
              <div className="step pending"><span>4</span> Live Activation</div>
            </div>
            <button className="secondary-button" onClick={onBack}>Log Out</button>
          </div>
        </main>
      </div>
    );
  }

  if (applicationRecord?.status === 'APPROVED_PENDING_ACTIVATION') {
    return (
      <div className="app-shell pending-shell">
        <main className="main-content center-focus">
          <div className="promo-card">
            <span className="badge success large">Application Approved</span>
            <h2>Infrastructure Provisioning in Progress</h2>
            <p className="promo-copy">
              Your application has been accepted! BetweenNetwork is currently setting up your 
              dedicated Hyperledger Fabric node and joining your organization to the channel.
            </p>
            <div className="status-progress">
              <div className="step completed"><span>1</span> Signup</div>
              <div className="step completed"><span>2</span> Admin Review</div>
              <div className="step active"><span>3</span> Blockchain Provisioning</div>
              <div className="step pending"><span>4</span> Live Activation</div>
            </div>
            <div className="loader-block">
               <div className="spinner"></div>
               <p>Running automate.sh infrastructure scripts...</p>
            </div>
            <button className="secondary-button" onClick={onBack}>Log Out</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">BK</div>
          <div>
            <p className="eyebrow">Bank Operations</p>
            <h1>Bank Dashboard</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activeSection === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button className="secondary-button full-width dashboard-back" type="button" onClick={onBack}>
          Sign Out
        </button>

        <section className="network-panel">
          <p className="panel-label">Network status</p>
          <div className="network-status">
            <span className={`status-dot ${backendStatus.reachable ? 'success' : 'warning'}`}></span>
            <div>
              <strong>{backendStatus.reachable ? 'Backend connected' : 'Backend unreachable'}</strong>
              <p>{backendStatus.message}</p>
            </div>
          </div>
          <dl className="network-meta">
            <div><dt>Bank ID</dt><dd>{selectedBankId}</dd></div>
            <div><dt>Role</dt><dd>Operations</dd></div>
            <div><dt>API Base</dt><dd>{API_BASE}</dd></div>
            <div><dt>Contract</dt><dd>participant-chaincode</dd></div>
          </dl>
        </section>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operate -&gt; Transact -&gt; Track</p>
            <h2>{bankProfile?.bank_display_name || applicationRecord?.legal_entity_name} ({selectedBankId})</h2>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">
              <span className={`status-dot ${backendStatus.reachable ? 'success' : 'warning'}`}></span>
              <span>{backendStatus.reachable ? 'API connected' : 'API unreachable'}</span>
            </div>
            <div className="status-pill">
              <span className="status-dot warning"></span>
              <span>{bankAlerts.length} alerts</span>
            </div>
            <div className="status-pill">
              <span className="status-dot success"></span>
              <span>User role: {applicationRecord?.status}</span>
            </div>
          </div>
        </header>

        {flash ? (
          <div className="flash-message" data-tone={flash.tone}>
            {flash.message}
          </div>
        ) : null}

        {renderPage()}
      </main>
    </div>
  );
}
