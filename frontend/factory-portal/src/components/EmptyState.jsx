import React from 'react';
import { AlertCircle } from 'lucide-react';

function EmptyState({ icon: Icon = AlertCircle, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon size={48} className="text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 text-center mb-6 max-w-md">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
