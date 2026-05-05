import { useState } from 'react'
import { Smartphone, ExternalLink, Copy, Check, Info } from 'lucide-react'

// ─── Sovern Ops mobile app QR code page ──────────────────────────────────────
// EXPO_URL is the EAS Update deep-link opened by Expo Go when the QR is scanned.
// Published 2026-05-05 via: eas update --channel main --platform ios
// To push a new OTA update:
//   cd mobile/sovern-ops-app
//   eas update --channel main --message "<description>" --platform ios
// The URL below is permanent — it always serves the latest update on the main
// channel so the QR code never needs to change.
// ─────────────────────────────────────────────────────────────────────────────

const EXPO_URL = 'exp://u.expo.dev/76a4e7a2-6585-4212-aa0c-1f8cfe7e001f?channel-name=main'

function qrImageUrl(text, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=1D5A32&bgcolor=F1EEE7&margin=2`
}

export default function MobileApp() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(EXPO_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Smartphone className="w-7 h-7 text-primary-600" />
        <h1 className="text-3xl font-bold text-slate-900">Sovern Ops — Mobile App</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">

        {/* QR Code card */}
        <div className="bg-white rounded-xl shadow p-8 flex flex-col items-center space-y-5">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Scan with Expo Go
          </p>
          <div className="p-3 bg-[#F1EEE7] rounded-xl border border-slate-200">
            <img
              src={qrImageUrl(EXPO_URL)}
              alt="Sovern Ops QR Code"
              width={220}
              height={220}
              className="rounded"
            />
          </div>
          <div className="w-full">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <code className="flex-1 text-xs text-slate-600 truncate">{EXPO_URL}</code>
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Instructions card */}
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="font-semibold text-slate-900">How to open the app</h2>

          <ol className="space-y-4 text-sm text-slate-700">
            <li className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Install Expo Go</p>
                <p className="text-slate-500 mt-0.5">Download from the App Store (iPhone) or Play Store (Android).</p>
                <a
                  href="https://apps.apple.com/app/expo-go/id982107779"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-primary-600 hover:underline mt-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>App Store — Expo Go</span>
                </a>
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Scan the QR code</p>
                <p className="text-slate-500 mt-0.5">Open Expo Go, tap the scan button, and point at the QR code on the left.</p>
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Log in</p>
                <p className="text-slate-500 mt-0.5">Use your Sovern House ERP credentials — same username and password as the web portal.</p>
              </div>
            </li>
          </ol>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start space-x-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              The QR code requires the app to be published. Run <code className="font-mono bg-amber-100 px-1 rounded">npx expo publish</code> from the <code className="font-mono bg-amber-100 px-1 rounded">mobile/sovern-ops-app</code> folder, then update the <code className="font-mono bg-amber-100 px-1 rounded">EXPO_URL</code> in this file with the published link.
            </p>
          </div>
        </div>
      </div>

      {/* Send link card */}
      <div className="bg-white rounded-xl shadow p-6 max-w-4xl">
        <h2 className="font-semibold text-slate-900 mb-3">Share with your team</h2>
        <p className="text-sm text-slate-600 mb-4">
          Send this message to any team member to get them set up:
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
{`Hi — to access the Sovern Ops mobile app:

1. Download "Expo Go" from the App Store or Play Store
2. Open Expo Go and tap Scan
3. Scan this QR code: [attach screenshot]
   or open this link on your phone: ${EXPO_URL}

Log in with your usual Sovern House ERP credentials.`}
        </div>
      </div>
    </div>
  )
}
