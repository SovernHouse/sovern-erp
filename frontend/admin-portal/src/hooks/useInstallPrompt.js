/**
 * useInstallPrompt — Phase 4.24.x.
 *
 * Single source of truth for the PWA install state. Both InstallPWA
 * (the chip in the top bar) and InstallPWABanner (the one-time banner)
 * consume this hook so they react to the same beforeinstallprompt event
 * and the same dismissal state.
 *
 * Returns:
 *   - canInstall:  true when the browser has fired beforeinstallprompt
 *                  and the user has not yet installed or dismissed.
 *   - isInstalled: true when the page is running as an installed PWA
 *                  (display-mode: standalone).
 *   - isIOS:       true on iPhone/iPad Safari, where there is no
 *                  programmatic install API (must use Share -> Add).
 *   - install:     call to fire the saved prompt. Resolves to
 *                  { outcome: 'accepted' | 'dismissed' }.
 *   - bannerDismissed: true once the user has clicked "Not now" on the
 *                      banner. Persisted in localStorage.
 *   - dismissBanner: set bannerDismissed to true and persist.
 */
import { useEffect, useState, useCallback } from 'react'

const LS_KEY = 'sovern_pwa_install_banner_dismissed_at'

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(
    typeof window !== 'undefined' && !!localStorage.getItem(LS_KEY)
  )

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsInstalled(true)
      return
    }
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const handleInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' }
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
    return choice
  }, [deferredPrompt])

  const dismissBanner = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, new Date().toISOString())
    } catch (_) {
      /* private-mode browsers without storage; silently fall through */
    }
    setBannerDismissed(true)
  }, [])

  const isIOS = typeof navigator !== 'undefined' && isIOSDevice()
  const canInstall = !!deferredPrompt && !isInstalled

  return {
    canInstall,
    isInstalled,
    isIOS,
    install,
    bannerDismissed,
    dismissBanner,
  }
}
