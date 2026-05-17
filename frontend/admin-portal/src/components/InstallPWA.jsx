/**
 * InstallPWA — Phase 4.24.x-a labeled chip variant.
 *
 * Replaces the 18px Download icon with a labeled "Install Desktop App"
 * chip in the top bar. Visually obvious without a banner.
 *
 * Mounted via <InstallPWA /> in Layout.jsx (existing mount point).
 *
 * Disappears entirely once installed, dismissed, or not eligible.
 */
import { useState } from 'react'
import { Download } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

const FOREST = '#1D5A32'

function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function InstallPWA() {
  const { canInstall, isIOS, isInstalled, install } = useInstallPrompt()
  const [iosOpen, setIosOpen] = useState(false)
  const [hover, setHover] = useState(false)

  if (isInstalled) return null
  if (!canInstall && !isIOS) return null

  const handleClick = async () => {
    if (canInstall) {
      await install()
    } else if (isIOS) {
      setIosOpen((v) => !v)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={isIOS ? 'Add to Home Screen' : 'Install Sovern ERP as a desktop app'}
        aria-label="Install app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          height: 32,
          borderRadius: 999,
          background: hover ? rgba(FOREST, 0.18) : rgba(FOREST, 0.10),
          border: `1px solid ${rgba(FOREST, 0.25)}`,
          color: FOREST,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s, transform 0.05s',
          whiteSpace: 'nowrap',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <Download size={14} />
        {isIOS ? 'Add to Home Screen' : 'Install Desktop App'}
      </button>

      {iosOpen && isIOS && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 240,
            background: '#1A1A1A',
            color: '#F5F0E8',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 999,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Add to Home Screen</div>
          <div style={{ color: 'rgba(245,240,232,0.7)' }}>
            Tap the <strong style={{ color: '#F5F0E8' }}>Share</strong> icon in Safari,
            then choose <strong style={{ color: '#F5F0E8' }}>"Add to Home Screen"</strong>.
          </div>
        </div>
      )}
    </div>
  )
}
