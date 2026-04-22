import React, { useState, useEffect } from 'react';
import { Eye, Download } from 'lucide-react';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { inspectionsAPI } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function InspectionResults() {
  const [inspections, setInspections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [filterResult, setFilterResult] = useState('all');

  useEffect(() => {
    loadResults();
  }, [filterResult]);

  const loadResults = async () => {
    setIsLoading(true);
    try {
      const response = await inspectionsAPI.getResults({
        result: filterResult === 'all' ? undefined : filterResult,
      });
      setInspections(response.data);
    } catch (error) {
      toast.error('Failed to load inspection results');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { key: 'inspectionId', label: 'Inspection ID', sortable: true },
    { key: 'poNumber', label: 'PO Number', sortable: true },
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'completedDate',
      label: 'Completed',
      render: (date) => (date ? formatDate(date) : '-'),
      sortable: true,
    },
    { key: 'inspectorName', label: 'Inspector', sortable: true },
    {
      key: 'result',
      label: 'Result',
      render: (result) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            result === 'passed'
              ? 'bg-green-100 text-green-800'
              : result === 'failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {result.charAt(0).toUpperCase() + result.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => setSelectedInspection(row)}
          className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
        >
          <Eye size={18} />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Inspection Results</h1>
        <p className="text-gray-600 mt-1">View completed quality inspection reports</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-600">
          <p className="text-sm text-gray-600">Total Inspections</p>
          <p className="text-2xl font-bold text-gray-800">{inspections.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
          <p className="text-sm text-gray-600">Passed</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.result === 'passed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600">
          <p className="text-sm text-gray-600">Failed</p>
          <p className="text-2xl font-bold text-gray-800">
            {inspections.filter((i) => i.result === 'failed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-600">
          <p className="text-sm text-gray-600">Rework Required</p>
          <p className="text-2xl font-bold text-gray-800">
            {
              inspections.filter((i) => i.result === 'rework_required').length
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        >
          <option value="all">All Results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="rework_required">Rework Required</option>
        </select>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={inspections}
          isLoading={isLoading}
          emptyMessage="No inspection results found"
        />
      </div>

      {/* Detail Modal */}
      {selectedInspection && (
        <Modal
          isOpen={!!selectedInspection}
          onClose={() => setSelectedInspection(null)}
          title={`Inspection Report - ${selectedInspection.inspectionId}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">PO Number</p>
                <p className="font-semibold text-gray-800">
                  {selectedInspection.poNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Result</p>
                <p className="font-semibold text-gray-800">
                  {selectedInspection.result.charAt(0).toUpperCase() +
                    selectedInspection.result.slice(1).replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Inspector</p>
                <p className="font-semibold text-gray-800">
                  {selectedInspection.inspectorName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="font-semibold text-gray-800">
                  {formatDate(selectedInspection.completedDate)}
                </p>
              </div>
            </div>

            {/* Report */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Inspection Report
              </p>
              <p className="text-gray-700 whitespace-pre-wrap">
                {selectedInspection.reportContent || 'No report provided'}
              </p>
            </div>

            {/* Defects/Issues */}
            {selectedInspection.defects && selectedInspection.defects.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Issues Found
                </p>
                <div className="space-y-2">
                  {selectedInspection.defects.map((defect, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-red-50 rounded border border-red-200"
                    >
                      <span className="text-red-600 font-semibold">•</span>
                      <div>
                        <p className="font-medium text-red-900">{defect.title}</p>
                        <p className="text-sm text-red-800">
                          Severity: {defect.severity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report Download */}
            {selectedInspection.reportUrl && (
              <div>
                <button className="flex items-center gap-2 px-4 py-2 bg-factory-600 text-white rounded-lg hover:bg-factory-700 transition-colors">
                  <Download size={18} />
                  Download Full Report
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default InspectionResults;
