import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Image } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { Button } from '../../components/FormFields';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { productsAPI } from '../../services/api';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import toast from 'react-hot-toast';

function ProductList() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, productId: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProducts();
  }, [searchTerm, filterStatus]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await productsAPI.list({
        search: searchTerm,
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
      setProducts(response.data);
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (productId) => {
    setDeleteConfirm({ open: true, productId });
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await productsAPI.delete(deleteConfirm.productId);
      toast.success('Product deleted successfully');
      setDeleteConfirm({ open: false, productId: null });
      await loadProducts();
    } catch (error) {
      toast.error('Failed to delete product');
      console.error(error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'productCode',
      label: 'Product Code',
      sortable: true,
      render: (code, row) => (
        <div className="flex items-center gap-2">
          {row.imageUrl ? (
            <img
              src={row.imageUrl}
              alt={code}
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
              <Image size={18} className="text-gray-400" />
            </div>
          )}
          <span className="font-medium text-gray-800">{code}</span>
        </div>
      ),
    },
    { key: 'productName', label: 'Product Name', sortable: true },
    { key: 'material', label: 'Material', sortable: true },
    { key: 'currentPrice', label: 'Price', render: (price) => formatCurrency(price) },
    {
      key: 'stockQuantity',
      label: 'Stock',
      render: (quantity) => formatNumber(quantity),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'moq',
      label: 'MOQ',
      render: (moq) => formatNumber(moq),
    },
    {
      key: 'leadTime',
      label: 'Lead Time',
      render: (leadTime) => `${leadTime} days`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/products/${row.id}/edit`)}
            className="p-2 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors"
            title="Edit"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => handleDeleteClick(row.id)}
            className="p-2 hover:bg-gray-100 rounded-lg text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <p className="text-gray-600 mt-1">Manage your supplied products</p>
        </div>
        <Button onClick={() => navigate('/products/new')} className="flex items-center gap-2">
          <Plus size={20} />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
        <input
          type="text"
          placeholder="Search products by name or code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          emptyMessage="No products found"
          onRowClick={(row) => navigate(`/products/${row.id}/edit`)}
        />
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, productId: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        isDangerous={true}
        isLoading={deleteLoading}
      />
    </div>
  );
}

export default ProductList;
