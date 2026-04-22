import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Input, Textarea, FormGroup } from '../../components/FormFields';
import LoadingSpinner from '../../components/LoadingSpinner';
import { poAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function POConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmData, setConfirmData] = useState({
    deliveryDate: '',
    notes: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadPO();
  }, [id]);

  const loadPO = async () => {
    setIsLoading(true);
    try {
      const response = await poAPI.get(id);
      setPO(response.data);
      // Set default delivery date to PO due date
      if (response.data.dueDate) {
        setConfirmData((prev) => ({
          ...prev,
          deliveryDate: response.data.dueDate.split('T')[0],
        }));
      }
    } catch (error) {
      toast.error('Failed to load purchase order');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!confirmData.deliveryDate) {
      newErrors.deliveryDate = 'Delivery date is required';
    }
    if (!confirmData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms to confirm';
    }
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
      await poAPI.confirm(id, confirmData);
      toast.success('Purchase order confirmed successfully');
      navigate('/purchase-orders');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to confirm PO');
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

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={() => navigate(`/purchase-orders/${id}`)}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-2"
      >
        <ChevronLeft size={20} />
        Back to PO Details
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Confirmation Form */}
        <div className="col-span-2 bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Confirm Purchase Order
          </h1>

          {/* Review Section */}
          <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">
                  Please review the order details
                </h3>
                <p className="text-blue-800 text-sm">
                  By confirming this purchase order, you commit to delivering all items
                  by the specified delivery date. Ensure you can meet this deadline before
                  confirming.
                </p>
              </div>
            </div>
          </div>

          {/* PO Summary */}
          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">Order Summary</h2>
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">PO Number</p>
                <p className="text-lg font-semibold text-gray-800">{po.poNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="text-lg font-semibold text-gray-800">
                  {po.customerName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-lg font-semibold text-gray-800">
                  {formatCurrency(po.totalValue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Items</p>
                <p className="text-lg font-semibold text-gray-800">{po.itemCount}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Items to Deliver</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="px-4 py-3 text-sm text-gray-800">
                        {item.productName}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-800">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-800">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCurrency(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmation Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormGroup
              label="Delivery Commitment Date"
              required
              error={errors.deliveryDate}
            >
              <Input
                type="date"
                value={confirmData.deliveryDate}
                onChange={(e) =>
                  setConfirmData({
                    ...confirmData,
                    deliveryDate: e.target.value,
                  })
                }
                error={!!errors.deliveryDate}
              />
              <p className="text-sm text-gray-600 mt-2">
                You confirm to deliver all items by this date
              </p>
            </FormGroup>

            <FormGroup label="Internal Notes (Optional)">
              <Textarea
                placeholder="Add any internal notes or production notes..."
                value={confirmData.notes}
                onChange={(e) =>
                  setConfirmData({ ...confirmData, notes: e.target.value })
                }
                rows={3}
              />
            </FormGroup>

            {/* Terms Agreement */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmData.agreeToTerms}
                  onChange={(e) =>
                    setConfirmData({
                      ...confirmData,
                      agreeToTerms: e.target.checked,
                    })
                  }
                  className="mt-1 w-4 h-4 text-factory-600 rounded"
                />
                <div>
                  <p className="font-semibold text-gray-800">
                    I confirm and accept the terms
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    I confirm that I have reviewed this purchase order and commit to
                    delivering all items in full and by the specified delivery date. I
                    understand that any delays will be communicated immediately to the
                    trading company.
                  </p>
                </div>
              </label>
              {errors.agreeToTerms && (
                <p className="text-red-600 text-sm mt-2">{errors.agreeToTerms}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
              <Button type="submit" isLoading={isSaving}>
                Confirm Purchase Order
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/purchase-orders/${id}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Side Panel - Important Info */}
        <div className="space-y-4">
          <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-semibold text-green-900">What happens next?</h3>
                <ul className="text-sm text-green-800 mt-2 space-y-1">
                  <li>✓ Order status changes to "Confirmed"</li>
                  <li>✓ Production can begin</li>
                  <li>✓ Customer receives confirmation</li>
                  <li>✓ You can track production progress</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border-l-4 border-amber-600 rounded-lg p-4">
            <h3 className="font-semibold text-amber-900 mb-2">Important</h3>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• Double-check your delivery date</li>
              <li>• Confirm production capacity</li>
              <li>• Ensure sufficient materials</li>
              <li>• Plan shipping timeline</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Order Timeline</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Requested Delivery</p>
                <p className="font-semibold text-gray-800">
                  {formatDate(po.dueDate)}
                </p>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <p className="text-gray-600">Your Commitment</p>
                <p className="font-semibold text-gray-800">
                  {confirmData.deliveryDate
                    ? formatDate(confirmData.deliveryDate)
                    : 'Not set'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default POConfirmation;
