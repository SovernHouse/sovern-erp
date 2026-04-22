import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare, FileText, Truck } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { Button, Textarea, Select } from '../../components/FormFields';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import { poAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PRODUCTION_STATUS } from '../../utils/constants';
import toast from 'react-hot-toast';

function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
  });
  const [itemStatusUpdate, setItemStatusUpdate] = useState({
    itemId: null,
    status: '',
    completionDate: '',
  });

  useEffect(() => {
    loadPO();
  }, [id]);

  const loadPO = async () => {
    setIsLoading(true);
    try {
      const response = await poAPI.get(id);
      setPO(response.data);
    } catch (error) {
      toast.error('Failed to load purchase order');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPO = async () => {
    setIsSaving(true);
    try {
      await poAPI.confirm(id, {
        confirmedDate: new Date().toISOString(),
        notes,
      });
      toast.success('Purchase order confirmed');
      await loadPO();
      setConfirmDialog({ open: false, action: null });
    } catch (error) {
      toast.error('Failed to confirm purchase order');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectPO = async () => {
    setIsSaving(true);
    try {
      await poAPI.reject(id, {
        reason: notes,
      });
      toast.success('Purchase order rejected');
      navigate('/purchase-orders');
    } catch (error) {
      toast.error('Failed to reject purchase order');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItemStatus = async (itemId) => {
    if (!itemStatusUpdate.status) {
      toast.error('Please select a status');
      return;
    }

    setIsSaving(true);
    try {
      await poAPI.updateItemStatus(id, itemId, {
        status: itemStatusUpdate.status,
        completionDate: itemStatusUpdate.completionDate || null,
      });
      toast.success('Item status updated');
      await loadPO();
      setItemStatusUpdate({ itemId: null, status: '', completionDate: '' });
    } catch (error) {
      toast.error('Failed to update item status');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!po) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Purchase order not found</p>
      </div>
    );
  }

  const itemColumns = [
    { key: 'productName', label: 'Product', sortable: true },
    {
      key: 'unitPrice',
      label: 'Unit Price',
      render: (price) => formatCurrency(price),
    },
    { key: 'quantity', label: 'Qty', sortable: true },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (amount) => formatCurrency(amount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'estimatedCompletion',
      label: 'Est. Completion',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        itemStatusUpdate.itemId === row.id ? (
          <div className="flex items-center gap-2">
            <Select
              value={itemStatusUpdate.status}
              onChange={(e) =>
                setItemStatusUpdate({
                  ...itemStatusUpdate,
                  status: e.target.value,
                })
              }
              options={Object.entries(PRODUCTION_STATUS).map(([key, value]) => ({
                value: value,
                label: value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' '),
              }))}
              placeholder="Select status"
              className="w-32"
            />
            <Button
              size="sm"
              onClick={() => handleUpdateItemStatus(row.id)}
              isLoading={isSaving}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setItemStatusUpdate({
                  itemId: null,
                  status: '',
                  completionDate: '',
                })
              }
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setItemStatusUpdate({ ...itemStatusUpdate, itemId: row.id })
            }
          >
            Update
          </Button>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate('/purchase-orders')}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-2"
      >
        <ChevronLeft size={20} />
        Back to Purchase Orders
      </button>

      {/* PO Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{po.poNumber}</h1>
            <p className="text-gray-600 mt-1">{po.customerName}</p>
          </div>
          <StatusBadge status={po.status} />
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 uppercase">Total Value</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(po.totalValue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 uppercase">Items</p>
            <p className="text-2xl font-bold text-gray-800">{po.itemCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 uppercase">Created</p>
            <p className="text-lg text-gray-800">{formatDate(po.createdDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 uppercase">Due Date</p>
            <p className="text-lg text-gray-800">{formatDate(po.dueDate)}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {po.status === 'pending' && (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setConfirmDialog({ open: true, action: 'confirm' })}
            className="flex items-center gap-2"
          >
            <Truck size={18} />
            Confirm PO
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmDialog({ open: true, action: 'reject' })}
          >
            Reject PO
          </Button>
        </div>
      )}

      {/* PO Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Items</h2>
        <DataTable
          columns={itemColumns}
          data={po.items}
          isLoading={false}
          emptyMessage="No items in this PO"
        />
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-2 gap-6">
        {/* Shipping Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Truck size={20} />
            Shipping Information
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-600 uppercase">Destination Port</p>
              <p className="text-gray-800">{po.destinationPort || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Shipping Terms</p>
              <p className="text-gray-800">{po.shippingTerms || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase">Delivery Date</p>
              <p className="text-gray-800">
                {po.deliveryDate ? formatDate(po.deliveryDate) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Special Requirements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText size={20} />
            Special Instructions
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap">
            {po.specialInstructions || 'No special instructions'}
          </p>
        </div>
      </div>

      {/* Notes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare size={20} />
          Notes
        </h2>
        <Textarea
          placeholder="Add notes about this purchase order..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
        {po.status === 'pending' && (
          <p className="text-sm text-gray-600 mt-2">
            Notes will be saved with PO confirmation or rejection
          </p>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, action: null })}
        onConfirm={
          confirmDialog.action === 'confirm'
            ? handleConfirmPO
            : handleRejectPO
        }
        title={
          confirmDialog.action === 'confirm'
            ? 'Confirm Purchase Order'
            : 'Reject Purchase Order'
        }
        message={
          confirmDialog.action === 'confirm'
            ? 'Are you confirming this purchase order? You will be committed to the delivery date.'
            : 'Are you sure you want to reject this purchase order?'
        }
        confirmText={confirmDialog.action === 'confirm' ? 'Confirm' : 'Reject'}
        isDangerous={confirmDialog.action === 'reject'}
        isLoading={isSaving}
      />
    </div>
  );
}

export default PODetail;
