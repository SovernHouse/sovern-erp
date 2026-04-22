import React from 'react'
import { Link } from 'react-router-dom'
import { InboxIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon = InboxIcon,
  title = 'No data',
  message = 'There is nothing to display here.',
  action,
  actionText = 'Go back',
  actionLink = -1,
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 py-12 px-4">
      <div className="mb-4 p-4 bg-gray-100 rounded-full text-gray-400">
        <Icon size={48} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center max-w-md mb-6">{message}</p>
      {action ? (
        <button
          onClick={action}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          {actionText}
        </button>
      ) : (
        <Link
          to={actionLink === -1 ? -1 : actionLink}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          {actionText}
        </Link>
      )}
    </div>
  )
}
