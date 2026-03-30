import React, { useEffect, useState } from 'react';
import { API_BASE, STORAGE_KEYS, DetailRow, StatusBadge, escapeText, safeParse } from './common.jsx';

const EMPTY_REVIEW_FORM = { risk_review_notes: '' };
const EMPTY_AUTH_SIGNUP = {
  name: 'admin',
  password: '',
  msp_id: 'BetweenMSP',
  certificate: '',
  private_key: ''
};
const EMPTY_AUTH_LOGIN = {
  name: 'admin',
  password: ''
};
const EMPTY_REJECTION_FORM = { rejection_reason: '' };
const EMPTY_ACTION_FORM = { bankId: '', reason: '' };
const EMPTY_MINT_REJECTION_FORM = { requestId: '', rejection_reason: '' };
const EMPTY_DIRECT_ACTIVATION_FORM = {
  bank_id: '',
  bank_display_name: '',
  bic_swift_code: '',
  country_code: '',
  msp_id: '',
  supported_currencies: 'INR,USD',
  settlement_model: '',
  public_key_hash: '',
  certificate_thumbprint_hash: ''
};
const EMPTY_APPROVAL_FORM = {
  bank_id: '',
  bic_swift_code: '',
  country_code: '',
  msp_id: '',
  supported_currencies: 'INR,USD',
  settlement_model: '',
  public_key_hash: '',
  certificate_thumbprint_hash: '',
  enrollment_id: '',
  affiliation: '',
  bank_password: '',
  org_name: '',
  org_domain: '',
  peer_port: '',
  operations_port: '',
  channel_name: '',
  run_blockchain_org_onboarding: true
};

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toCompactKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^[A-Z0-9]+$/.test(raw) && !raw.includes(' ')) {
    const normalized = raw.replace(/[^A-Z0-9]/g, '');
    if (normalized.startsWith('BANK') && normalized.length > 4) {
      const suffix = normalized.slice(4);
      return `Bank${suffix.charAt(0)}${suffix.slice(1).toLowerCase()}`;
    }
  }

  return raw
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function buildApprovalAutofill(application) {
  const bankId = String(application?.bank_id || '').trim().toUpperCase();
  const legalName = String(application?.legal_entity_name || '').trim();
  const activationRequest = application?.internal_review_metadata?.activation_request || {};
  const orgKey = toCompactKey(bankId || legalName || 'Bank');
  const domainKey = toSlug(bankId || legalName || 'bank');

  return {
    bank_id: bankId,
    bic_swift_code: activationRequest.bic_swift_code || application?.bic_swift_code || '',
    country_code: activationRequest.country_code || application?.country_code || '',
    msp_id: activationRequest.msp_id || application?.msp_id || `${orgKey}MSP`,
    supported_currencies: Array.isArray(activationRequest.supported_currencies) && activationRequest.supported_currencies.length > 0
      ? activationRequest.supported_currencies.join(',')
      : 'INR,USD',
    settlement_model: activationRequest.settlement_model || '',
    public_key_hash: activationRequest.public_key_hash || '',
    certificate_thumbprint_hash: activationRequest.certificate_thumbprint_hash || '',
    enrollment_id: activationRequest.enrollment_id || bankId,
    affiliation: activationRequest.affiliation || `${domainKey}.department1`,
    bank_password: activationRequest.bank_password || '',
    org_name: activationRequest.org_name || legalName || orgKey,
    org_domain: activationRequest.org_domain || `${domainKey}.example.com`,
    peer_port: '',
    operations_port: '',
    channel_name: activationRequest.channel_name || 'betweennetwork',
    run_blockchain_org_onboarding: true
  };
}

