import { LoadingSpinner } from '@shared/components'

export default function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <LoadingSpinner message="Loading page..." size="lg" />
    </div>
  )
}
