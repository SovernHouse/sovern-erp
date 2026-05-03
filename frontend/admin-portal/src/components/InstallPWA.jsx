/**
 * InstallPWA — shows a discrete install button when the browser decides
 * the app is installable (Chrome fires 'beforeinstallprompt').
 *
 * Usage: drop anywhere in the layout. It renders nothing until the browser
 * decides the conditions for PWA install have been met.
 *
 *   <InstallPWA />
 *
 * Once installed the button disappears permanently (the 'appinstalled' event).
 * On iOS/Safari there is no install prompt API — the component renders an
 * "Add to Home Screen" tooltip instead (shown only on iOS).
 */
import { useState, useEffect, useRef } from 'react'
import { Download } from 'lucide-react'

const FOREST = '#1D5A32'
const INK    = '#0E0D0C'
const c = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled]           = useState(false)
  const [showIOSTip, setShowIOSTip]         = useState(false)
  const [hovered, setHovered]               = useState(false)
  const tipRef = useRef(null)

  useEffect(() => {
    // Already running as installed PWA — don't show the button.
    if (isInStandaloneMode()) {
      setInstalled(true)
      return
    }

    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const handleInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  // Close iOS tip when clicking outside.
  useEffect(() => {
    if (!showIOSTip) return
    const handler = (e) => {
      if (tipRef.current && !tipRef.current.contains(e.target)) {
        setShowIOSTip(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showIOSTip])

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else if (isIOS()) {
      setShowIOSTip((v) => !v)
    }
  }

  // Don't render if: already installed, no prompt available, not iOS.
  if (installed) return null
  if (!deferredPrompt && !isIOS()) return null

  return (
    <div style={{ position: 'relative' }} ref={tipRef}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Install Sovern ERP as desktop app"
        aria-label="Install app"
        style={{
          padding: 8,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          background: hovered ? c(FOREST, 0.08) : 'transparent',
          color: hovered ? FOREST : c(INK, 0.50),
          transition: 'background 0.15s, color 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Download size={18} />
      </button>

      {/* iOS instructions tooltip */}
      {showIOSTip && (
        <div style={{
          position: 'absolute',
          top: '110%',
          right: 0,
          width: 220,
          background: '#1A1A1A',
          color: '#F5F0E8',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 12,
          lineHeight: 1.5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 999,
          whiteSpace: 'normal',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Add to Home Screen</div>
          <div style={{ color: 'rgba(245,240,232,0.7)' }}>
            Tap the <strong style={{ color: '#F5F0E8' }}>Share</strong> icon in Safari,
            then choose <strong style={{ color: '#F5F0E8' }}>"Add to Home Screen"</strong>.
          </div>
          {/* Caret */}
          <div style={{
            position: 'absolute',
            top: -6,
            right: 14,
            width: 12,
            height: 12,
            background: '#1A1A1A',
            transform: 'rotate(45deg)',
            borderRadius: 2,
          }} />
        </div>
      )}
    </div>
  )
}