function readStoredValue(key) {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

function removeStoredValue(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {}
}

export default function AdminDashboard({ onBack }) {
  const [activeSection, setActiveSection] = useState('applications');
  const [authTab, setAuthTab] = useState('login');
  const [token, setToken] = useState(readStoredValue(STORAGE_KEYS.token) || '');
  const [admin, setAdmin] = useState(safeParse(readStoredValue(STORAGE_KEYS.admin)));
  const [flash, setFlash] = useState(null);
  const [backendStatus, setBackendStatus] = useState({ reachable: null, message: 'Checking backend...' });
  const [apiCatalog, setApiCatalog] = useState({ public: [], admin: [] });
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [mintRequests, setMintRequests] = useState([]);
  const [pendingMintRequests, setPendingMintRequests] = useState([]);
  const [approvedMintRequests, setApprovedMintRequests] = useState([]);

  const [signupForm, setSignupForm] = useState(EMPTY_AUTH_SIGNUP);
  const [loginForm, setLoginForm] = useState(EMPTY_AUTH_LOGIN);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW_FORM);
  const [rejectForm, setRejectForm] = useState(EMPTY_REJECTION_FORM);
  const [suspendForm, setSuspendForm] = useState(EMPTY_ACTION_FORM);
  const [revokeForm, setRevokeForm] = useState(EMPTY_ACTION_FORM);
  const [reactivateForm, setReactivateForm] = useState(EMPTY_ACTION_FORM);
  const [mintRejectForm, setMintRejectForm] = useState(EMPTY_MINT_REJECTION_FORM);
  const [directActivationForm, setDirectActivationForm] = useState(EMPTY_DIRECT_ACTIVATION_FORM);
  const [approvalForm, setApprovalForm] = useState(EMPTY_APPROVAL_FORM);

  useEffect(() => {
    checkBackendHealth();
    loadApiCatalog();
  }, []);

  useEffect(() => {
    if (!token) return;
    loadAdminDashboard();
  }, [token]);

  useEffect(() => {
    if (!selectedApplication) return;

    setReviewForm({
      risk_review_notes: selectedApplication.risk_review_notes || ''
    });
    setDirectActivationForm({
      bank_id: selectedApplication.bank_id || '',
      bank_display_name: selectedApplication.legal_entity_name || '',
      bic_swift_code: selectedApplication.internal_review_metadata?.activation_request?.bic_swift_code || selectedApplication.bic_swift_code || '',
      country_code: selectedApplication.internal_review_metadata?.activation_request?.country_code || selectedApplication.country_code || '',
      msp_id: selectedApplication.internal_review_metadata?.activation_request?.msp_id || selectedApplication.msp_id || '',
      supported_currencies: (selectedApplication.internal_review_metadata?.activation_request?.supported_currencies || ['INR', 'USD']).join(','),
      settlement_model: selectedApplication.internal_review_metadata?.activation_request?.settlement_model || '',
      public_key_hash: selectedApplication.internal_review_metadata?.activation_request?.public_key_hash || '',
      certificate_thumbprint_hash: selectedApplication.internal_review_metadata?.activation_request?.certificate_thumbprint_hash || ''
    });
    setApprovalForm(buildApprovalAutofill(selectedApplication));

  }, [selectedApplication]);

  async function apiFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.auth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers,
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

  async function loadApplications() {
    const result = await apiFetch('/banks/applications');
    const rows = Array.isArray(result.data) ? result.data : [];
    setApplications(rows);
    const nextSelection = rows.find((item) => item.id === selectedApplication?.id) || rows[0] || null;
    if (!nextSelection) {
      setSelectedApplication(null);
      return;
    }

    await loadApplicationDetails(nextSelection.id, rows);
  }

  async function loadApplicationDetails(id, fallbackRows = applications) {
    const baseRecord = fallbackRows.find((item) => item.id === id) || null;

    try {
      const result = await apiFetch(`/banks/applications/${id}`);
      setSelectedApplication(result.data || baseRecord);
    } catch (error) {
      setSelectedApplication(baseRecord);
      showFlash(`Showing summary only: ${error.message}`, 'warning');
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

  async function loadChaincodeParticipants() {
    const result = await apiFetch('/admin/chaincode/participants', { auth: true });
    setParticipants(Array.isArray(result.data) ? result.data : []);
  }

  async function loadAuditLogs() {
    const result = await apiFetch('/admin/audit-logs', { auth: true });
    setAuditLogs(Array.isArray(result.data) ? result.data : []);
  }

  async function loadMintRequests() {
    const [allResult, pendingResult, approvedResult] = await Promise.all([
      apiFetch('/admin/mint-requests', { auth: true }),
      apiFetch('/admin/mint-requests/pending', { auth: true }),
      apiFetch('/admin/mint-requests/approved', { auth: true })
    ]);

    setMintRequests(Array.isArray(allResult.data) ? allResult.data : []);
    setPendingMintRequests(Array.isArray(pendingResult.data) ? pendingResult.data : []);
    setApprovedMintRequests(Array.isArray(approvedResult.data) ? approvedResult.data : []);
  }

  async function loadAdminDashboard() {
    try {
      await Promise.all([
        loadApplications(),
        loadChaincodeParticipants(),
        loadMintRequests(),
        loadAuditLogs()
      ]);
    } catch (error) {
      showFlash(`Failed to load admin dashboard: ${error.message}`, 'danger');
    }
  }

  async function completeLogin(result, successMessage) {
    setToken(result.data.token);
    setAdmin(result.data.admin);
    writeStoredValue(STORAGE_KEYS.token, result.data.token);
    writeStoredValue(STORAGE_KEYS.admin, JSON.stringify(result.data.admin));
    setAuthTab('login');
    setActiveSection('applications');
    showFlash(successMessage, 'success');
  }

  async function handleSignup(event) {
    event.preventDefault();

    try {
      await apiFetch('/admin/signup', {
        method: 'POST',
        body: {
          ...signupForm,
          certificate: signupForm.certificate || null,
          private_key: signupForm.private_key || null
        }
      });

      const loginResult = await apiFetch('/admin/login', {
        method: 'POST',
        body: {
          name: signupForm.name,
          password: signupForm.password
        }
      });

      setSignupForm(EMPTY_AUTH_SIGNUP);
      await completeLogin(loginResult, 'Admin account created and logged in.');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleLogin(event) {
    event.preventDefault();

    try {
      const result = await apiFetch('/admin/login', {
        method: 'POST',
        body: loginForm
      });

      await completeLogin(result, result.message || 'Login successful.');
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  function handleLogout() {
    setToken('');
    setAdmin(null);
    setApplications([]);
    setSelectedApplication(null);
    setParticipants([]);
    setAuditLogs([]);
    setMintRequests([]);
    setPendingMintRequests([]);
    setApprovedMintRequests([]);
    removeStoredValue(STORAGE_KEYS.token);
    removeStoredValue(STORAGE_KEYS.admin);
    showFlash('Logged out.', 'success');
  }

  async function handleReview(event) {
    event.preventDefault();
    if (!selectedApplication || !token) {
      showFlash('Select an application and log in first.', 'warning');
      return;
    }

    try {
      await apiFetch(`/admin/applications/${selectedApplication.id}/review`, {
        method: 'POST',
        auth: true,
        body: reviewForm
      });
      showFlash('Application reviewed.', 'success');
      await Promise.all([loadApplications(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleApprove(event) {
    event.preventDefault();
    if (!selectedApplication || !token) {
      showFlash('Select an application and log in first.', 'warning');
      return;
    }

    const requiredFields = [
      'bic_swift_code',
      'country_code',
      'msp_id',
      'public_key_hash',
      'certificate_thumbprint_hash'
    ];
    const missingField = requiredFields.find((field) => !String(approvalForm[field] || '').trim());
    if (missingField) {
      showFlash(`Fill ${missingField} before approving the application.`, 'warning');
      return;
    }

    try {
      const result = await apiFetch(`/admin/applications/${selectedApplication.id}/approve`, {
        method: 'POST',
        auth: true,
        body: {
          bank_id: approvalForm.bank_id || selectedApplication.bank_id,
          bic_swift_code: approvalForm.bic_swift_code,
          country_code: approvalForm.country_code,
          msp_id: approvalForm.msp_id,
          supported_currencies: approvalForm.supported_currencies,
          settlement_model: approvalForm.settlement_model || null,
          public_key_hash: approvalForm.public_key_hash,
          certificate_thumbprint_hash: approvalForm.certificate_thumbprint_hash,
          enrollment_id: approvalForm.enrollment_id || selectedApplication.bank_id,
          affiliation: approvalForm.affiliation || null,
          bank_password: approvalForm.bank_password || null,
          org_name: approvalForm.org_name || null,
          org_domain: approvalForm.org_domain || null,
          peer_port: null,
          operations_port: null,
          channel_name: approvalForm.channel_name || null,
          run_blockchain_org_onboarding: approvalForm.run_blockchain_org_onboarding
        }
      });
      const onboardingSuccess = result.data?.orgOnboarding?.success !== false;
      showFlash(
        result.message || (onboardingSuccess ? 'Application approved and activated.' : 'Application approved, but org onboarding needs attention.'),
        onboardingSuccess ? 'success' : 'warning'
      );
      await Promise.all([loadApplications(), loadChaincodeParticipants(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleReject(event) {
    event.preventDefault();
    if (!selectedApplication || !token) {
      showFlash('Select an application and log in first.', 'warning');
      return;
    }

    try {
      await apiFetch(`/admin/applications/${selectedApplication.id}/reject`, {
        method: 'POST',
        auth: true,
        body: rejectForm
      });
      showFlash('Application rejected.', 'success');
      await Promise.all([loadApplications(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleParticipantAction(event, action, formState, reset) {
    event.preventDefault();
    if (!token) {
      showFlash('Login as BetweenNetwork admin first.', 'warning');
      return;
    }

    try {
      await apiFetch(`/admin/participants/${encodeURIComponent(String(formState.bankId || '').trim().toUpperCase())}/${action}`, {
        method: 'POST',
        auth: true,
        body: { reason: formState.reason }
      });
      showFlash(`Participant ${action} request sent.`, 'success');
      reset(EMPTY_ACTION_FORM);
      await Promise.all([loadChaincodeParticipants(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleApproveMintRequest(requestId) {
    if (!token) {
      showFlash('Login as BetweenNetwork admin first.', 'warning');
      return;
    }

    try {
      await apiFetch(`/admin/mint-requests/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        auth: true
      });
      showFlash('Mint request approved.', 'success');
      await Promise.all([loadMintRequests(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleRejectMintRequest(event) {
    event.preventDefault();
    if (!token) {
      showFlash('Login as BetweenNetwork admin first.', 'warning');
      return;
    }

    try {
      await apiFetch(`/admin/mint-requests/${encodeURIComponent(mintRejectForm.requestId)}/reject`, {
        method: 'POST',
        auth: true,
        body: {
          rejection_reason: mintRejectForm.rejection_reason
        }
      });
      showFlash('Mint request rejected.', 'success');
      setMintRejectForm(EMPTY_MINT_REJECTION_FORM);
      await Promise.all([loadMintRequests(), loadAuditLogs()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  async function handleDirectActivation(event) {
    event.preventDefault();
    if (!token) {
      showFlash('Login as BetweenNetwork admin first.', 'warning');
      return;
    }

    try {
      await apiFetch('/admin/chaincode/participants/activate', {
        method: 'POST',
        auth: true,
        body: {
          ...directActivationForm,
          bank_id: String(directActivationForm.bank_id || '').trim().toUpperCase(),
          bic_swift_code: String(directActivationForm.bic_swift_code || '').trim().toUpperCase(),
          country_code: String(directActivationForm.country_code || '').trim().toUpperCase(),
          supported_currencies: String(directActivationForm.supported_currencies || '')
            .split(',')
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean)
        }
      });
      showFlash('Direct chaincode activation completed.', 'success');
      await Promise.all([loadChaincodeParticipants(), loadAuditLogs(), loadApplications()]);
    } catch (error) {
      showFlash(error.message, 'danger');
    }
  }

  function updateField(setter) {
    return (event) => {
      const { name, value, type, checked } = event.target;
      setter((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    };
  }

  function handleAutofillApproval() {
    if (!selectedApplication) return;
    setApprovalForm(buildApprovalAutofill(selectedApplication));
    showFlash('Non-sensitive approval fields were autofilled from bank name and bank ID.', 'success');
  }

  function renderAuthedPage() {
    if (activeSection === 'mint') {
      return (
        <section className="content-grid">
          <article className="card participant-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Mint Requests</p>
                <h3>Approve or reject mint requests only</h3>
              </div>
              <button className="secondary-button" type="button" onClick={loadMintRequests}>Refresh mint queue</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>request_id</th>
                    <th>bank_id</th>
                    <th>currency</th>
                    <th>amount</th>
                    <th>status</th>
                    <th>requested_at</th>
                    <th>action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMintRequests.length === 0 ? (
                    <tr><td colSpan="7">No pending mint requests.</td></tr>
                  ) : pendingMintRequests.map((request) => (
                    <tr key={request.request_id}>
                      <td>{escapeText(request.request_id)}</td>
                      <td>{escapeText(request.bank_id)}</td>
                      <td>{escapeText(request.currency)}</td>
                      <td>{escapeText(request.amount)}</td>
                      <td><StatusBadge status={request.status} /></td>
                      <td>{escapeText(request.requested_at)}</td>
                      <td>
                        <button className="success-button" type="button" onClick={() => handleApproveMintRequest(request.request_id)}>Approve</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form className="action-form" onSubmit={handleRejectMintRequest}>
              <h4>Reject mint request</h4>
              <label><span>requestId</span><input name="requestId" value={mintRejectForm.requestId} onChange={updateField(setMintRejectForm)} placeholder="Mint request id" /></label>
              <label>
                <span>rejection_reason</span>
                <textarea name="rejection_reason" rows="3" value={mintRejectForm.rejection_reason} onChange={updateField(setMintRejectForm)} placeholder="Reason for rejection" />
              </label>
              <button className="danger-button full-width" type="submit">Reject mint request</button>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>request_id</th>
                    <th>bank_id</th>
                    <th>currency</th>
                    <th>amount</th>
                    <th>status</th>
                    <th>reviewed_at</th>
                  </tr>
                </thead>
                <tbody>
                  {mintRequests.length === 0 ? (
                    <tr><td colSpan="6">No mint requests available.</td></tr>
                  ) : mintRequests.map((request) => (
                    <tr key={request.request_id}>
                      <td>{escapeText(request.request_id)}</td>
                      <td>{escapeText(request.bank_id)}</td>
                      <td>{escapeText(request.currency)}</td>
                      <td>{escapeText(request.amount)}</td>
                      <td><StatusBadge status={request.status} /></td>
                      <td>{escapeText(request.reviewed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>request_id</th>
                    <th>bank_id</th>
                    <th>currency</th>
                    <th>amount</th>
                    <th>approved_at</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedMintRequests.length === 0 ? (
                    <tr><td colSpan="5">No approved mint history.</td></tr>
                  ) : approvedMintRequests.map((request) => (
                    <tr key={request.request_id}>
                      <td>{escapeText(request.request_id)}</td>
                      <td>{escapeText(request.bank_id)}</td>
                      <td>{escapeText(request.currency)}</td>
                      <td>{escapeText(request.amount)}</td>
                      <td>{escapeText(request.reviewed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      );
    }

    if (activeSection === 'participants') {
      return (
        <section className="content-grid">
          <article className="card participant-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Participants</p>
                <h3>Participant admin controls only</h3>
              </div>
              <button className="secondary-button" type="button" onClick={loadChaincodeParticipants}>Refresh participants</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>bank_id</th>
                    <th>bank_display_name</th>
                    <th>bic_swift_code</th>
                    <th>country_code</th>
                    <th>msp_id</th>
                    <th>status</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.length === 0 ? (
                    <tr><td colSpan="6">No chaincode participants available.</td></tr>
                  ) : participants.map((participant) => (
                    <tr key={`${participant.bank_id || participant.bankId}-${participant.msp_id || participant.mspId}`}>
                      <td>{escapeText(participant.bank_id || participant.bankId)}</td>
                      <td>{escapeText(participant.bank_display_name || participant.bankDisplayName)}</td>
                      <td>{escapeText(participant.bic_swift_code || participant.bicSwiftCode)}</td>
                      <td>{escapeText(participant.country_code || participant.countryCode)}</td>
                      <td>{escapeText(participant.msp_id || participant.mspId)}</td>
                      <td><StatusBadge status={participant.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="split-panel">
              <form className="action-form" onSubmit={(event) => handleParticipantAction(event, 'suspend', suspendForm, setSuspendForm)}>
                <h4>Suspend participant</h4>
                <label><span>bankId</span><input name="bankId" value={suspendForm.bankId} onChange={updateField(setSuspendForm)} placeholder="BANK001" /></label>
                <label><span>reason</span><textarea name="reason" rows="3" value={suspendForm.reason} onChange={updateField(setSuspendForm)} placeholder="Temporary compliance hold" /></label>
                <button className="secondary-button full-width" type="submit">Suspend</button>
              </form>

              <form className="action-form" onSubmit={(event) => handleParticipantAction(event, 'revoke', revokeForm, setRevokeForm)}>
                <h4>Revoke participant</h4>
                <label><span>bankId</span><input name="bankId" value={revokeForm.bankId} onChange={updateField(setRevokeForm)} placeholder="BANK001" /></label>
                <label><span>reason</span><textarea name="reason" rows="3" value={revokeForm.reason} onChange={updateField(setRevokeForm)} placeholder="Regulatory breach" /></label>
                <button className="danger-button full-width" type="submit">Revoke</button>
              </form>

              <form className="action-form" onSubmit={(event) => handleParticipantAction(event, 'reactivate', reactivateForm, setReactivateForm)}>
                <h4>Reactivate participant</h4>
                <label><span>bankId</span><input name="bankId" value={reactivateForm.bankId} onChange={updateField(setReactivateForm)} placeholder="BANK001" /></label>
                <label><span>reason</span><textarea name="reason" rows="3" value={reactivateForm.reason} onChange={updateField(setReactivateForm)} placeholder="Controls restored" /></label>
                <button className="success-button full-width" type="submit">Reactivate</button>
              </form>
            </div>

            <form className="action-form" onSubmit={handleDirectActivation}>
              <h4>Direct chaincode activation</h4>
              <p className="panel-copy">Uses the new admin activation API and writes directly through chaincode.</p>
              <div className="application-form-grid">
                <label><span>bank_id</span><input name="bank_id" value={directActivationForm.bank_id} onChange={updateField(setDirectActivationForm)} placeholder="BANK001" /></label>
                <label><span>bank_display_name</span><input name="bank_display_name" value={directActivationForm.bank_display_name} onChange={updateField(setDirectActivationForm)} placeholder="Global First Bank" /></label>
                <label><span>bic_swift_code</span><input name="bic_swift_code" value={directActivationForm.bic_swift_code} onChange={updateField(setDirectActivationForm)} placeholder="ABCDINBBXXX" /></label>
                <label><span>country_code</span><input name="country_code" value={directActivationForm.country_code} onChange={updateField(setDirectActivationForm)} placeholder="IN" /></label>
                <label><span>msp_id</span><input name="msp_id" value={directActivationForm.msp_id} onChange={updateField(setDirectActivationForm)} placeholder="Bank1MSP" /></label>
                <label><span>supported_currencies</span><input name="supported_currencies" value={directActivationForm.supported_currencies} onChange={updateField(setDirectActivationForm)} placeholder="INR,USD" /></label>
                <label><span>settlement_model</span><input name="settlement_model" value={directActivationForm.settlement_model} onChange={updateField(setDirectActivationForm)} placeholder="RTGS" /></label>
                <label><span>public_key_hash</span><input name="public_key_hash" value={directActivationForm.public_key_hash} onChange={updateField(setDirectActivationForm)} placeholder="sha256..." /></label>
              </div>
              <label><span>certificate_thumbprint_hash</span><input name="certificate_thumbprint_hash" value={directActivationForm.certificate_thumbprint_hash} onChange={updateField(setDirectActivationForm)} placeholder="sha256..." /></label>
              <button className="primary-button full-width" type="submit">Activate directly via chaincode</button>
            </form>
          </article>
        </section>
      );
    }

    if (activeSection === 'audit') {
      return (
        <section className="content-grid">
          <article className="card audit-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Audit Logs</p>
                <h3>Recent admin events</h3>
              </div>
              <button className="secondary-button" type="button" onClick={loadAuditLogs}>Refresh audit logs</button>
            </div>

            <div className="audit-list">
              {auditLogs.length === 0 ? (
                <p>No audit logs available.</p>
              ) : auditLogs.map((log) => (
                <article key={log.id} className="info-panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">{escapeText(log.entity_type)}</p>
                      <h4>{escapeText(log.action)}</h4>
                    </div>
                    <StatusBadge status={log.new_status || 'RECORDED'} />
                  </div>
                  <dl className="detail-list compact">
                    <DetailRow label="entity_id" value={log.entity_id} />
                    <DetailRow label="admin_id" value={log.admin_id} />
                    <DetailRow label="old_status" value={log.old_status} status />
                    <DetailRow label="new_status" value={log.new_status} status />
                    <DetailRow label="created_at" value={log.created_at} />
                    <DetailRow label="details" value={typeof log.details === 'string' ? log.details : JSON.stringify(log.details)} />
                  </dl>
                </article>
              ))}
            </div>
          </article>
        </section>
      );
    }

    if (activeSection === 'api') {
      return (
        <section className="content-grid">
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

    const appliedCount = applications.filter((application) => application.status === 'APPLIED').length;
    const reviewCount = applications.filter((application) => application.status === 'UNDER_REVIEW').length;
    const activeCount = applications.filter((application) => application.status === 'ACTIVE').length;
    const activationRequestAvailable = Boolean(selectedApplication?.internal_review_metadata?.activation_request);

    return (
      <>
        <section className="kpi-grid">
          <article className="card kpi-card">
            <p className="kpi-label">Applications loaded</p>
            <div className="kpi-row"><strong>{applications.length}</strong><span className="badge success">Live</span></div>
            <p className="kpi-note">Bank applications only.</p>
          </article>
          <article className="card kpi-card">
            <p className="kpi-label">Pending mint requests</p>
            <div className="kpi-row"><strong>{pendingMintRequests.length}</strong><span className="badge warning">Review</span></div>
            <p className="kpi-note">Settlement review removed.</p>
          </article>
          <article className="card kpi-card">
            <p className="kpi-label">Participants</p>
            <div className="kpi-row"><strong>{participants.length}</strong><span className="badge success">Live</span></div>
            <p className="kpi-note">Suspend, revoke, reactivate.</p>
          </article>
          <article className="card kpi-card">
            <p className="kpi-label">Audit logs</p>
            <div className="kpi-row"><strong>{auditLogs.length}</strong><span className="badge neutral">History</span></div>
            <p className="kpi-note">Recent admin activity.</p>
          </article>
        </section>

        <section className="application-lane">
          <article className="card table-card application-queue-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Applications</p>
                <h3>First application review queue</h3>
              </div>
              <button className="secondary-button" type="button" onClick={loadApplications}>Refresh applications</button>
            </div>

            <div className="application-status-strip">
              <div className="status-chip">
                <strong>{applications.length}</strong>
                <span>Total</span>
              </div>
              <div className="status-chip">
                <strong>{appliedCount}</strong>
                <span>Applied</span>
              </div>
              <div className="status-chip">
                <strong>{reviewCount}</strong>
                <span>Under review</span>
              </div>
              <div className="status-chip">
                <strong>{activeCount}</strong>
                <span>Active</span>
              </div>
            </div>

            <div className="application-queue-list">
              {applications.length === 0 ? (
                <div className="info-panel">
                  <h4>No applications available</h4>
                  <p className="panel-copy">New first-stage bank applications will appear here for review or rejection.</p>
                </div>
              ) : applications.map((application) => (
                <button
                  key={application.id}
                  className={`application-list-card ${selectedApplication?.id === application.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => loadApplicationDetails(application.id)}
                >
                  <div className="application-list-head">
                    <div>
                      <p className="eyebrow">{escapeText(application.bank_id)}</p>
                      <h4>{escapeText(application.legal_entity_name)}</h4>
                    </div>
                    <StatusBadge status={application.status} />
                  </div>

                  <div className="application-list-meta">
                    <span>{escapeText(application.license_number)}</span>
                    <span>{escapeText(application.regulator_name)}</span>
                  </div>

                  <dl className="application-list-grid">
                    <div>
                      <dt>BIC</dt>
                      <dd>{escapeText(application.internal_review_metadata?.activation_request?.bic_swift_code || application.bic_swift_code)}</dd>
                    </div>
                    <div>
                      <dt>Country</dt>
                      <dd>{escapeText(application.internal_review_metadata?.activation_request?.country_code || application.country_code)}</dd>
                    </div>
                    <div>
                      <dt>MSP</dt>
                      <dd>{escapeText(application.internal_review_metadata?.activation_request?.msp_id || application.msp_id)}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{escapeText(application.updated_at || application.created_at)}</dd>
                    </div>
                  </dl>
                </button>
              ))}
            </div>
          </article>

          <article className="card detail-card application-review-card">
            <div className="workspace-banner">
              <div>
                <p className="eyebrow">Admin Inspector</p>
                <h3>Review Workspace</h3>
                <p className="panel-copy">
                  Select an application from the left queue to inspect the full record, metadata, and approval controls here.
                </p>
              </div>
              <span className="badge neutral">Detail Pane</span>
            </div>

            {!selectedApplication ? (
              <div className="workspace-empty-state">
                <strong>No application selected</strong>
                <p>Choose a bank from the application queue to open its full review workspace.</p>
              </div>
            ) : (
              <>
                <div className="section-head workspace-title-row">
                  <div>
                    <p className="eyebrow">Selected Application</p>
                    <h3>{selectedApplication.legal_entity_name || 'Unnamed application'}</h3>
                    <p className="panel-copy">
                      {escapeText(selectedApplication.bank_id)} • {escapeText(selectedApplication.email)}
                    </p>
                  </div>
                  <StatusBadge status={selectedApplication.status} />
                </div>

                <div className="application-summary-grid">
                  <div className="info-panel">
                    <h4>Application details</h4>
                    <dl className="detail-list compact">
                      <DetailRow label="id" value={selectedApplication?.id} />
                      <DetailRow label="bank_id" value={selectedApplication?.bank_id} />
                      <DetailRow label="email" value={selectedApplication?.email} />
                      <DetailRow label="legal_entity_name" value={selectedApplication?.legal_entity_name} />
                      <DetailRow label="registered_address" value={selectedApplication?.registered_address} />
                      <DetailRow label="license_number" value={selectedApplication?.license_number} />
                      <DetailRow label="regulator_name" value={selectedApplication?.regulator_name} />
                      <DetailRow label="webhook_url" value={selectedApplication?.webhook_url} />
                      <DetailRow label="ip_allowlist" value={selectedApplication?.ip_allowlist} />
                      <DetailRow label="status" value={selectedApplication?.status} status />
                      <DetailRow label="blockchain_onboarding_status" value={selectedApplication?.blockchain_onboarding_status} status />
                      <DetailRow label="wallet_delivery_status" value={selectedApplication?.wallet_delivery_status} />
                      <DetailRow label="applied_at" value={selectedApplication?.applied_at} />
                      <DetailRow label="reviewed_at" value={selectedApplication?.reviewed_at} />
                      <DetailRow label="approved_at" value={selectedApplication?.approved_at} />
                      <DetailRow label="rejected_at" value={selectedApplication?.rejected_at} />
                    </dl>
                  </div>

                  <div className="info-panel">
                    <h4>Second application snapshot</h4>
                    <dl className="detail-list compact">
                      <DetailRow label="bic_swift_code" value={selectedApplication?.internal_review_metadata?.activation_request?.bic_swift_code} />
                      <DetailRow label="country_code" value={selectedApplication?.internal_review_metadata?.activation_request?.country_code} />
                      <DetailRow label="msp_id" value={selectedApplication?.internal_review_metadata?.activation_request?.msp_id} />
                      <DetailRow label="enrollment_id" value={selectedApplication?.internal_review_metadata?.activation_request?.enrollment_id} />
                      <DetailRow label="affiliation" value={selectedApplication?.internal_review_metadata?.activation_request?.affiliation} />
                      <DetailRow label="org_name" value={selectedApplication?.internal_review_metadata?.activation_request?.org_name} />
                      <DetailRow label="org_domain" value={selectedApplication?.internal_review_metadata?.activation_request?.org_domain} />
                      <DetailRow label="channel_name" value={selectedApplication?.internal_review_metadata?.activation_request?.channel_name} />
                      <DetailRow label="review_notes" value={selectedApplication?.risk_review_notes} />
                    </dl>
                  </div>
                </div>

                <div className="application-summary-grid">
                  <div className="info-panel">
                    <h4>Internal review metadata</h4>
                    <pre className="json-panel">
                      {selectedApplication?.internal_review_metadata
                        ? JSON.stringify(selectedApplication.internal_review_metadata, null, 2)
                        : '-'}
                    </pre>
                  </div>

                  <div className="info-panel">
                    <h4>Blockchain org metadata</h4>
                    <pre className="json-panel">
                      {selectedApplication?.blockchain_org_metadata
                        ? JSON.stringify(selectedApplication.blockchain_org_metadata, null, 2)
                        : '-'}
                    </pre>
                  </div>
                </div>

                <div className="application-highlight-bar">
                  <div>
                    <span className="application-highlight-label">Wallet delivery</span>
                    <strong>{escapeText(selectedApplication?.wallet_delivery_status || 'PENDING')}</strong>
                  </div>
                  <div>
                    <span className="application-highlight-label">Second application</span>
                    <strong>{activationRequestAvailable ? 'Submitted by bank' : 'Waiting for first-stage review'}</strong>
                  </div>
                  <div>
                    <span className="application-highlight-label">Reviewed at</span>
                    <strong>{escapeText(selectedApplication?.reviewed_at)}</strong>
                  </div>
                </div>

                <div className="application-action-grid">
                  <div className="form-stack">
                    <form className="action-form compact-panel" onSubmit={handleReview}>
                      <h4>Approve first application for second step</h4>
                      <p className="panel-copy">Review the first application here. Once accepted, the bank can submit the second application with blockchain and network details.</p>
                      <label>
                        <span>risk_review_notes</span>
                        <textarea name="risk_review_notes" rows="4" value={reviewForm.risk_review_notes} onChange={updateField(setReviewForm)} placeholder="Add review notes" />
                      </label>
                      <button className="secondary-button full-width" type="submit">Approve first application</button>
                    </form>

                    <form className="action-form compact-panel" onSubmit={handleReject}>
                      <h4>Reject first application</h4>
                      <p className="panel-copy">Use this if the first application fails business or compliance review.</p>
                      <label>
                        <span>rejection_reason</span>
                        <textarea name="rejection_reason" rows="4" value={rejectForm.rejection_reason} onChange={updateField(setRejectForm)} placeholder="Reason for rejection" />
                      </label>
                      <button className="danger-button full-width" type="submit">Reject first application</button>
                    </form>
                  </div>

                  <form className="action-form application-approval-form" onSubmit={handleApprove}>
                <h4>Final approval and activation</h4>
                <p className="panel-copy">The admin can now review, edit, or complete the approval payload directly here. Non-sensitive identity and onboarding fields are autofilled from the bank name and bank ID. Peer and operations ports are now assigned automatically for new banks so they stay unique and collision-free.</p>
                <button className="secondary-button" type="button" onClick={handleAutofillApproval}>Autofill non-sensitive fields</button>
                <div className="application-form-grid">
                  <label><span>bank_id</span><input name="bank_id" value={approvalForm.bank_id} onChange={updateField(setApprovalForm)} readOnly /></label>
                  <label><span>bic_swift_code</span><input name="bic_swift_code" value={approvalForm.bic_swift_code} onChange={updateField(setApprovalForm)} placeholder="ABCDINBBXXX" /></label>
                  <label><span>country_code</span><input name="country_code" value={approvalForm.country_code} onChange={updateField(setApprovalForm)} placeholder="IN" maxLength="2" /></label>
                  <label><span>msp_id</span><input name="msp_id" value={approvalForm.msp_id} onChange={updateField(setApprovalForm)} placeholder="Bank1MSP" /></label>
                  <label><span>supported_currencies</span><input name="supported_currencies" value={approvalForm.supported_currencies} onChange={updateField(setApprovalForm)} placeholder="INR,USD" /></label>
                  <label><span>settlement_model</span><input name="settlement_model" value={approvalForm.settlement_model} onChange={updateField(setApprovalForm)} placeholder="RTGS" /></label>
                  <label><span>public_key_hash</span><input name="public_key_hash" value={approvalForm.public_key_hash} onChange={updateField(setApprovalForm)} placeholder="sha256..." /></label>
                  <label><span>certificate_thumbprint_hash</span><input name="certificate_thumbprint_hash" value={approvalForm.certificate_thumbprint_hash} onChange={updateField(setApprovalForm)} placeholder="sha256..." /></label>
                  <label><span>enrollment_id</span><input name="enrollment_id" value={approvalForm.enrollment_id} onChange={updateField(setApprovalForm)} placeholder="BANK001" /></label>
                  <label><span>affiliation</span><input name="affiliation" value={approvalForm.affiliation} onChange={updateField(setApprovalForm)} placeholder="org1.department1" /></label>
                  <label><span>bank_password</span><input name="bank_password" type="password" value={approvalForm.bank_password} onChange={updateField(setApprovalForm)} placeholder="Optional enrollment secret" /></label>
                  <label><span>org_name</span><input name="org_name" value={approvalForm.org_name} onChange={updateField(setApprovalForm)} placeholder="Bank One Org" /></label>
                  <label><span>org_domain</span><input name="org_domain" value={approvalForm.org_domain} onChange={updateField(setApprovalForm)} placeholder="bank1.example.com" /></label>
                  <label><span>channel_name</span><input name="channel_name" value={approvalForm.channel_name} onChange={updateField(setApprovalForm)} placeholder="betweennetwork" /></label>
                </div>
                <label>
                  <span>run_blockchain_org_onboarding</span>
                  <input
                    name="run_blockchain_org_onboarding"
                    type="checkbox"
                    checked={approvalForm.run_blockchain_org_onboarding}
                    onChange={updateField(setApprovalForm)}
                  />
                </label>
                <p className="panel-copy">
                  {activationRequestAvailable
                    ? 'Second-step bank details were detected and prefilled. Ports will be auto-assigned for new banks and reused automatically for existing org reruns.'
                    : 'No second-step bank details were found, so admin-entered values will be used for final approval. Ports will still be allocated automatically.'}
                </p>
                <button className="success-button full-width" type="submit">Approve and activate</button>
                  </form>
                </div>
              </>
            )}
          </article>
        </section>
      </>
    );
  }

  if (!token || !admin) {
    return (
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <div className="brand-mark">AD</div>
            <div>
              <p className="eyebrow">BetweenMSP</p>
              <h1>Admin Access</h1>
            </div>
          </div>

          <nav className="nav-list">
            <button className="nav-item active" type="button">Admin login</button>
          </nav>

          <button className="secondary-button full-width dashboard-back" type="button" onClick={onBack}>
            Back to dashboard chooser
          </button>

          <section className="network-panel">
            <p className="panel-label">Admin only</p>
            <div className="network-status">
              <span className={`status-dot ${backendStatus.reachable ? 'success' : 'warning'}`}></span>
              <div>
                <strong>{backendStatus.reachable ? 'Backend connected' : 'Backend unreachable'}</strong>
                <p>{backendStatus.message}</p>
              </div>
            </div>
            <dl className="network-meta">
              <div><dt>API Base</dt><dd>{API_BASE}</dd></div>
            </dl>
          </section>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div>
              <p className="eyebrow">Admin Only</p>
              <h2>Login or create the BetweenNetwork admin account to enter the dashboard.</h2>
            </div>
          </header>

          {flash ? (
            <div className="flash-message" data-tone={flash.tone}>
              {flash.message}
            </div>
          ) : null}

          <section className="content-grid">
            <article className="card auth-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Admin Access</p>
                  <h3>First page: signup and login only</h3>
                </div>
                <span className="badge neutral">Admin only</span>
              </div>

              <div className="tab-row">
                <button className={`tab-button ${authTab === 'login' ? 'active' : ''}`} type="button" onClick={() => setAuthTab('login')}>Log in</button>
                <button className={`tab-button ${authTab === 'signup' ? 'active' : ''}`} type="button" onClick={() => setAuthTab('signup')}>Sign up</button>
              </div>

              {authTab === 'login' ? (
                <form className="auth-form active" onSubmit={handleLogin}>
                  <label><span>name</span><input name="name" value={loginForm.name} onChange={updateField(setLoginForm)} placeholder="admin" /></label>
                  <label><span>password</span><input type="password" name="password" value={loginForm.password} onChange={updateField(setLoginForm)} placeholder="Enter password" /></label>
                  <button className="primary-button full-width" type="submit">Login to admin dashboard</button>
                </form>
              ) : (
                <form className="auth-form active" onSubmit={handleSignup}>
                  <label><span>name</span><input name="name" value={signupForm.name} onChange={updateField(setSignupForm)} placeholder="admin" /></label>
                  <label><span>password</span><input type="password" name="password" value={signupForm.password} onChange={updateField(setSignupForm)} placeholder="Minimum 8 characters" /></label>
                  <label><span>msp_id</span><input name="msp_id" value={signupForm.msp_id} onChange={updateField(setSignupForm)} /></label>
                  <label><span>certificate</span><textarea name="certificate" rows="4" value={signupForm.certificate} onChange={updateField(setSignupForm)} placeholder="Optional X.509 certificate" /></label>
                  <label><span>private_key</span><textarea name="private_key" rows="4" value={signupForm.private_key} onChange={updateField(setSignupForm)} placeholder="Optional private key" /></label>
                  <button className="primary-button full-width" type="submit">Create admin and open dashboard</button>
                </form>
              )}
            </article>
          </section>
        </main>
      </div>
    );
  }

  const navItems = [
    { key: 'applications', label: 'Applications' },
    { key: 'mint', label: 'Mint Requests' },
    { key: 'participants', label: 'Participants' },
    { key: 'audit', label: 'Audit Logs' },
    { key: 'api', label: 'API Routes' }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">AD</div>
          <div>
            <p className="eyebrow">BetweenMSP</p>
            <h1>Admin Dashboard</h1>
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

        <button className="secondary-button full-width" type="button" onClick={handleLogout}>
          Logout
        </button>
        <button className="secondary-button full-width dashboard-back" type="button" onClick={onBack}>
          Back to dashboard chooser
        </button>

        <section className="network-panel">
          <p className="panel-label">Control authority</p>
          <div className="network-status">
            <span className="status-dot success"></span>
            <div>
              <strong>Admin-only controls</strong>
              <p>Settlements removed. Each admin lane now opens on its own page.</p>
            </div>
          </div>
          <dl className="network-meta">
            <div><dt>Admin</dt><dd>{admin.name}</dd></div>
            <div><dt>MSP ID</dt><dd>{admin.msp_id || 'BetweenMSP'}</dd></div>
            <div><dt>API Base</dt><dd>{API_BASE}</dd></div>
            <div><dt>Contract</dt><dd>participant-chaincode</dd></div>
          </dl>
        </section>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Admin Only</p>
            <h2>Applications, mint review, participants, and audit logs.</h2>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">
              <span className="status-dot success"></span>
              <span>{`Logged in as ${admin.name}`}</span>
            </div>
            <button className="secondary-button" type="button" onClick={loadAdminDashboard}>Refresh dashboard</button>
          </div>
        </header>

        {flash ? (
          <div className="flash-message" data-tone={flash.tone}>
            {flash.message}
          </div>
        ) : null}

        {renderAuthedPage()}
      </main>
    </div>
  );
}
