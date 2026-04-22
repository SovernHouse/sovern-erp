import { Loader } from 'lucide-react'

export default function LoadingSpinner({ message = 'Loading...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader className={`${sizeClasses[size]} animate-spin text-primary-600 mb-4`} />
      <p className="text-slate-600 text-sm">{message}</p>
    </div>
  )
}
