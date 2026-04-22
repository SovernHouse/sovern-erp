/**
 * SkeletonLoader - Animated loading placeholders
 * Variants: card, table, text, avatar, chart
 */
export default function SkeletonLoader({ variant = 'card', rows = 3, columns = 4, className = '' }) {
  const pulse = 'animate-pulse bg-gray-200 rounded';

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className={`${pulse} h-4 w-1/3 mb-4`} />
        <div className={`${pulse} h-8 w-2/3 mb-2`} />
        <div className={`${pulse} h-3 w-1/2`} />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`bg-white rounded-lg shadow overflow-hidden ${className}`}>
        <div className="p-4 border-b">
          <div className={`${pulse} h-5 w-1/4`} />
        </div>
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center p-4 space-x-4">
              {Array.from({ length: columns }).map((_, c) => (
                <div key={c} className={`${pulse} h-4 flex-1`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${pulse} h-4`} style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </div>
    );
  }

  if (variant === 'avatar') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div className={`${pulse} h-10 w-10 rounded-full`} />
        <div className="space-y-2 flex-1">
          <div className={`${pulse} h-4 w-1/3`} />
          <div className={`${pulse} h-3 w-1/4`} />
        </div>
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className={`${pulse} h-5 w-1/4 mb-4`} />
        <div className={`${pulse} h-48 w-full`} />
      </div>
    );
  }

  // Default
  return <div className={`${pulse} h-16 w-full ${className}`} />;
}
