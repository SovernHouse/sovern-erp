import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Upload } from 'lucide-react';
import {
  FormGroup,
  Input,
  Textarea,
  Select,
  Button,
  Checkbox,
} from '../../components/FormFields';
import FileUpload from '../../components/FileUpload';
import LoadingSpinner from '../../components/LoadingSpinner';
import { productsAPI } from '../../services/api';
import {
  MATERIAL_TYPES,
  FINISHES,
  COLORS,
  PRODUCT_GRADES,
} from '../../utils/constants';
import toast from 'react-hot-toast';

function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    productCode: '',
    productName: '',
    description: '',
    material: '',
    thickness: '',
    width: '',
    length: '',
    finish: '',
    color: '',
    pattern: '',
    grade: '',
    wearLayer: '',
    moq: '',
    leadTime: '',
    currentPrice: '',
    status: 'active',
    hasWarranty: false,
    warrantyYears: '',
  });

  useEffect(() => {
    if (id) {
      loadProduct();
    }
  }, [id]);

  const loadProduct = async () => {
    try {
      const response = await productsAPI.get(id);
      const product = response.data;
      setFormData({
        productCode: product.productCode,
        productName: product.productName,
        description: product.description,
        material: product.material,
        thickness: product.thickness,
        width: product.width,
        length: product.length,
        finish: product.finish,
        color: product.color,
        pattern: product.pattern,
        grade: product.grade,
        wearLayer: product.wearLayer,
        moq: product.moq.toString(),
        leadTime: product.leadTime.toString(),
        currentPrice: product.currentPrice.toString(),
        status: product.status,
        hasWarranty: product.hasWarranty,
        warrantyYears: product.warrantyYears?.toString() || '',
      });
    } catch (error) {
      toast.error('Failed to load product');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.productCode) newErrors.productCode = 'Product code is required';
    if (!formData.productName) newErrors.productName = 'Product name is required';
    if (!formData.material) newErrors.material = 'Material is required';
    if (!formData.currentPrice) newErrors.currentPrice = 'Price is required';
    if (!formData.moq) newErrors.moq = 'MOQ is required';
    if (!formData.leadTime) newErrors.leadTime = 'Lead time is required';
    if (formData.hasWarranty && !formData.warrantyYears) {
      newErrors.warrantyYears = 'Warranty years required when warranty is enabled';
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
      const data = {
        ...formData,
        moq: parseInt(formData.moq),
        leadTime: parseInt(formData.leadTime),
        currentPrice: parseFloat(formData.currentPrice),
        warrantyYears: formData.hasWarranty ? parseInt(formData.warrantyYears) : null,
      };

      if (id) {
        await productsAPI.update(id, data);
        toast.success('Product updated successfully');
      } else {
        const response = await productsAPI.create(data);
        const newProductId = response.data.id;

        // Upload images if any
        if (images.length > 0) {
          const formDataWithImages = new FormData();
          images.forEach((image) => {
            formDataWithImages.append('images', image);
          });
          await productsAPI.uploadImages(newProductId, formDataWithImages);
          toast.success('Product created with images');
        } else {
          toast.success('Product created successfully');
        }
      }

      navigate('/products');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save product');
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
        onClick={() => navigate('/products')}
        className="flex items-center gap-2 text-factory-600 hover:text-factory-700 font-medium mb-6"
      >
        <ChevronLeft size={20} />
        Back to Products
      </button>

      <div className="bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {id ? 'Edit Product' : 'Add New Product'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="Product Code" required error={errors.productCode}>
                <Input
                  placeholder="e.g., FLR-001"
                  value={formData.productCode}
                  onChange={(e) =>
                    setFormData({ ...formData, productCode: e.target.value })
                  }
                  error={!!errors.productCode}
                />
              </FormGroup>

              <FormGroup label="Product Name" required error={errors.productName}>
                <Input
                  placeholder="e.g., Premium Oak Laminate"
                  value={formData.productName}
                  onChange={(e) =>
                    setFormData({ ...formData, productName: e.target.value })
                  }
                  error={!!errors.productName}
                />
              </FormGroup>
            </div>

            <FormGroup label="Description" error={errors.description}>
              <Textarea
                placeholder="Product description and details..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
              />
            </FormGroup>
          </div>

          {/* Specifications */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Specifications</h2>
            <div className="grid grid-cols-3 gap-4">
              <FormGroup label="Material" required error={errors.material}>
                <Select
                  value={formData.material}
                  onChange={(e) =>
                    setFormData({ ...formData, material: e.target.value })
                  }
                  options={MATERIAL_TYPES.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                  placeholder="Select material"
                  error={!!errors.material}
                />
              </FormGroup>

              <FormGroup label="Thickness (mm)">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 8.5"
                  value={formData.thickness}
                  onChange={(e) =>
                    setFormData({ ...formData, thickness: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Width (mm)">
                <Input
                  type="number"
                  placeholder="e.g., 1220"
                  value={formData.width}
                  onChange={(e) =>
                    setFormData({ ...formData, width: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Length (mm)">
                <Input
                  type="number"
                  placeholder="e.g., 2440"
                  value={formData.length}
                  onChange={(e) =>
                    setFormData({ ...formData, length: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Finish">
                <Select
                  value={formData.finish}
                  onChange={(e) =>
                    setFormData({ ...formData, finish: e.target.value })
                  }
                  options={FINISHES.map((f) => ({ value: f, label: f }))}
                  placeholder="Select finish"
                />
              </FormGroup>

              <FormGroup label="Color">
                <Select
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  options={COLORS.map((c) => ({ value: c, label: c }))}
                  placeholder="Select color"
                />
              </FormGroup>

              <FormGroup label="Pattern">
                <Input
                  placeholder="e.g., Maple"
                  value={formData.pattern}
                  onChange={(e) =>
                    setFormData({ ...formData, pattern: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Grade">
                <Select
                  value={formData.grade}
                  onChange={(e) =>
                    setFormData({ ...formData, grade: e.target.value })
                  }
                  options={PRODUCT_GRADES.map((g) => ({
                    value: g,
                    label: g,
                  }))}
                  placeholder="Select grade"
                />
              </FormGroup>

              <FormGroup label="Wear Layer (mm)">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 2.0"
                  value={formData.wearLayer}
                  onChange={(e) =>
                    setFormData({ ...formData, wearLayer: e.target.value })
                  }
                />
              </FormGroup>
            </div>
          </div>

          {/* Pricing & Availability */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Pricing & Availability
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <FormGroup label="Current Price (USD)" required error={errors.currentPrice}>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.currentPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, currentPrice: e.target.value })
                  }
                  error={!!errors.currentPrice}
                />
              </FormGroup>

              <FormGroup label="MOQ (units)" required error={errors.moq}>
                <Input
                  type="number"
                  placeholder="Minimum order quantity"
                  value={formData.moq}
                  onChange={(e) => setFormData({ ...formData, moq: e.target.value })}
                  error={!!errors.moq}
                />
              </FormGroup>

              <FormGroup label="Lead Time (days)" required error={errors.leadTime}>
                <Input
                  type="number"
                  placeholder="Days to deliver"
                  value={formData.leadTime}
                  onChange={(e) =>
                    setFormData({ ...formData, leadTime: e.target.value })
                  }
                  error={!!errors.leadTime}
                />
              </FormGroup>

              <FormGroup label="Status">
                <Select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </FormGroup>
            </div>
          </div>

          {/* Warranty */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Warranty</h2>
            <div className="flex items-center gap-4">
              <Checkbox
                label="Product includes warranty"
                checked={formData.hasWarranty}
                onChange={(e) =>
                  setFormData({ ...formData, hasWarranty: e.target.checked })
                }
              />
              {formData.hasWarranty && (
                <FormGroup label="Warranty Years" error={errors.warrantyYears}>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    value={formData.warrantyYears}
                    onChange={(e) =>
                      setFormData({ ...formData, warrantyYears: e.target.value })
                    }
                    error={!!errors.warrantyYears}
                    className="w-32"
                  />
                </FormGroup>
              )}
            </div>
          </div>

          {/* Product Images */}
          {!id && (
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Product Images</h2>
              <FileUpload
                onFilesSelected={setImages}
                accept=".jpg,.jpeg,.png,.webp"
                multiple={true}
                maxSize={5 * 1024 * 1024}
              />
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center gap-4">
            <Button type="submit" isLoading={isSaving}>
              {id ? 'Update Product' : 'Create Product'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/products')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;
