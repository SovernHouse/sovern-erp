/**
 * InstallPWABanner — Phase 4.24.x-b.
 *
 * One-time slide-in banner directly under the top bar. Shown when the
 * browser has fired beforeinstallprompt AND the user has not yet
 * dismissed or installed.
 *
 * Dismissal is persisted to localStorage and is permanent per browser
 * profile. Matches the Slack/Linear/Notion pattern.
 *
 * On iOS Safari (no programmatic install), shows a copy variant that
 * points the user at the Share menu. No CTA since the install must
 * happen via the OS UI.
 */
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const FOREST = '#1D5A32'
const INK = '#0E0D0C'

function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function InstallPWABanner() {
  const { canInstall, isIOS, isInstalled, install, bannerDismissed, dismissBanner } = useInstallPrompt()
  const [translateY, setTranslateY] = useState(-100) // start above viewport
  const [hidden, setHidden] = useState(false)

  const visible =
    !isInstalled && !bannerDismissed && (canInstall || isIOS) && !hidden

  useEffect(() => {
    if (visible) {
      // slide in on next frame so transition fires
      requestAnimationFrame(() => setTranslateY(0))
    }
  }, [visible])

  if (!visible) return null

  const handleInstall = async () => {
    if (canInstall) {
      const choice = await install()
      if (choice.outcome === 'accepted') {
        slideOutAndHide()
      }
    } else if (isIOS) {
      // No programmatic install; the chip's iOS tooltip handles the how-to.
      // Banner dismiss = "I'll figure it out".
      slideOutAndHide()
    }
  }

  const handleNotNow = () => {
    dismissBanner()
    slideOutAndHide()
  }

  const slideOutAndHide = () => {
    setTranslateY(-100)
    setTimeout(() => setHidden(true), 240)
  }

  const message = isIOS
    ? 'Add Sovern House Operations to your Home Screen for a faster, focused workspace.'
    : 'Install Sovern House Operations as a desktop app for a faster, focused workspace.'

  return (
    <div
      role="region"
      aria-label="Install Sovern House Operations as a desktop app"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        width: '100%',
        background: rgba(FOREST, 0.06),
        borderBottom: `1px solid ${rgba(FOREST, 0.15)}`,
        transform: `translateY(${translateY}%)`,
        transition: 'transform 240ms ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '10px 16px',
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <Download size={18} color={FOREST} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: INK }}>
              Install Sovern House Operations
            </div>
            <div style={{ fontSize: 12, color: rgba(INK, 0.55), marginTop: 1 }}>
              {message.replace('Install Sovern House Operations ', '').replace('Add Sovern House Operations ', '')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {canInstall && (
            <button
              onClick={handleInstall}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: FOREST,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Install
            </button>
          )}
          <button
            onClick={handleNotNow}
            aria-label={canInstall ? 'Not now' : 'Dismiss'}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              color: rgba(INK, 0.55),
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {canInstall ? 'Not now' : 'Dismiss'}
          </button>
          <button
            onClick={handleNotNow}
            aria-label="Close"
            style={{
              padding: 8,
              background: 'transparent',
              color: rgba(INK, 0.4),
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
