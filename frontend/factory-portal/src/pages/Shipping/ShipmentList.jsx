import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit2, FileText } from 'lucide-react';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { Button } from '../../components/FormFields';
import { shippingAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { SHIPMENT_STATUS } from '../../utils/constants';
import toast from 'react-hot-toast';

function ShipmentList() {
  const [shipments, setShipments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadShipments();
  }, [filterStatus, searchTerm]);

  const loadShipments = async () => {
    setIsLoading(true);
    try {
      const response = await shippingAPI.listShipments({
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: searchTerm,
      });
      setShipments(response.data);
    } catch (error) {
      toast.error('Failed to load shipments');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { key: 'shipmentId', label: 'Shipment ID', sortable: true },
    { key: 'poNumber', label: 'PO Number', sortable: true },
    { key: 'customerName', label: 'Customer', sortable: true },
    { key: 'carrier', label: 'Carrier', sortable: true },
    { key: 'vessel', label: 'Vessel', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'shipDate',
      label: 'Ship Date',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'eta',
      label: 'ETA',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/shipping/${row.id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
            title="View"
          >
            <Eye size={18} />
          </button>
          {row.status === 'preparing' && (
            <button
              onClick={() => navigate(`/shipping/${row.id}/edit`)}
              className="p-2 hover:bg-gray-100 rounded-lg text-green-600 transition-colors"
              title="Edit"
            >
              <Edit2 size={18} />
            </button>
          )}
          <button
            onClick={() => navigate(`/shipping/${row.id}/documents`)}
            className="p-2 hover:bg-gray-100 rounded-lg text-purple-600 transition-colors"
            title="Documents"
          >
            <FileText size={18} />
          </button>
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    ...Object.entries(SHIPMENT_STATUS).map(([key, value]) => ({
      value: value,
      label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
    })),
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Shipments</h1>
          <p className="text-gray-600 mt-1">Manage all shipments and tracking</p>
        </div>
        <Button
          onClick={() => navigate('/shipping/new')}
          className="flex items-center gap-2"
        >
          <Plus size={20} />
          Create Shipment
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by shipment ID or PO number..."
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

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={shipments}
          isLoading={isLoading}
          emptyMessage="No shipments found"
          onRowClick={(row) => navigate(`/shipping/${row.id}`)}
        />
      </div>
    </div>
  );
}

export default ShipmentList;
