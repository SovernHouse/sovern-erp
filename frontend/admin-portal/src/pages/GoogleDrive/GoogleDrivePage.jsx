/**
 * GoogleDrivePage — Browse connected Google Drive accounts.
 * Folder navigation, search, breadcrumb, file open/download.
 * Admin + manager only (mirrors route permission).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  HardDrive, Folder, File, FileText, FileImage, FileVideo, FileAudio,
  Search, ChevronRight, Home, Loader2, AlertCircle, RefreshCw,
  ExternalLink, Download, ArrowLeft, ChevronDown
} from 'lucide-react'
import { googleAPI, driveAPI } from '../../services/api'
import toast from 'react-hot-toast'

// ── Mime-type icon mapping ─────────────────────────────────────────────────────

function FileIcon({ mimeType, size = 20 }) {
  const style = { flexShrink: 0 }
  if (mimeType === 'application/vnd.google-apps.folder')
    return <Folder size={size} color="#f59e0b" style={style} />
  if (mimeType?.startsWith('image/') || mimeType === 'application/vnd.google-apps.photo')
    return <FileImage size={size} color="#8b5cf6" style={style} />
  if (mimeType?.startsWith('video/'))
    return <FileVideo size={size} color="#ec4899" style={style} />
  if (mimeType?.startsWith('audio/'))
    return <FileAudio size={size} color="#06b6d4" style={style} />
  if (
    mimeType === 'application/vnd.google-apps.document' ||
    mimeType === 'application/msword' ||
    mimeType?.includes('wordprocessingml')
  )
    return <FileText size={size} color="#2563eb" style={style} />
  if (mimeType === 'application/vnd.google-apps.spreadsheet' || mimeType?.includes('spreadsheet'))
    return <FileText size={size} color="#16a34a" style={style} />
  if (mimeType === 'application/vnd.google-apps.presentation' || mimeType?.includes('presentation'))
    return <FileText size={size} color="#dc2626" style={style} />
  if (mimeType === 'application/pdf')
    return <FileText size={size} color="#dc2626" style={style} />
  return <File size={size} color="#6b7280" style={style} />
}

function isFolder(file) {
  return file.mimeType === 'application/vnd.google-apps.folder'
}

function formatSize(bytes) {
  if (!bytes) return ''
  const n = parseInt(bytes, 10)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────────

function BreadcrumbNav({ crumbs, onNavigate }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minHeight: 32 }}>
      <button
        onClick={() => onNavigate('root')}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer',
          color: '#4b5563', fontSize: 14, transition: 'background 0.15s',
        }}
        onMouseOver={e => { e.currentTarget.style.background = '#f3f4f6' }}
        onMouseOut={e => { e.currentTarget.style.background = 'none' }}
      >
        <Home size={14} />
        <span>My Drive</span>
      </button>
      {crumbs.map((crumb, i) => (
        <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChevronRight size={14} color="#9ca3af" />
          {i === crumbs.length - 1 ? (
            <span style={{ padding: '4px 8px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
              {crumb.name}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(crumb.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer',
                color: '#4b5563', fontSize: 14,
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#f3f4f6' }}
              onMouseOut={e => { e.currentTarget.style.background = 'none' }}
            >
              {crumb.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}

// ── FileRow ────────────────────────────────────────────────────────────────────

function FileRow({ file, onFolderClick }) {
  const folder = isFolder(file)

  const handleRowClick = () => {
    if (folder) {
      onFolderClick(file.id, file.name)
    } else if (file.webViewLink) {
      window.open(file.webViewLink, '_blank', 'noopener noreferrer')
    }
  }

  const typeName = folder
    ? 'Folder'
    : file.mimeType
        ?.replace('application/vnd.google-apps.', '')
        .replace('application/', '')
        .split('.').pop()

  return (
    <tr
      onClick={handleRowClick}
      style={{ cursor: folder || file.webViewLink ? 'pointer' : 'default' }}
      onMouseOver={e => { e.currentTarget.style.background = '#f9fafb' }}
      onMouseOut={e => { e.currentTarget.style.background = '' }}
    >
      <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <FileIcon mimeType={file.mimeType} />
        <span style={{
          fontSize: 14, color: '#111827',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.name}
        </span>
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {typeName}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {folder ? '' : formatSize(file.size)}
      </td>
      <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {formatDate(file.modifiedTime)}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              title="Open in Google Drive"
              style={{ padding: 4, borderRadius: 4, color: '#6b7280', display: 'flex', alignItems: 'center' }}
              onMouseOver={e => { e.currentTarget.style.color = '#2563eb' }}
              onMouseOut={e => { e.currentTarget.style.color = '#6b7280' }}
            >
              <ExternalLink size={15} />
            </a>
          )}
          {!folder && file.webContentLink && (
            <a
              href={file.webContentLink}
              onClick={e => e.stopPropagation()}
              title="Download"
              style={{ padding: 4, borderRadius: 4, color: '#6b7280', display: 'flex', alignItems: 'center' }}
              onMouseOver={e => { e.currentTarget.style.color = '#16a34a' }}
              onMouseOut={e => { e.currentTarget.style.color = '#6b7280' }}
            >
              <Download size={15} />
            </a>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GoogleDrivePage() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [folderId, setFolderId] = useState('root')
  const [crumbs, setCrumbs] = useState([])
  const [files, setFiles] = useState([])
  const [nextPageToken, setNextPageToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [noAccounts, setNoAccounts] = useState(false)

  const searchTimer = useRef(null)

  // Load connected Google accounts on mount
  useEffect(() => {
    googleAPI.listAccounts()
      .then(res => {
        const all = res.data || []
        const driveAccounts = all.filter(a =>
          a.isActive && (a.scopes || []).some(s => s.includes('drive'))
        )
        setAccounts(driveAccounts)
        if (driveAccounts.length > 0) {
          setSelectedAccountId(driveAccounts[0].id)
        } else {
          setNoAccounts(true)
        }
      })
      .catch(() => setError('Failed to load connected accounts.'))
  }, [])

  // Load files when account or folder changes
  const loadFiles = useCallback(async (acctId, folder, pageToken) => {
    if (!acctId) return
    if (pageToken) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    try {
      const [filesRes, crumbRes] = await Promise.all([
        driveAPI.listFiles({ accountId: acctId, folderId: folder, pageToken: pageToken || undefined }),
        (folder !== 'root' && !pageToken)
          ? driveAPI.breadcrumb({ accountId: acctId, folderId: folder })
          : Promise.resolve(null),
      ])

      const newFiles = filesRes.data?.files || []
      const newToken = filesRes.data?.nextPageToken || null

      if (pageToken) {
        setFiles(prev => [...prev, ...newFiles])
      } else {
        setFiles(newFiles)
        setCrumbs(crumbRes ? (crumbRes.data || []) : [])
      }
      setNextPageToken(newToken)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load files.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAccountId) {
      setSearchQuery('')
      setSearchResults(null)
      loadFiles(selectedAccountId, folderId)
    }
  }, [selectedAccountId, folderId, loadFiles])

  // Navigate into a folder (from clicking a row)
  const navigateTo = useCallback((id, name) => {
    setCrumbs(prev => {
      if (searchResults !== null) return [{ id, name }]
      return [...prev, { id, name }]
    })
    setFolderId(id)
    setFiles([])
    setNextPageToken(null)
    setSearchQuery('')
    setSearchResults(null)
  }, [searchResults])

  // Navigate from breadcrumb (truncate crumbs at that point)
  const navigateBreadcrumb = useCallback((id) => {
    if (id === 'root') {
      setCrumbs([])
    } else {
      setCrumbs(prev => {
        const idx = prev.findIndex(c => c.id === id)
        return idx >= 0 ? prev.slice(0, idx + 1) : prev
      })
    }
    setFolderId(id)
    setFiles([])
    setNextPageToken(null)
    setSearchQuery('')
    setSearchResults(null)
  }, [])

  // Debounced search
  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!q.trim()) {
      setSearchResults(null)
      return
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await driveAPI.search({ accountId: selectedAccountId, q: q.trim() })
        setSearchResults(res.data?.files || [])
      } catch {
        toast.error('Search failed')
        setSearchResults(null)
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [selectedAccountId])

  const displayedFiles = searchResults !== null ? searchResults : files

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HardDrive size={22} color="#4b5563" />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Google Drive</h1>
        </div>

        {accounts.length > 1 && (
          <div style={{ position: 'relative' }}>
            <select
              value={selectedAccountId || ''}
              onChange={e => {
                setSelectedAccountId(e.target.value)
                setFolderId('root')
                setCrumbs([])
              }}
              style={{
                padding: '6px 28px 6px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                fontSize: 14, background: 'white', cursor: 'pointer', appearance: 'none',
              }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.displayName || a.email}</option>
              ))}
            </select>
            <ChevronDown size={14} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: '#6b7280',
            }} />
          </div>
        )}
        {accounts.length === 1 && (
          <span style={{ fontSize: 13, color: '#6b7280' }}>{accounts[0].displayName || accounts[0].email}</span>
        )}
      </div>

      {/* No drive accounts */}
      {noAccounts && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6b7280' }}>
          <HardDrive size={48} style={{ marginBottom: 16, opacity: 0.3, display: 'block', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#374151' }}>No Google accounts connected</p>
          <p style={{ fontSize: 14 }}>
            Go to{' '}
            <a href="/settings/connected-accounts" style={{ color: '#2563eb', textDecoration: 'underline' }}>
              Settings &rarr; Connected Accounts
            </a>{' '}
            to connect a Google account with Drive access.
          </p>
        </div>
      )}

      {/* Search bar */}
      {!noAccounts && selectedAccountId && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af',
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search Drive..."
            style={{
              width: '100%', padding: '9px 36px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#2563eb' }}
            onBlur={e => { e.target.style.borderColor = '#d1d5db' }}
          />
          {searching && (
            <Loader2 size={16} className="spin" style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              color: '#9ca3af', animation: 'spin 1s linear infinite',
            }} />
          )}
        </div>
      )}

      {/* Breadcrumb */}
      {!noAccounts && searchResults === null && (
        <div style={{
          marginBottom: 12, background: '#f9fafb', borderRadius: 8,
          padding: '6px 12px', border: '1px solid #f3f4f6',
        }}>
          <BreadcrumbNav crumbs={crumbs} onNavigate={navigateBreadcrumb} />
        </div>
      )}

      {/* Search context bar */}
      {searchResults !== null && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setSearchQuery(''); setSearchResults(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6,
              cursor: 'pointer', fontSize: 13, color: '#4b5563',
            }}
          >
            <ArrowLeft size={13} /> Back to folder
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16,
        }}>
          <AlertCircle size={18} color="#dc2626" />
          <span style={{ fontSize: 14, color: '#dc2626', flex: 1 }}>{error}</span>
          <button
            onClick={() => loadFiles(selectedAccountId, folderId)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
              background: '#dc2626', color: 'white', border: 'none', borderRadius: 6,
              cursor: 'pointer', fontSize: 12,
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6b7280' }}>
          <Loader2 size={32} style={{ marginBottom: 8, animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <p style={{ fontSize: 14, margin: 0 }}>Loading files...</p>
        </div>
      )}

      {/* File table */}
      {!loading && !noAccounts && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Size</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Modified</th>
                <th style={{ padding: '10px 16px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {displayedFiles.map(file => (
                <FileRow
                  key={file.id}
                  file={file}
                  onFolderClick={navigateTo}
                />
              ))}
            </tbody>
          </table>

          {!loading && displayedFiles.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
              <Folder size={40} style={{ marginBottom: 12, opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
              <p style={{ fontSize: 14, margin: 0 }}>
                {searchResults !== null ? 'No results found.' : 'This folder is empty.'}
              </p>
            </div>
          )}

          {nextPageToken && searchResults === null && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
              <button
                disabled={loadingMore}
                onClick={() => loadFiles(selectedAccountId, folderId, nextPageToken)}
                style={{
                  padding: '8px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb',
                  borderRadius: 8, cursor: loadingMore ? 'not-allowed' : 'pointer',
                  fontSize: 14, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {loadingMore
                  ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</>
                  : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        tbody tr { border-bottom: 1px solid #f3f4f6; }
        tbody tr:last-child { border-bottom: none; }
      `}</style>
    </div>
  )
}
