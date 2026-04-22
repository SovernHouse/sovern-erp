import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  FormGroup,
  Input,
  Textarea,
  Select,
  Button,
} from '../../components/FormFields';
import LoadingSpinner from '../../components/LoadingSpinner';
import { shippingAPI, poAPI } from '../../services/api';
import toast from 'react-hot-toast';

function ShipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [pos, setPOs] = useState([]);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    poId: '',
    carrier: '',
    vessel: '',
    containerNumber: '',
    loadingPort: '',
    destinationPort: '',
    shipDate: new Date().toISOString().split('T')[0],
    eta: '',
    etd: '',
    status: 'preparing',
    remarks: '',
  });

  useEffect(() => {
    loadPOs();
    if (id) {
      loadShipment();
    }
  }, [id]);

  const loadPOs = async () => {
    try {
      const response = await poAPI.list({ status: 'confirmed' });
      setPOs(response.data);
    } catch (error) {
      toast.error('Failed to load purchase orders');
      console.error(error);
    }
  };

  const loadShipment = async () => {
    try {
      const response = await shippingAPI.getShipment(id);
      setFormData(response.data);
    } catch (error) {
      toast.error('Failed to load shipment');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.poId) newErrors.poId = 'Purchase order is required';
    if (!formData.carrier) newErrors.carrier = 'Carrier is required';
    if (!formData.shipDate) newErrors.shipDate = 'Ship date is required';

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
      if (id) {
        await shippingAPI.updateShipment(id, formData);
        toast.success('Shipment updated successfully');
      } else {
        await shippingAPI.createShipment(formData);
        toast.success('Shipment created successfully');
      }
      navigate('/shipping');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save shipment');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/shipping')}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-6"
      >
        <ChevronLeft size={20} />
        Back to Shipments
      </button>

      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {id ? 'Edit Shipment' : 'Create New Shipment'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Purchase Order Selection */}
          <FormGroup label="Purchase Order" required error={errors.poId}>
            <Select
              value={formData.poId}
              onChange={(e) =>
                setFormData({ ...formData, poId: e.target.value })
              }
              options={pos.map((p) => ({
                value: p.id.toString(),
                label: `${p.poNumber} - ${p.customerName}`,
              }))}
              placeholder="Select a purchase order"
              error={!!errors.poId}
              disabled={!!id}
            />
          </FormGroup>

          {/* Carrier Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Carrier Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="Carrier Name" required error={errors.carrier}>
                <Input
                  placeholder="e.g., CMA CGM, COSCO, Maersk"
                  value={formData.carrier}
                  onChange={(e) =>
                    setFormData({ ...formData, carrier: e.target.value })
                  }
                  error={!!errors.carrier}
                />
              </FormGroup>

              <FormGroup label="Vessel/Ship Name">
                <Input
                  placeholder="Vessel name"
                  value={formData.vessel}
                  onChange={(e) =>
                    setFormData({ ...formData, vessel: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Container Number">
                <Input
                  placeholder="e.g., CONT123456"
                  value={formData.containerNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, containerNumber: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Status">
                <Select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  options={[
                    { value: 'preparing', label: 'Preparing' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'shipped', label: 'Shipped' },
                    { value: 'in_transit', label: 'In Transit' },
                    { value: 'delivered', label: 'Delivered' },
                  ]}
                />
              </FormGroup>
            </div>
          </div>

          {/* Port Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Port Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="Loading Port">
                <Input
                  placeholder="e.g., Shanghai Port"
                  value={formData.loadingPort}
                  onChange={(e) =>
                    setFormData({ ...formData, loadingPort: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Destination Port">
                <Input
                  placeholder="e.g., Los Angeles Port"
                  value={formData.destinationPort}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      destinationPort: e.target.value,
                    })
                  }
                />
              </FormGroup>
            </div>
          </div>

          {/* Dates */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Dates</h2>
            <div className="grid grid-cols-3 gap-4">
              <FormGroup label="Ship Date" required error={errors.shipDate}>
                <Input
                  type="date"
                  value={formData.shipDate}
                  onChange={(e) =>
                    setFormData({ ...formData, shipDate: e.target.value })
                  }
                  error={!!errors.shipDate}
                />
              </FormGroup>

              <FormGroup label="Expected Transit Departure (ETD)">
                <Input
                  type="date"
                  value={formData.etd}
                  onChange={(e) =>
                    setFormData({ ...formData, etd: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Estimated Arrival (ETA)">
                <Input
                  type="date"
                  value={formData.eta}
                  onChange={(e) =>
                    setFormData({ ...formData, eta: e.target.value })
                  }
                />
              </FormGroup>
            </div>
          </div>

          {/* Remarks */}
          <FormGroup label="Remarks">
            <Textarea
              placeholder="Any special handling instructions or remarks..."
              value={formData.remarks}
              onChange={(e) =>
                setFormData({ ...formData, remarks: e.target.value })
              }
              rows={3}
            />
          </FormGroup>

          {/* Submit Buttons */}
          <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
            <Button type="submit" isLoading={isSaving}>
              {id ? 'Update Shipment' : 'Create Shipment'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/shipping')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShipmentForm;
