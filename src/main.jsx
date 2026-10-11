import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App.tsx';
import { LanguageProvider } from './i18n/LanguageContext';
import { installInteractions } from './lib/interactions';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[NIRDHOOM] Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      const message = this.state.error instanceof Error
        ? this.state.error.message
        : String(this.state.error);

      return (
        <main style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: 'var(--bg-deep, #f7f5ec)',
          color: 'var(--text, #173522)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <section style={{
            width: 'min(720px, 100%)',
            border: '1px solid rgba(196,63,54,.25)',
            borderRadius: '16px',
            padding: '24px',
            background: 'var(--panel-strong, #ffffff)',
          }}>
            <div style={{ color: '#a95404', fontWeight: 800, fontSize: '12px', letterSpacing: '.12em', textTransform: 'uppercase' }}>
              NIRDHOOM UI ERROR
            </div>
            <h1 style={{ margin: '8px 0', fontSize: '24px' }}>The dashboard could not render.</h1>
            <p style={{ color: '#536658', margin: '0 0 16px', lineHeight: 1.6 }}>
              Refresh once. If the problem persists, send this error to the developer:
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--panel-soft, #f8faf6)',
              color: 'var(--accent-red, #c43f36)',
              fontSize: '12px',
            }}>{message}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                border: 0,
                borderRadius: '10px',
                padding: '10px 14px',
                background: 'var(--blue, #237a48)',
                color: 'white',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Reload NIRDHOOM
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('NIRDHOOM root element was not found');
}

installInteractions();

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
