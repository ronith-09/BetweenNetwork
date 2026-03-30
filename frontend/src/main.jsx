import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import '../styles.css';

class FrontendErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: '32px', background: '#0b1e2d', color: '#fff' }}>
          <h1 style={{ marginTop: 0 }}>Frontend runtime error</h1>
          <p>The app failed while rendering. The error is shown below.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#12283d', padding: '16px', borderRadius: '12px' }}>
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FrontendErrorBoundary>
      <App />
    </FrontendErrorBoundary>
  </React.StrictMode>
);
