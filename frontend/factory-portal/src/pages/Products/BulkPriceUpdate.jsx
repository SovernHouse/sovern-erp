import React, { useState, useEffect } from 'react';
import { Upload, Download, Plus, Trash2 } from 'lucide-react';
import { FormGroup, Input, Button, Select } from '../../components/FormFields';
import DataTable from '../../components/DataTable';
import { productsAPI, pricesAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function BulkPriceUpdate() {
  const [products, setProducts] = useState([]);
  const [priceUpdates, setPriceUpdates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await productsAPI.list({ limit: 1000 });
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const addPriceUpdate = () => {
    setPriceUpdates([
      ...priceUpdates,
      {
        id: Date.now(),
        productId: '',
        productName: '',
        currentPrice: '',
        newPrice: '',
      },
    ]);
  };

  const removePriceUpdate = (id) => {
    setPriceUpdates(priceUpdates.filter((update) => update.id !== id));
  };

  const updatePriceRow = (id, field, value) => {
    setPriceUpdates(
      priceUpdates.map((update) => {
        if (update.id === id) {
          if (field === 'productId') {
            const product = products.find((p) => p.id.toString() === value);
            return {
              ...update,
              [field]: value,
              productName: product?.productName || '',
              currentPrice: product?.currentPrice || '',
            };
          }
          return { ...update, [field]: value };
        }
        return update;
      })
    );
  };

  const validateUpdates = () => {
    const errors = [];
    priceUpdates.forEach((update, index) => {
      if (!update.productId) errors.push(`Row ${index + 1}: Product is required`);
      if (!update.newPrice) errors.push(`Row ${index + 1}: New price is required`);
      if (isNaN(parseFloat(update.newPrice))) {
        errors.push(`Row ${index + 1}: New price must be a valid number`);
      }
    });

    if (errors.length > 0) {
      errors.forEach((error) => toast.error(error));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (priceUpdates.length === 0) {
      toast.error('Please add at least one price update');
      return;
    }

    if (!validateUpdates()) {
      return;
    }

    setIsSaving(true);
    try {
      const updates = priceUpdates.map((update) => ({
        productId: update.productId,
        newPrice: parseFloat(update.newPrice),
        effectiveDate,
        expiryDate: expiryDate || null,
      }));

      await pricesAPI.bulkUpdate({ updates });
      toast.success('Prices updated successfully');
      setPriceUpdates([]);
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setExpiryDate('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update prices');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportTemplate = () => {
    const headers = ['Product Code', 'Product Name', 'Current Price', 'New Price'];
    const rows = products.map((p) => [p.productCode, p.productName, p.currentPrice, '']);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-update-template-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const priceUpdateColumns = [
    {
      key: 'productId',
      label: 'Product',
      render: (_, row) => (
        <Select
          value={row.productId}
          onChange={(e) => updatePriceRow(row.id, 'productId', e.target.value)}
          options={products.map((p) => ({
            value: p.id.toString(),
            label: `${p.productCode} - ${p.productName}`,
          }))}
          placeholder="Select product"
        />
      ),
    },
    {
      key: 'currentPrice',
      label: 'Current Price',
      render: (price) => price ? formatCurrency(price) : '-',
    },
    {
      key: 'newPrice',
      label: 'New Price',
      render: (price, row) => (
        <Input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={row.newPrice}
          onChange={(e) => updatePriceRow(row.id, 'newPrice', e.target.value)}
          className="w-32"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Action',
      render: (_, row) => (
        <button
          onClick={() => removePriceUpdate(row.id)}
          className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
        >
          <Trash2 size={18} />
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Bulk Price Update</h1>
        <p className="text-gray-600 mt-1">
          Update prices for multiple products with effective dates
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Effective Date" required>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </FormGroup>

            <FormGroup label="Expiry Date (optional)">
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </FormGroup>
          </div>

          {/* Price Updates Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Price Updates</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportTemplate}
                  className="flex items-center gap-2"
                >
                  <Download size={18} />
                  Export Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPriceUpdate}
                  className="flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Row
                </Button>
              </div>
            </div>

            {priceUpdates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {priceUpdateColumns.map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceUpdates.map((row, index) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        {priceUpdateColumns.map((col) => (
                          <td key={col.key} className="px-4 py-3 text-sm">
                            {col.render
                              ? col.render(row[col.key], row)
                              : row[col.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No price updates added yet</p>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
            <Button type="submit" isLoading={isSaving} disabled={priceUpdates.length === 0}>
              Update Prices
            </Button>
            <span className="text-sm text-gray-600">
              {priceUpdates.length} update(s) ready
            </span>
          </div>
        </form>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border-l-4 border-blue-600 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to use bulk price update:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • Click "Add Row" to add new price updates or export the template
          </li>
          <li>• Select a product and enter the new price</li>
          <li>• Set effective date (when price change starts)</li>
          <li>• Optionally set expiry date (when price change ends)</li>
          <li>• Click "Update Prices" to apply all changes at once</li>
        </ul>
      </div>
    </div>
  );
}

export default BulkPriceUpdate;
