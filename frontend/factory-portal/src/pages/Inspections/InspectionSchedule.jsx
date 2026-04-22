import React, { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import { Button } from '../../components/FormFields';
import { inspectionsAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function InspectionSchedule() {
  const [inspections, setInspections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const response = await inspectionsAPI.getSchedule();
      setInspections(response.data);
    } catch (error) {
      toast.error('Failed to load inspection schedule');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAvailability = async (inspectionId) => {
    setIsSaving(true);
    try {
      await inspectionsAPI.confirmInspection(inspectionId, {
        confirmedDate: new Date().toISOString(),
      });
      toast.success('Availability confirmed');
      await loadSchedule();
    } catch (error) {
      toast.error('Failed to confirm availability');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    { key: 'inspectionId', label: 'Inspection ID', sortable: true },
    { key: 'poNumber', label: 'PO Number', sortable: true },
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'scheduledDate',
      label: 'Scheduled Date',
      render: (date) => formatDate(date),
      sortable: true,
    },
    { key: 'inspectorName', label: 'Inspector', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        row.status === 'scheduled' ? (
          <Button
            size="sm"
            onClick={() => handleConfirmAvailability(row.id)}
            isLoading={isSaving}
          >
            Confirm Availability
          </Button>
        ) : (
          <span className="text-xs text-gray-600">Confirmed</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Inspection Schedule</h1>
        <p className="text-gray-600 mt-1">
          Scheduled quality inspections for your products
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-factory-600">
          <p className="text-sm text-gray-600">Total Scheduled</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.status === 'scheduled').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
          <p className="text-sm text-gray-600">Confirmed</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.status === 'confirmed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.status === 'completed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
          <p className="text-sm text-gray-600">Pending Action</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.status === 'scheduled').length}
          </p>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={inspections}
          isLoading={isLoading}
          emptyMessage="No scheduled inspections"
        />
      </div>
    </div>
  );
}

export default InspectionSchedule;
