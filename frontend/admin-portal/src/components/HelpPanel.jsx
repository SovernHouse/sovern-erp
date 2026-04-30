/**
 * HelpPanel.jsx
 *
 * A slide-in help panel (right side) providing page-level user guidance.
 * Opened by clicking the (?) button in the top-right of the Layout header.
 *
 * Usage — in Layout.jsx, add:
 *   import HelpPanel, { useHelpPanel } from './HelpPanel'
 *   const { isOpen, open, close, toggle } = useHelpPanel()
 *   // Pass `toggle` to a header button, render <HelpPanel open={isOpen} onClose={close} />
 *
 * Content is driven by the current URL path — see helpContent.js.
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X, BookOpen, ChevronRight, ExternalLink } from 'lucide-react'
import { useState, useCallback } from 'react'
import { HELP_CONTENT, GLOBAL_TIPS } from '../constants/helpContent'

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHelpPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const open    = useCallback(() => setIsOpen(true), [])
  const close   = useCallback(() => setIsOpen(false), [])
  const toggle  = useCallback(() => setIsOpen(v => !v), [])
  return { isOpen, open, close, toggle }
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {boolean}  props.open      Whether the panel is visible
 * @param {Function} props.onClose   Called when the user closes the panel
 */
export default function HelpPanel({ open, onClose }) {
  const { pathname } = useLocation()
  const panelRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Focus trap — move focus into panel when opened
  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus()
    }
  }, [open])

  // Resolve content for the current page
  const content = resolveContent(pathname)

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label="Help panel"
        aria-hidden={!open}
        className={`
          fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          flex flex-col outline-none
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            {content.title}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close help panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-sm text-gray-700">

          {/* Summary */}
          {content.summary && (
            <p className="text-gray-600 leading-relaxed">{content.summary}</p>
          )}

          {/* Sections */}
          {content.sections?.map((section, i) => (
            <section key={i}>
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                {section.icon && <section.icon className="w-3.5 h-3.5 text-indigo-400" />}
                {section.heading}
              </h3>
              {section.steps ? (
                <ol className="space-y-2 pl-1">
                  {section.steps.map((step, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center mt-0.5">
                        {j + 1}
                      </span>
                      <span className="leading-relaxed text-gray-600">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : section.items ? (
                <ul className="space-y-1.5 pl-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-gray-600">
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-indigo-300" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : section.body ? (
                <p className="text-gray-600 leading-relaxed">{section.body}</p>
              ) : null}
            </section>
          ))}

          {/* Tips */}
          {content.tips?.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Quick Tips</h3>
              <ul className="space-y-1.5 pl-1">
                {content.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-gray-600">
                    <span className="text-amber-400 font-bold flex-shrink-0">!</span>
                    <span className="leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Warnings */}
          {content.warnings?.length > 0 && (
            <section>
              {content.warnings.map((w, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800 text-xs leading-relaxed mb-2">
                  {w}
                </div>
              ))}
            </section>
          )}

          {/* Status glossary */}
          {content.statuses?.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-2">Status Guide</h3>
              <dl className="space-y-2">
                {content.statuses.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <dt>
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>
                        {s.label}
                      </span>
                    </dt>
                    <dd className="text-gray-500 text-xs leading-snug mt-0.5 flex-1">{s.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Divider + global tips */}
          <hr className="border-gray-100" />
          <section>
            <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">General Tips</h3>
            <ul className="space-y-1.5">
              {GLOBAL_TIPS.map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-500">
                  <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-300" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* External links */}
          {content.links?.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Resources</h3>
              <ul className="space-y-1.5">
                {content.links.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Sovern ERP &mdash; Internal Use Only
          </p>
        </div>
      </aside>
    </>
  )
}

// ─── Content resolver ─────────────────────────────────────────────────────────

function resolveContent(pathname) {
  // Exact match first
  if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname]

  // Prefix match — /orders/abc-123 → /orders
  const base = '/' + pathname.split('/').filter(Boolean)[0]
  if (HELP_CONTENT[base]) return HELP_CONTENT[base]

  return HELP_CONTENT['__default__']
}
