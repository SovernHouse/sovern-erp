import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Select, Textarea } from '../../components/FormFields';
import { inspectionsAPI } from '../../services/api';
import { INSPECTION_CHECKLIST } from '../../utils/constants';
import toast from 'react-hot-toast';

function InspectionPrep() {
  const [inspections, setInspections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    setIsLoading(true);
    try {
      const response = await inspectionsAPI.getSchedule();
      const scheduled = response.data.filter((i) => i.status === 'scheduled');
      setInspections(scheduled);
      if (scheduled.length > 0) {
        loadChecklist(scheduled[0].id);
      }
    } catch (error) {
      toast.error('Failed to load inspections');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChecklist = async (inspectionId) => {
    try {
      const response = await inspectionsAPI.getPreparationChecklist(
        inspectionId
      );
      setChecklist(response.data);
    } catch (error) {
      toast.error('Failed to load checklist');
      console.error(error);
    }
  };

  const handleInspectionSelect = (inspection) => {
    setSelectedInspection(inspection);
    loadChecklist(inspection.id);
  };

  const handleChecklistUpdate = async (itemId, isComplete) => {
    setIsSaving(true);
    try {
      await inspectionsAPI.updateChecklistItem(
        selectedInspection.id,
        itemId,
        { isComplete }
      );
      setChecklist(
        checklist.map((item) =>
          item.id === itemId ? { ...item, isComplete } : item
        )
      );
      toast.success('Checklist updated');
    } catch (error) {
      toast.error('Failed to update checklist');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const completedItems = checklist.filter((item) => item.isComplete).length;
  const completionPercentage =
    checklist.length > 0
      ? Math.round((completedItems / checklist.length) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Inspection Preparation</h1>
        <p className="text-gray-600 mt-1">
          Prepare for upcoming quality inspections
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Upcoming Inspections */}
        <div className="bg-white rounded-lg shadow p-6 h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Upcoming Inspections
          </h2>

          {inspections.length === 0 ? (
            <p className="text-gray-600 text-sm">No scheduled inspections</p>
          ) : (
            <div className="space-y-2">
              {inspections.map((inspection) => (
                <button
                  key={inspection.id}
                  onClick={() => handleInspectionSelect(inspection)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedInspection?.id === inspection.id
                      ? 'border-factory-600 bg-factory-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-semibold text-gray-800 text-sm">
                    {inspection.inspectionId}
                  </p>
                  <p className="text-xs text-gray-600">
                    {inspection.poNumber}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
          {selectedInspection ? (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-800">
                    Preparation Checklist
                  </h2>
                  <span className="text-sm font-semibold text-factory-600">
                    {completionPercentage}% complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-factory-600 h-2 rounded-full transition-all"
                    style={{ width: `${completionPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-3">
                {checklist.length === 0 ? (
                  <p className="text-gray-600 text-sm">No checklist items</p>
                ) : (
                  checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={item.isComplete || false}
                        onChange={(e) =>
                          handleChecklistUpdate(item.id, e.target.checked)
                        }
                        disabled={isSaving}
                        className="mt-1 w-5 h-5 text-factory-600 rounded focus:ring-factory-500"
                      />
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            item.isComplete
                              ? 'text-gray-500 line-through'
                              : 'text-gray-800'
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-600">
                          Category: {item.category}
                        </p>
                        {item.notes && (
                          <p className="text-sm text-gray-600 mt-1">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      {item.isComplete && (
                        <CheckCircle2 size={20} className="text-green-600" />
                      )}
                    </label>
                  ))
                )}
              </div>

              {/* Info */}
              <div className="p-4 bg-blue-50 rounded-lg flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 text-sm">
                    Inspection Tips
                  </p>
                  <ul className="text-sm text-blue-800 mt-2 space-y-1">
                    <li>✓ Ensure all products are clean and properly arranged</li>
                    <li>✓ Have all documentation ready for review</li>
                    <li>✓ Provide samples if requested by inspector</li>
                    <li>✓ Have key personnel available during inspection</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Select an inspection to view preparation checklist</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InspectionPrep;
