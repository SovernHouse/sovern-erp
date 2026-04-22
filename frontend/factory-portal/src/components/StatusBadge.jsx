import React from 'react';

function StatusBadge({ status, variant = 'default' }) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    shipped: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-emerald-100 text-emerald-800',
    scheduled: 'bg-cyan-100 text-cyan-800',
    ready: 'bg-lime-100 text-lime-800',
    draft: 'bg-slate-100 text-slate-800',
  };

  const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
  const colorClass = statusColors[status?.toLowerCase()] || statusColors.default;

  return <span className={`${baseClasses} ${colorClass}`}>{status}</span>;
}

export default StatusBadge;
