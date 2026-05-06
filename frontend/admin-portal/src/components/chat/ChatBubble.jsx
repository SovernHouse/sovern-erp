/**
 * ChatBubble
 *
 * Floating chat button fixed at bottom-right of the screen.
 * Shows total unread count badge. Expands into a compact ChatPanel overlay.
 * Rendered once in Layout.jsx — always visible on all ERP pages.
 */
import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import ChatPanel from './ChatPanel'
import { useChatRooms } from '../../hooks/useChat'

const INK    = '#0E0D0C'
const CREAM  = '#F1EEE7'
const FOREST = '#1D5A32'
const c = (hex, opacity) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false)
  const { rooms } = useChatRooms()

  const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={open ? 'Close chat' : 'Open chat'}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9990,
          width: 52, height: 52, borderRadius: '50%',
          background: FOREST, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(29,90,50,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(29,90,50,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(29,90,50,0.4)' }}
      >
        {open ? <X size={22} color={CREAM} /> : <MessageCircle size={22} color={CREAM} />}
        {!open && totalUnread > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4,
            background: '#EF4444', color: CREAM,
            borderRadius: '50%', minWidth: 20, height: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, padding: '0 4px',
            border: `2px solid white`,
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </div>
        )}
      </button>

      {/* Expanded panel overlay */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 9980,
          boxShadow: '0 8px 40px rgba(14,13,12,0.18)',
          border: `1px solid ${c(INK, 0.08)}`,
          borderRadius: 8, overflow: 'hidden',
          animation: 'chatPanelIn 0.18s ease-out',
        }}>
          <style>{`
            @keyframes chatPanelIn {
              from { opacity: 0; transform: translateY(12px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <ChatPanel compact={true} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  )
}
