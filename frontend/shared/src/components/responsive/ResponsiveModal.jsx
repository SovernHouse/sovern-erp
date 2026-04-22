import React from 'react'
import { X } from 'lucide-react'
import { useIsMobile } from '../../utils/responsive'

/**
 * ResponsiveModal Component
 * Desktop: centered modal with overlay
 * Mobile: full-screen slide-up panel
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - title: string
 *  - children: React.ReactNode
 *  - footer: React.ReactNode (optional)
 *  - size: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 *  - closeOnOverlay: boolean (default: true)
 */
export default function ResponsiveModal({
  isOpen = false,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}) {
  const isMobile = useIsMobile()

  if (!isOpen) {
    return null
  }

  // Size classes for desktop modals
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  // ============= MOBILE FULL-SCREEN MODAL =============
  if (isMobile) {
    return (
      <>
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => closeOnOverlay && onClose?.()}
        />

        {/* Full-screen slide-up panel */}
        <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] flex flex-col animate-slide-up safe-area-bottom">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-200 p-4 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </>
    )
  }

  // ============= DESKTOP CENTERED MODAL =============
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={() => closeOnOverlay && onClose?.()}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={`${sizeClasses[size]} bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col animate-fade-in`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-gray-200 p-6 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  )
}
