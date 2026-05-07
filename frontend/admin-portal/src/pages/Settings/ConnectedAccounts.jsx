/**
 * Settings → Connected Accounts
 * Lets admins connect Google Workspace accounts (Gmail + Calendar + Drive)
 * via OAuth, see sync status, toggle active/inactive, and disconnect.
 */

import { useState, useEffect, useCallback } from 'react'
import { Mail, Calendar, HardDrive, RefreshCw, Trash2, ToggleLeft, ToggleRight, Plus, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { googleAPI } from '../../services/api'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatRelative(dateStr) {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

function ScopeTag({ label, icon: Icon, active }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 500,
        background: active ? '#eff6ff' : '#f1f5f9',
        color: active ? '#2563eb' : '#94a3b8',
        border: `1px solid ${active ? '#bfdbfe' : '#e2e8f0'}`,
      }}
    >
      <Icon size={11} />
      {label}
    </span>
  )
}

// ── ConnectedAccountCard ──────────────────────────────────────────────────────

function ConnectedAccountCard({ account, onDisconnect, onToggle }) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const scopes = account.scopes || []
  const hasGmail    = scopes.some(s => s.includes('gmail'))
  const hasCalendar = scopes.some(s => s.includes('calendar'))
  const hasDrive    = scopes.some(s => s.includes('drive'))

  async function handleDisconnect() {
    if (!window.confirm(`Disconnect ${account.email}? Gmail sync will stop immediately.`)) return
    setDisconnecting(true)
    try {
      await googleAPI.disconnectAccount(account.id)
      toast.success(`Disconnected ${account.email}`)
      onDisconnect(account.id)
    } catch (err) {
      toast.error('Failed to disconnect account')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleToggle() {
    setToggling(true)
    try {
      const res = await googleAPI.toggleAccount(account.id)
      toast.success(`Account ${res.data?.isActive ? 'activated' : 'paused'}`)
      onToggle(account.id, res.data?.isActive)
    } catch (err) {
      toast.error('Failed to update account')
    } finally {
      setToggling(false)
    }
  }

  const cardStyle = {
    background: '#fff',
    border: `1px solid ${account.isActive ? '#e2e8f0' : '#fde8d8'}`,
    borderRadius: 12,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }

  const statusDot = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: account.isActive ? '#22c55e' : '#f97316',
    flexShrink: 0,
  }

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={statusDot} title={account.isActive ? 'Active' : 'Paused'} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {account.displayName || account.email}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {account.email}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={account.isActive ? 'Pause sync' : 'Resume sync'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: account.isActive ? '#22c55e' : '#f97316',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {account.isActive
              ? <ToggleRight size={22} />
              : <ToggleLeft size={22} />
            }
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            title="Disconnect account"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Scope badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ScopeTag label="Gmail" icon={Mail} active={hasGmail} />
        <ScopeTag label="Calendar" icon={Calendar} active={hasCalendar} />
        <ScopeTag label="Drive" icon={HardDrive} active={hasDrive} />
      </div>

      {/* Sync times */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          Gmail: {formatRelative(account.lastGmailSyncAt)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} />
          Calendar: {formatRelative(account.lastCalendarSyncAt)}
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConnectedAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await googleAPI.listAccounts()
      setAccounts(res.data || [])
    } catch (err) {
      // 404 / not-configured is expected before GCP is set up
      if (err.response?.status !== 404) {
        toast.error('Could not load connected accounts')
      }
      setAccounts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Listen for the OAuth redirect completing (google=connected param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') === 'connected') {
      toast.success('Google account connected!')
      window.history.replaceState({}, '', window.location.pathname)
      load()
    } else if (params.get('google') === 'denied') {
      toast.error('Google authorization was denied.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('google') === 'error') {
      toast.error('Google OAuth error. Check server logs.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [load])

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await googleAPI.initOAuth()
      const { authUrl } = res.data || {}
      if (authUrl) {
        window.location.href = authUrl
      } else {
        toast.error('No auth URL returned. Is Google OAuth configured on the server?')
      }
    } catch (err) {
      if (err.response?.status === 503) {
        toast.error('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.')
      } else {
        toast.error('Failed to initiate Google OAuth')
      }
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect(id) {
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function handleToggle(id, isActive) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, isActive } : a))
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const pageStyle = { maxWidth: 720 }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  }

  const connectBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: connecting ? 'wait' : 'pointer',
    opacity: connecting ? 0.7 : 1,
  }

  const refreshBtnStyle = {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
  }

  const infoBoxStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '16px 20px',
    fontSize: 13,
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: 24,
  }

  const emptyStyle = {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#94a3b8',
    border: '2px dashed #e2e8f0',
    borderRadius: 12,
    background: '#f8fafc',
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          Connected Accounts
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={refreshBtnStyle} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={handleConnect} style={connectBtnStyle} disabled={connecting}>
            <Plus size={15} />
            {connecting ? 'Redirecting...' : 'Connect Google Account'}
          </button>
        </div>
      </div>

      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
        Connect your Google Workspace accounts to sync Gmail, Calendar, and Drive directly into the ERP.
      </p>

      {/* What you get */}
      <div style={infoBoxStyle}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircle2 size={16} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>Gmail Inbox</div>
              <div>Inbound emails auto-triaged every 5 minutes with AI intent scoring</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircle2 size={16} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>Google Calendar</div>
              <div>Meetings and events synced every 15 minutes (coming soon)</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircle2 size={16} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>Google Drive</div>
              <div>Browse and link shared files to orders and leads (coming soon)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Account list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Loading accounts...
        </div>
      ) : accounts.length === 0 ? (
        <div style={emptyStyle}>
          <Mail size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontWeight: 600, fontSize: 16, color: '#64748b', marginBottom: 6 }}>No accounts connected</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>
            Click "Connect Google Account" to link a Google Workspace inbox.
          </div>
          <button onClick={handleConnect} style={{ ...connectBtnStyle, margin: '0 auto' }} disabled={connecting}>
            <Plus size={15} />
            {connecting ? 'Redirecting...' : 'Connect Google Account'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map(account => (
            <ConnectedAccountCard
              key={account.id}
              account={account}
              onDisconnect={handleDisconnect}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Setup warning — only shown when no accounts are connected */}
      {accounts.length === 0 && !loading && (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a', fontSize: 13, color: '#92400e' }}>
          <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>
            Requires <strong>GOOGLE_CLIENT_ID</strong>, <strong>GOOGLE_CLIENT_SECRET</strong>, and <strong>GOOGLE_REDIRECT_URI</strong> environment variables on the server, plus the Gmail, Calendar, and Drive APIs enabled in your Google Cloud project.
          </span>
        </div>
      )}
    </div>
  )
}
