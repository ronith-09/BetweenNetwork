import React, { useState } from 'react';
import { API_BASE } from './common.jsx';

const LOGIN_TIMEOUT_MS = 12000;

export default function BankLogin({ onLoginSuccess, onBack }) {
  const [formData, setFormData] = useState({
    bank_id: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

      const response = await fetch(`${API_BASE}/banks/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Login failed');

      onLoginSuccess(result.data);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError(`Login timed out. Check that the backend is running at ${API_BASE} and the database is reachable.`);
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">Bank Onboarding</p>
        <h2>Sign in to your bank</h2>
        <p className="auth-copy">Access your BetweenNetwork application status and dashboard.</p>

        {error && <div className="flash danger">{error}</div>}

        <form onSubmit={handleSubmit} className="action-form">
          <label><span>Bank ID</span><input name="bank_id" value={formData.bank_id} onChange={handleChange} placeholder="BANK001" required /></label>
          <label><span>Password</span><input type="password" name="password" value={formData.password} onChange={handleChange} required /></label>

          <button className="primary-button full-width" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <button className="text-button" type="button" onClick={() => onLoginSuccess({ status: 'SIGNUP' })}>Register bank</button></p>
          <button className="text-button" type="button" onClick={onBack}>Back to Selection</button>
        </div>
      </div>
    </div>
  );
}
