import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  FormGroup,
  Input,
  Select,
  Button,
  Textarea,
} from '../../components/FormFields';
import { productsAPI, pricesAPI } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';

function PriceUpdateForm() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formData, setFormData] = useState({
    productId: '',
    newPrice: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    reason: '',
  });

  const navigate = useNavigate();

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

  const handleProductChange = (productId) => {
    setFormData({ ...formData, productId });
    const product = products.find((p) => p.id.toString() === productId);
    setSelectedProduct(product);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.productId) newErrors.productId = 'Product is required';
    if (!formData.newPrice) newErrors.newPrice = 'New price is required';
    if (isNaN(parseFloat(formData.newPrice))) {
      newErrors.newPrice = 'Price must be a valid number';
    }
    if (!formData.effectiveDate) newErrors.effectiveDate = 'Effective date is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    setIsSaving(true);
    try {
      await pricesAPI.update(formData.productId, {
        newPrice: parseFloat(formData.newPrice),
        effectiveDate: formData.effectiveDate,
        expiryDate: formData.expiryDate || null,
        reason: formData.reason,
      });

      toast.success('Price updated successfully');
      navigate('/prices');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update price');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/prices')}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-6"
      >
        <ChevronLeft size={20} />
        Back to Price List
      </button>

      <div className="bg-white rounded-lg shadow p-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Update Product Price</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Selection */}
          <FormGroup label="Product" required error={errors.productId}>
            <Select
              value={formData.productId}
              onChange={(e) => handleProductChange(e.target.value)}
              options={products.map((p) => ({
                value: p.id.toString(),
                label: `${p.productCode} - ${p.productName}`,
              }))}
              placeholder="Select a product"
              error={!!errors.productId}
            />
          </FormGroup>

          {/* Current Price Display */}
          {selectedProduct && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider">
                    Current Price
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(selectedProduct.currentPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wider">
                    MOQ
                  </p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedProduct.moq} units
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* New Price */}
          <FormGroup label="New Price (USD)" required error={errors.newPrice}>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.newPrice}
              onChange={(e) =>
                setFormData({ ...formData, newPrice: e.target.value })
              }
              error={!!errors.newPrice}
            />
            {selectedProduct && formData.newPrice && (
              <p className="text-sm text-gray-600 mt-2">
                {parseFloat(formData.newPrice) > selectedProduct.currentPrice ? (
                  <span className="text-red-600">
                    Increase of{' '}
                    {formatCurrency(
                      parseFloat(formData.newPrice) - selectedProduct.currentPrice
                    )}{' '}
                    (
                    {(
                      ((parseFloat(formData.newPrice) -
                        selectedProduct.currentPrice) /
                        selectedProduct.currentPrice) *
                      100
                    ).toFixed(2)}
                    %)
                  </span>
                ) : (
                  <span className="text-green-600">
                    Decrease of{' '}
                    {formatCurrency(
                      selectedProduct.currentPrice - parseFloat(formData.newPrice)
                    )}{' '}
                    (
                    {(
                      ((selectedProduct.currentPrice -
                        parseFloat(formData.newPrice)) /
                        selectedProduct.currentPrice) *
                      100
                    ).toFixed(2)}
                    %)
                  </span>
                )}
              </p>
            )}
          </FormGroup>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <FormGroup label="Effective Date" required error={errors.effectiveDate}>
              <Input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) =>
                  setFormData({ ...formData, effectiveDate: e.target.value })
                }
                error={!!errors.effectiveDate}
              />
            </FormGroup>

            <FormGroup label="Expiry Date (optional)">
              <Input
                type="date"
                value={formData.expiryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expiryDate: e.target.value })
                }
              />
            </FormGroup>
          </div>

          {/* Reason */}
          <FormGroup label="Reason for Update">
            <Textarea
              placeholder="e.g., Market adjustment, cost increase, promotional pricing..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              rows={3}
            />
          </FormGroup>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
            <Button type="submit" isLoading={isSaving}>
              Update Price
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/prices')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PriceUpdateForm;
