import React, { useEffect, useState } from 'react';
import AdminDashboard from './components/AdminDashboard.jsx';
import BankDashboard from './components/BankDashboard.jsx';
import BankSignup from './components/BankSignup.jsx';
import BankLogin from './components/BankLogin.jsx';

const DASHBOARD_STORAGE_KEY = 'betweennetwork_frontend_view';
const BANK_AUTH_STORAGE_KEY = 'betweennetwork_bank_auth';

function readStoredView() {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(DASHBOARD_STORAGE_KEY)
      : null;
  } catch {
    return null;
  }
}

function clearStoredView() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
    }
  } catch {}
}

function persistView(view) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DASHBOARD_STORAGE_KEY, view);
    }
  } catch {}
}

function readBankAuth() {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? JSON.parse(window.localStorage.getItem(BANK_AUTH_STORAGE_KEY) || 'null')
      : null;
  } catch {
    return null;
  }
}

function persistBankAuth(auth) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (!auth) {
        window.localStorage.removeItem(BANK_AUTH_STORAGE_KEY);
      } else {
        window.localStorage.setItem(BANK_AUTH_STORAGE_KEY, JSON.stringify(auth));
      }
    }
  } catch {}
}

function resolveInitialView() {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '');
    if (['admin', 'bank', 'bank-signup', 'bank-login'].includes(hash)) {
      return hash;
    }

    const storedView = readStoredView();
    if (['admin', 'bank', 'bank-signup', 'bank-login'].includes(storedView)) {
      return storedView;
    }
  }

  return '';
}

export default function App() {
  const [view, setView] = useState(resolveInitialView);
  const [bankAuth, setBankAuth] = useState(readBankAuth);

  useEffect(() => {
    if (!view) {
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      clearStoredView();
      document.title = 'BetweenNetwork Dashboards';
      return;
    }

    window.location.hash = view;
    persistView(view);
    document.title = view === 'admin' ? 'BetweenNetwork Admin Dashboard' : 'BetweenNetwork Bank Dashboard';
  }, [view]);

  const handleBankSignupSuccess = (data) => {
    if (data.status === 'LOGIN') {
      setView('bank-login');
    } else {
      setView('bank-login'); // Redirect to login after signup
    }
  };

  const handleBankLoginSuccess = (data) => {
    if (data.status === 'SIGNUP') {
      setView('bank-signup');
    } else {
      setBankAuth(data);
      persistBankAuth(data);
      setView('bank');
    }
  };

  const handleBankLogout = () => {
    setBankAuth(null);
    persistBankAuth(null);
    setView('');
  };

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('')} />;
  }

  if (view === 'bank-signup') {
    return <BankSignup onSignupSuccess={handleBankSignupSuccess} onBack={() => setView('')} />;
  }

  if (view === 'bank-login') {
    return <BankLogin onLoginSuccess={handleBankLoginSuccess} onBack={() => setView('')} />;
  }

  if (view === 'bank') {
    if (!bankAuth) {
      return <BankLogin onLoginSuccess={handleBankLoginSuccess} onBack={() => setView('')} />;
    }
    return <BankDashboard user={bankAuth.bank} token={bankAuth.token} onBack={handleBankLogout} />;
  }

  return (
    <main className="dashboard-selector-shell">
      <section className="dashboard-selector">
        <p className="eyebrow">BetweenNetwork Frontend</p>
        <h1>Choose a dashboard</h1>
        <p className="selector-copy">
          Banks and BetweenNetwork admins now have separate frontend workspaces.
          Start in the dashboard that matches the user role.
        </p>

        <div className="selector-grid">
          <button className="selector-card" type="button" onClick={() => setView('bank-login')}>
            <span className="selector-mark bank">BK</span>
            <strong>Bank Dashboard</strong>
            <p>Access your bank's wallet and check participant status.</p>
          </button>

          <button className="selector-card" type="button" onClick={() => setView('admin')}>
            <span className="selector-mark admin">AD</span>
            <strong>Admin Dashboard</strong>
            <p>Review applications, activate participants, and manage on-chain governance.</p>
          </button>
        </div>
      </section>
    </main>
  );
}
