import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import {
  Inbox,
  RefreshCw,
  UserPlus,
  Forward,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Mail,
  Globe,
  Package,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  MailOpen,
  Filter,
} from 'lucide-react';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const INK    = '#0E0D0C';
const CREAM  = '#F1EEE7';
const FOREST = '#1D5A32';

const INTENT_CONFIG = {
  high:   { label: 'High',   bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  medium: { label: 'Medium', bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  low:    { label: 'Low',    bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
  spam:   { label: 'Spam',   bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
};

const ACTION_CONFIG = {
  create_lead:    { label: 'Create Lead',        icon: UserPlus,  color: FOREST },
  request_info:   { label: 'Request More Info',  icon: Mail,      color: '#2563EB' },
  forward_fanzey: { label: 'Forward to Fanzey',  icon: Forward,   color: '#7C3AED' },
  mark_spam:      { label: 'Mark as Spam',       icon: Trash2,    color: '#DC2626' },
  dismiss:        { label: 'Dismiss',            icon: X,         color: '#6B7280' },
};

const TABS = [
  { key: 'pending',  label: 'Pending' },
  { key: 'promoted', label: 'Promoted' },
  { key: 'forwarded',label: 'Forwarded' },
  { key: 'archived', label: 'Archived' },
  { key: 'spam',     label: 'Spam' },
];

function IntentBadge({ score }) {
  if (!score) return null;
  const cfg = INTENT_CONFIG[score] || INTENT_CONFIG.low;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.text,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function SuggestedActionBadge({ action }) {
  if (!action) return null;
  const cfg = ACTION_CONFIG[action];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6,
      background: '#F3F4F6', color: cfg.color,
      fontSize: 11, fontWeight: 500,
    }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function TriageCard({ item, onAction, loading }) {
  const [expanded, setExpanded] = useState(false);
  const isActioned = item.status !== 'pending';

  const daysLeft = item.autoArchiveAt
    ? Math.max(0, Math.ceil((new Date(item.autoArchiveAt) - new Date()) / 86400000))
    : null;

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isActioned ? '#E5E7EB' : '#D1D5DB'}`,
      borderLeft: `4px solid ${item.intentScore === 'high' ? '#10B981' : item.intentScore === 'medium' ? '#F59E0B' : '#E5E7EB'}`,
      borderRadius: 8,
      padding: '14px 16px',
      opacity: isActioned ? 0.65 : 1,
      transition: 'box-shadow 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: INK, color: CREAM,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>
          {(item.senderName || item.senderEmail)?.[0]?.toUpperCase() || '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: INK }}>
              {item.senderName || item.senderEmail.split('@')[0]}
            </span>
            {item.senderCompany && (
              <span style={{ fontSize: 12, color: '#6B7280' }}>· {item.senderCompany}</span>
            )}
            <IntentBadge score={item.intentScore} />
            {item.isReplyToOutreach && (
              <span style={{
                padding: '2px 6px', borderRadius: 4,
                background: '#EFF6FF', color: '#1D4ED8', fontSize: 11, fontWeight: 500,
              }}>
                Reply to Outreach
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Mail size={11} /> {item.senderEmail}
            </span>
            {item.country && (
              <span style={{ fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Globe size={11} /> {item.country}
              </span>
            )}
            {item.detectedLanguage && item.detectedLanguage !== 'en' && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                [{item.detectedLanguage.toUpperCase()}]
              </span>
            )}
          </div>
        </div>

        {/* Right side: time + expand toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} />
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
          {daysLeft !== null && item.status === 'pending' && (
            <span style={{
              fontSize: 10, color: daysLeft <= 1 ? '#DC2626' : '#9CA3AF',
            }}>
              {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ color: '#9CA3AF', padding: 2, cursor: 'pointer', background: 'none', border: 'none' }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Subject + product interest */}
      <div style={{ marginTop: 10, marginLeft: 46 }}>
        {item.subject && (
          <div style={{ fontSize: 13, fontWeight: 500, color: INK, marginBottom: 4 }}>
            {item.subject}
          </div>
        )}
        {item.productInterest && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <Package size={12} style={{ color: '#6B7280', marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{item.productInterest}</span>
          </div>
        )}
        {item.suggestedAction && (
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', marginRight: 4 }}>AI suggests:</span>
            <SuggestedActionBadge action={item.suggestedAction} />
          </div>
        )}
      </div>

      {/* Expanded body snippet */}
      {expanded && item.bodySnippet && (
        <div style={{
          marginTop: 10, marginLeft: 46, padding: '10px 12px',
          background: '#F9FAFB', borderRadius: 6,
          fontSize: 12, color: '#4B5563', lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 160, overflowY: 'auto',
        }}>
          {item.bodySnippet}
        </div>
      )}

      {/* Forwarded notice */}
      {item.status === 'forwarded' && item.forwardedToFanzeyAt && (
        <div style={{
          marginTop: 8, marginLeft: 46,
          padding: '6px 10px', borderRadius: 6,
          background: '#F5F3FF', color: '#7C3AED',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <CheckCircle size={13} />
          Forwarded to Mohannad Fanzey on {new Date(item.forwardedToFanzeyAt).toLocaleString()}
        </div>
      )}

      {/* Promoted notice */}
      {item.status === 'promoted' && (
        <div style={{
          marginTop: 8, marginLeft: 46,
          padding: '6px 10px', borderRadius: 6,
          background: '#ECFDF5', color: '#065F46',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <ArrowUpRight size={13} />
          Promoted to Lead
        </div>
      )}

      {/* Action buttons — only for pending items */}
      {item.status === 'pending' && (
        <div style={{
          marginTop: 12, marginLeft: 46,
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          <ActionButton
            icon={UserPlus} label="Promote to Lead" color={FOREST}
            onClick={() => onAction(item.id, 'promote')}
            disabled={loading === item.id}
          />
          <ActionButton
            icon={Forward} label="Forward to Fanzey" color="#7C3AED"
            onClick={() => onAction(item.id, 'forward-fanzey')}
            disabled={loading === item.id}
          />
          <ActionButton
            icon={MailOpen} label="Reply" color="#2563EB"
            onClick={() => window.open(`mailto:${item.senderEmail}?subject=Re: ${encodeURIComponent(item.subject || '')}`)}
            disabled={false}
          />
          <ActionButton
            icon={Archive} label="Archive" color="#6B7280"
            onClick={() => onAction(item.id, 'archive')}
            disabled={loading === item.id}
          />
          <ActionButton
            icon={Trash2} label="Spam" color="#DC2626"
            onClick={() => onAction(item.id, 'spam')}
            disabled={loading === item.id}
          />
          <ActionButton
            icon={X} label="Dismiss" color="#9CA3AF"
            onClick={() => onAction(item.id, 'dismiss')}
            disabled={loading === item.id}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        border: `1px solid ${color}20`,
        background: hover ? `${color}10` : '#F9FAFB',
        color, fontSize: 12, fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

// Archive icon (not in the imported set above)
function Archive({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={style}
    >
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export default function TriageInbox() {
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab]     = useState('pending');
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing]         = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [error, setError]             = useState(null);
  const [pagination, setPagination]   = useState({});

  const fetchItems = useCallback(async (tab = activeTab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/triage?status=${tab}&limit=50`);
      // api.js auto-unwraps {success,data} so res.data is the items array directly
      setItems(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || {});
      setPendingCount(res.pendingCount ?? 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load triage inbox');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchItems(activeTab); }, [activeTab]);

  // Poll pending count every 2 minutes for badge freshness
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await api.get('/triage/pending-count');
        setPendingCount(res.data?.count ?? res.data ?? 0);
      } catch {}
    }, 120000);
    return () => clearInterval(timer);
  }, []);

  const handleAction = async (id, action) => {
    setActionLoading(id);
    try {
      await api.patch(`/triage/${id}/${action}`);
      await fetchItems(activeTab);
    } catch (err) {
      alert(err.response?.data?.error?.message || `Action failed: ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await api.post('/triage/sync-requested');
      setSyncMessage(res.data?.message || 'Sync requested. Check back shortly.');
      // Refresh after 3s to catch any items the Cowork task may have already posted
      setTimeout(() => { fetchItems(activeTab); setSyncMessage(''); }, 3000);
    } catch (err) {
      setSyncMessage('Sync request failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const emptyMessages = {
    pending:   'No pending emails. All caught up.',
    promoted:  'No promoted leads yet.',
    forwarded: 'No emails forwarded to Fanzey yet.',
    archived:  'No archived items.',
    spam:      'No spam-marked items.',
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Inbox size={22} style={{ color: INK }} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: INK, margin: 0 }}>
              Email Inbox
            </h1>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              AI-triaged inbound emails. Review, promote to leads, or forward to your team.
            </p>
          </div>
          {pendingCount > 0 && (
            <span style={{
              padding: '2px 9px', borderRadius: 999,
              background: FOREST, color: '#fff',
              fontSize: 12, fontWeight: 700,
            }}>
              {pendingCount}
            </span>
          )}
        </div>

        <button
          onClick={handleSyncNow}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 7,
            background: INK, color: CREAM,
            border: 'none', cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 500, opacity: syncing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={13} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Requesting...' : 'Sync Now'}
        </button>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 7,
          background: '#EFF6FF', color: '#1D4ED8',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />
          {syncMessage}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #E5E7EB', marginBottom: 18 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', border: 'none', background: 'none',
              color: activeTab === tab.key ? FOREST : '#6B7280',
              borderBottom: activeTab === tab.key ? `2px solid ${FOREST}` : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.1s',
            }}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span style={{
                marginLeft: 5, padding: '1px 6px', borderRadius: 999,
                background: FOREST, color: '#fff', fontSize: 10, fontWeight: 700,
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 7, background: '#FEF2F2',
          color: '#DC2626', fontSize: 13, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 14 }}>
          Loading...
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: '#6B7280', fontSize: 14,
        }}>
          <Inbox size={32} style={{ color: '#D1D5DB', marginBottom: 10 }} />
          <div>{emptyMessages[activeTab] || 'Nothing here.'}</div>
          {activeTab === 'pending' && (
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
              The Cowork task checks Gmail every 45 minutes and posts new leads here automatically.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <TriageCard
              key={item.id}
              item={item}
              onAction={handleAction}
              loading={actionLoading}
            />
          ))}
          {pagination.total > items.length && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', padding: 8 }}>
              Showing {items.length} of {pagination.total}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
