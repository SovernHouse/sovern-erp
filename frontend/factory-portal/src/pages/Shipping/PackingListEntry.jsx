import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Button, Input, FormGroup } from '../../components/FormFields';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import { shippingAPI } from '../../services/api';
import { formatNumber } from '../../utils/formatters';
import toast from 'react-hot-toast';

function PackingListEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shipment, setShipment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [packingItems, setPackingItems] = useState([]);
  const [newItem, setNewItem] = useState({
    itemNumber: '',
    quantity: '',
    description: '',
    weight: '',
    dimensions: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, itemIndex: null });

  useEffect(() => {
    loadShipment();
  }, [id]);

  const loadShipment = async () => {
    setIsLoading(true);
    try {
      const response = await shippingAPI.getShipment(id);
      setShipment(response.data);
      setPackingItems(response.data.packingList || []);
    } catch (error) {
      toast.error('Failed to load shipment');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    if (!newItem.itemNumber || !newItem.quantity) {
      toast.error('Item number and quantity are required');
      return;
    }

    setPackingItems([
      ...packingItems,
      {
        ...newItem,
        id: Date.now(),
        quantity: parseInt(newItem.quantity),
        weight: newItem.weight ? parseFloat(newItem.weight) : 0,
      },
    ]);

    setNewItem({
      itemNumber: '',
      quantity: '',
      description: '',
      weight: '',
      dimensions: '',
    });

    toast.success('Item added');
  };

  const handleRemoveItem = (index) => {
    setPackingItems(packingItems.filter((_, i) => i !== index));
    setDeleteConfirm({ open: false, itemIndex: null });
    toast.success('Item removed');
  };

  const handleSave = async () => {
    if (packingItems.length === 0) {
      toast.error('Please add at least one item to the packing list');
      return;
    }

    setIsSaving(true);
    try {
      await shippingAPI.updatePackingList(id, { items: packingItems });
      toast.success('Packing list saved successfully');
      await loadShipment();
    } catch (error) {
      toast.error('Failed to save packing list');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!shipment) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Shipment not found</p>
      </div>
    );
  }

  const columns = [
    { key: 'itemNumber', label: 'Item #', sortable: true },
    { key: 'description', label: 'Description', sortable: true },
    {
      key: 'quantity',
      label: 'Qty',
      render: (qty) => formatNumber(qty),
    },
    {
      key: 'weight',
      label: 'Weight (kg)',
      render: (weight) => weight ? formatNumber(weight, 2) : '-',
    },
    { key: 'dimensions', label: 'Dimensions', render: (dims) => dims || '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => {
            const index = packingItems.findIndex((item) => item.id === row.id);
            setDeleteConfirm({ open: true, itemIndex: index });
          }}
          className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  const totalWeight = packingItems.reduce((sum, item) => sum + (item.weight || 0), 0);
  const totalQuantity = packingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(`/shipping/${id}`)}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-2"
      >
        <ChevronLeft size={20} />
        Back to Shipment
      </button>

      <div>
        <h1 className="text-3xl font-bold text-gray-800">Packing List</h1>
        <p className="text-gray-600 mt-1">
          Detailed packing list for shipment {shipment.shipmentId}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-factory-600">
          <p className="text-sm text-gray-600">Total Items</p>
          <p className="text-2xl font-bold text-gray-800">{packingItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
          <p className="text-sm text-gray-600">Total Quantity</p>
          <p className="text-2xl font-bold text-gray-800">{formatNumber(totalQuantity)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-600">
          <p className="text-sm text-gray-600">Total Weight</p>
          <p className="text-2xl font-bold text-gray-800">{formatNumber(totalWeight, 2)} kg</p>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={20} />
          Add Item
        </h2>

        <div className="grid grid-cols-5 gap-4 mb-4">
          <FormGroup label="Item #">
            <Input
              placeholder="e.g., 001"
              value={newItem.itemNumber}
              onChange={(e) =>
                setNewItem({ ...newItem, itemNumber: e.target.value })
              }
            />
          </FormGroup>

          <FormGroup label="Quantity">
            <Input
              type="number"
              placeholder="Units"
              value={newItem.quantity}
              onChange={(e) =>
                setNewItem({ ...newItem, quantity: e.target.value })
              }
            />
          </FormGroup>

          <FormGroup label="Weight (kg)">
            <Input
              type="number"
              step="0.1"
              placeholder="kg"
              value={newItem.weight}
              onChange={(e) =>
                setNewItem({ ...newItem, weight: e.target.value })
              }
            />
          </FormGroup>

          <FormGroup label="Dimensions">
            <Input
              placeholder="L×W×H (cm)"
              value={newItem.dimensions}
              onChange={(e) =>
                setNewItem({ ...newItem, dimensions: e.target.value })
              }
            />
          </FormGroup>

          <FormGroup label="">
            <Button
              type="button"
              onClick={handleAddItem}
              className="w-full flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Add
            </Button>
          </FormGroup>
        </div>

        <FormGroup label="Description">
          <input
            type="text"
            placeholder="Product description, grade, color, etc."
            value={newItem.description}
            onChange={(e) =>
              setNewItem({ ...newItem, description: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
          />
        </FormGroup>
      </div>

      {/* Packing Items Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Packing List Items</h2>
          {packingItems.length > 0 ? (
            <DataTable
              columns={columns}
              data={packingItems}
              isLoading={false}
              emptyMessage="No items in packing list"
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No items added yet. Add items above to create a packing list.
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {packingItems.length > 0 && (
        <div className="flex items-center gap-4">
          <Button onClick={handleSave} isLoading={isSaving}>
            Save Packing List
          </Button>
          <Button variant="outline" onClick={() => navigate(`/shipping/${id}`)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, itemIndex: null })}
        onConfirm={() =>
          handleRemoveItem(deleteConfirm.itemIndex)
        }
        title="Remove Item"
        message="Are you sure you want to remove this item from the packing list?"
        confirmText="Remove"
        isDangerous={false}
      />
    </div>
  );
}

export default PackingListEntry;
