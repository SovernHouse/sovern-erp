import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Download } from 'lucide-react';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { Button } from '../../components/FormFields';
import { poAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PO_STATUS } from '../../utils/constants';
import toast from 'react-hot-toast';

function POList() {
  const [pos, setPOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPOs();
  }, [filterStatus, searchTerm]);

  const loadPOs = async () => {
    setIsLoading(true);
    try {
      const response = await poAPI.list({
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchTerm,
      });
      setPOs(response.data);
    } catch (error) {
      toast.error('Failed to load purchase orders');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { key: 'poNumber', label: 'PO Number', sortable: true },
    {
      key: 'poNumber',
      label: 'Client Ref',
      render: (value) => `Client Ref: ${value}`,
      sortable: true,
    },
    {
      key: 'totalValue',
      label: 'Total Value',
      render: (value) => formatCurrency(value),
      sortable: true,
    },
    { key: 'itemCount', label: 'Items', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'createdDate',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (date) => formatDate(date),
      sortable: true,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => navigate(`/purchase-orders/${row.id}`)}
          className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
          title="View"
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    ...Object.entries(PO_STATUS).map(([key, value]) => ({
      value: value,
      label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
    })),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Purchase Orders</h1>
          <p className="text-gray-600 mt-1">All purchase orders from customers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by PO number or customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* POs Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={pos}
          isLoading={isLoading}
          emptyMessage="No purchase orders found"
          onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
        />
      </div>
    </div>
  );
}

export default POList;
