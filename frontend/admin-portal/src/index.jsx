import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App'

// Initialize Sentry as early as possible. DSN is read from VITE_SENTRY_DSN
// in the build environment. If unset, Sentry is disabled (no events sent).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance monitoring sample rate. Free plan allows 10k transactions/month.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Session replays. Free plan allows 50/month. Sample rare to stay within budget.
    replaysSessionSampleRate: import.meta.env.PROD ? 0.01 : 0.0,
    replaysOnErrorSampleRate: 1.0,
    // Don't send events from local development unless explicitly enabled.
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_ENABLE === 'true',
    // Filter known noisy errors. Add to this list as patterns emerge.
    ignoreErrors: [
      // Browser extensions injecting scripts.
      'Non-Error promise rejection captured',
      'ResizeObserver loop',
    ],
  })
}

const FallbackComponent = ({ error, resetError }) => (
  <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '40rem', margin: '4rem auto' }}>
    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong</h1>
    <p style={{ color: '#555', marginBottom: '1.5rem' }}>
      The page hit an unexpected error. The error has been reported to our team and we will look into it.
    </p>
    <button
      onClick={resetError}
      style={{
        padding: '0.5rem 1rem',
        background: '#1D5A32',
        color: 'white',
        border: 'none',
        borderRadius: '0.25rem',
        cursor: 'pointer',
      }}
    >
      Try again
    </button>
    {import.meta.env.DEV && error && (
      <pre style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', overflow: 'auto', fontSize: '0.85rem' }}>
        {error.toString()}
      </pre>
    )}
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={FallbackComponent} showDialog={false}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
