import React, { useState, useEffect } from 'react';
import { ChevronRight, MessageSquare, Upload } from 'lucide-react';
import { Button, Textarea, Select } from '../../components/FormFields';
import FileUpload from '../../components/FileUpload';
import Modal from '../../components/Modal';
import { poAPI, productionAPI } from '../../services/api';
import { formatDate, formatNumber } from '../../utils/formatters';
import { PRODUCTION_STATUS } from '../../utils/constants';
import toast from 'react-hot-toast';

function ProductionTracker() {
  const [pos, setPOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPO, setExpandedPO] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [productionData, setProductionData] = useState({});
  const [noteData, setNoteData] = useState({});
  const [photoData, setPhotoData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProductionData();
  }, []);

  const loadProductionData = async () => {
    setIsLoading(true);
    try {
      const response = await poAPI.list({ status: 'confirmed' });
      const posWithProduction = response.data;
      setPOs(posWithProduction);
    } catch (error) {
      toast.error('Failed to load production data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (poId, itemId) => {
    if (!productionData[itemId]?.status) {
      toast.error('Please select a status');
      return;
    }

    setIsSaving(true);
    try {
      await poAPI.updateItemStatus(poId, itemId, {
        status: productionData[itemId].status,
        completionDate: productionData[itemId].completionDate || null,
      });
      toast.success('Production status updated');
      await loadProductionData();
      setEditingItem(null);
    } catch (error) {
      toast.error('Failed to update production status');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async (itemId) => {
    if (!noteData[itemId]?.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsSaving(true);
    try {
      await productionAPI.addProductionNote(itemId, noteData[itemId]);
      toast.success('Note added successfully');
      setNoteData({ ...noteData, [itemId]: '' });
      await loadProductionData();
    } catch (error) {
      toast.error('Failed to add note');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadPhotos = async (itemId, files) => {
    if (!files || files.length === 0) {
      toast.error('Please select photos');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('photos', file);
      });
      await productionAPI.uploadProductionPhoto(itemId, formData);
      toast.success('Photos uploaded successfully');
      setPhotoData({ ...photoData, [itemId]: [] });
      await loadProductionData();
    } catch (error) {
      toast.error('Failed to upload photos');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const getProgressPercentage = (item) => {
    const statuses = {
      not_started: 0,
      in_progress: 33,
      quality_check: 66,
      ready_for_shipment: 100,
      completed: 100,
    };
    return statuses[item.status] || 0;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Production Tracker</h1>
        <p className="text-gray-600 mt-1">Track production progress for confirmed POs</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-factory-600"></div>
        </div>
      ) : pos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600">No confirmed purchase orders to track</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pos.map((po) => (
            <div key={po.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* PO Header - Collapsible */}
              <button
                onClick={() =>
                  setExpandedPO(expandedPO === po.id ? null : po.id)
                }
                className="w-full p-6 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1 text-left">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{po.poNumber}</h3>
                    <p className="text-gray-600">{po.customerName}</p>
                  </div>
                </div>
                <ChevronRight
                  size={24}
                  className={`text-gray-400 transition-transform ${
                    expandedPO === po.id ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* PO Items - Expandable */}
              {expandedPO === po.id && (
                <div className="border-t border-gray-200 divide-y divide-gray-200">
                  {po.items.map((item, index) => (
                    <div key={index} className="p-6 hover:bg-gray-50">
                      <div className="space-y-4">
                        {/* Item Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {item.productName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Qty: {formatNumber(item.quantity)} units
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'ready_for_shipment'
                              ? 'bg-green-100 text-green-800'
                              : item.status === 'quality_check'
                              ? 'bg-blue-100 text-blue-800'
                              : item.status === 'in_progress'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status
                              .charAt(0)
                              .toUpperCase() +
                              item.status.slice(1).replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Production Progress
                            </span>
                            <span className="text-sm font-semibold text-factory-600">
                              {getProgressPercentage(item)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="bg-factory-600 h-3 rounded-full transition-all"
                              style={{
                                width: `${getProgressPercentage(item)}%`,
                              }}
                            ></div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2">
                          {editingItem === `${po.id}-${index}` ? (
                            <div className="flex items-center gap-2 w-full">
                              <Select
                                value={productionData[`${po.id}-${index}`]?.status || ''}
                                onChange={(e) =>
                                  setProductionData({
                                    ...productionData,
                                    [`${po.id}-${index}`]: {
                                      ...productionData[`${po.id}-${index}`],
                                      status: e.target.value,
                                    },
                                  })
                                }
                                options={Object.entries(PRODUCTION_STATUS).map(
                                  ([key, value]) => ({
                                    value: value,
                                    label: value
                                      .charAt(0)
                                      .toUpperCase() +
                                      value.slice(1).replace(/_/g, ' '),
                                  })
                                )}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleStatusUpdate(po.id, `${po.id}-${index}`)
                                }
                                isLoading={isSaving}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingItem(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setEditingItem(`${po.id}-${index}`)
                              }
                            >
                              Update Status
                            </Button>
                          )}
                        </div>

                        {/* Notes Section */}
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <MessageSquare size={18} className="text-gray-600" />
                            <span className="text-sm font-semibold text-gray-700">
                              Production Notes
                            </span>
                          </div>
                          <Textarea
                            placeholder="Add production notes, issues, or updates..."
                            value={noteData[`${po.id}-${index}`] || ''}
                            onChange={(e) =>
                              setNoteData({
                                ...noteData,
                                [`${po.id}-${index}`]: e.target.value,
                              })
                            }
                            rows={2}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddNote(`${po.id}-${index}`)}
                            isLoading={isSaving}
                            className="mt-2"
                          >
                            Add Note
                          </Button>
                        </div>

                        {/* Photo Upload */}
                        <div className="pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Upload size={18} className="text-gray-600" />
                            <span className="text-sm font-semibold text-gray-700">
                              Production Photos
                            </span>
                          </div>
                          <FileUpload
                            onFilesSelected={(files) => {
                              setPhotoData({
                                ...photoData,
                                [`${po.id}-${index}`]: files,
                              });
                              if (files.length > 0) {
                                handleUploadPhotos(`${po.id}-${index}`, files);
                              }
                            }}
                            accept=".jpg,.jpeg,.png,.webp"
                            multiple={true}
                          />
                        </div>

                        {/* Estimated Completion */}
                        {item.estimatedCompletion && (
                          <div className="pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                              Est. Completion:{' '}
                              <span className="font-semibold text-gray-800">
                                {formatDate(item.estimatedCompletion)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductionTracker;
