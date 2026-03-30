import React, { useState } from 'react';
import { API_BASE } from './common.jsx';

const SIGNUP_TIMEOUT_MS = 12000;

export default function BankSignup({ onSignupSuccess, onBack }) {
  const [formData, setFormData] = useState({
    bank_id: '',
    legal_entity_name: '',
    email: '',
    password: '',
    confirm_password: '',
    registered_address: '',
    license_number: '',
    regulator_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);

    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), SIGNUP_TIMEOUT_MS);

      const response = await fetch(`${API_BASE}/banks/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Signup failed');

      onSignupSuccess(result.data);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError(`Signup timed out. Check that the backend is running at ${API_BASE} and the database is reachable.`);
      } else {
        setError(err.message || 'Signup failed');
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card large">
        <p className="eyebrow">Bank Onboarding</p>
        <h2>Register your institution</h2>
        <p className="auth-copy">Submit your details for BetweenNetwork admin approval.</p>

        {error && <div className="flash danger">{error}</div>}

        <form onSubmit={handleSubmit} className="action-form">
          <div className="form-row">
            <label><span>Bank ID (Unique)</span><input name="bank_id" value={formData.bank_id} onChange={handleChange} placeholder="BANK001" required /></label>
            <label><span>Legal Entity Name</span><input name="legal_entity_name" value={formData.legal_entity_name} onChange={handleChange} placeholder="Global First Bank" required /></label>
          </div>
          <div className="form-row">
            <label><span>Email Address</span><input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="contact@bank.com" required /></label>
          </div>
          <div className="form-row">
            <label><span>Password</span><input type="password" name="password" value={formData.password} onChange={handleChange} required /></label>
            <label><span>Confirm Password</span><input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} required /></label>
          </div>
          <label><span>Registered Address</span><textarea name="registered_address" value={formData.registered_address} onChange={handleChange} rows="2" required /></label>
          <div className="form-row">
            <label><span>License Number</span><input name="license_number" value={formData.license_number} onChange={handleChange} required /></label>
            <label><span>Regulator Name</span><input name="regulator_name" value={formData.regulator_name} onChange={handleChange} required /></label>
          </div>

          <button className="primary-button full-width" type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Register as Bank'}
          </button>
        </form>

        <div className="auth-footer">
            <p>Already have an application? <button className="text-button" type="button" onClick={() => onSignupSuccess({ status: 'LOGIN' })}>Log in</button></p>
          <button className="text-button" type="button" onClick={onBack}>Back to Selection</button>
        </div>
      </div>
    </div>
  );
}
