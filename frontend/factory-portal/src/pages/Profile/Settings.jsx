import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { FormGroup, Input, Select, Button, Checkbox } from '../../components/FormFields';
import DataTable from '../../components/DataTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmDialog from '../../components/ConfirmDialog';
import { settingsAPI } from '../../services/api';
import toast from 'react-hot-toast';

function Settings() {
  const [notifications, setNotifications] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newMember, setNewMember] = useState({ email: '', role: 'viewer' });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, userId: null });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const [notifRes, teamRes] = await Promise.all([
        settingsAPI.getNotificationPreferences(),
        settingsAPI.getTeamMembers(),
      ]);
      setNotifications(notifRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      toast.error('Failed to load settings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationChange = (key) => {
    setNotifications({
      ...notifications,
      [key]: !notifications[key],
    });
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    try {
      await settingsAPI.updateNotificationPreferences(notifications);
      toast.success('Notification settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTeamMember = async () => {
    if (!newMember.email) {
      toast.error('Email is required');
      return;
    }

    setIsSaving(true);
    try {
      await settingsAPI.inviteTeamMember(newMember.email, newMember.role);
      toast.success('Team member invited');
      setNewMember({ email: '', role: 'viewer' });
      await loadSettings();
    } catch (error) {
      toast.error('Failed to invite team member');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveTeamMember = async () => {
    setIsSaving(true);
    try {
      await settingsAPI.removeTeamMember(deleteConfirm.userId);
      toast.success('Team member removed');
      setDeleteConfirm({ open: false, userId: null });
      await loadSettings();
    } catch (error) {
      toast.error('Failed to remove team member');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const teamColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      render: (role) => (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          status === 'active'
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) =>
        row.canRemove ? (
          <button
            onClick={() =>
              setDeleteConfirm({ open: true, userId: row.id })
            }
            className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <span className="text-xs text-gray-500">Owner</span>
        ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-600 mt-1">Manage notifications and team members</p>
      </div>

      {/* Notification Settings */}
      {notifications && (
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Notification Preferences
          </h2>

          <div className="space-y-4 mb-6">
            <Checkbox
              label="Email notifications for new purchase orders"
              checked={notifications.emailNewPO || false}
              onChange={() => handleNotificationChange('emailNewPO')}
            />
            <Checkbox
              label="Email notifications for order status changes"
              checked={notifications.emailPOStatusChange || false}
              onChange={() => handleNotificationChange('emailPOStatusChange')}
            />
            <Checkbox
              label="Email notifications for production updates"
              checked={notifications.emailProductionUpdate || false}
              onChange={() => handleNotificationChange('emailProductionUpdate')}
            />
            <Checkbox
              label="Email notifications for shipment updates"
              checked={notifications.emailShipmentUpdate || false}
              onChange={() => handleNotificationChange('emailShipmentUpdate')}
            />
            <Checkbox
              label="Email notifications for inspection schedules"
              checked={notifications.emailInspectionSchedule || false}
              onChange={() => handleNotificationChange('emailInspectionSchedule')}
            />
            <Checkbox
              label="Email notifications for price updates"
              checked={notifications.emailPriceUpdate || false}
              onChange={() => handleNotificationChange('emailPriceUpdate')}
            />
            <Checkbox
              label="Daily summary email"
              checked={notifications.dailySummary || false}
              onChange={() => handleNotificationChange('dailySummary')}
            />
            <Checkbox
              label="In-app notifications"
              checked={notifications.inAppNotifications || false}
              onChange={() => handleNotificationChange('inAppNotifications')}
            />
          </div>

          <Button onClick={handleSaveNotifications} isLoading={isSaving}>
            Save Notification Settings
          </Button>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Team Members</h2>

        {/* Add Team Member Form */}
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-4">Invite Team Member</h3>
          <div className="grid grid-cols-4 gap-4">
            <FormGroup label="Email">
              <Input
                type="email"
                placeholder="user@example.com"
                value={newMember.email}
                onChange={(e) =>
                  setNewMember({ ...newMember, email: e.target.value })
                }
              />
            </FormGroup>

            <FormGroup label="Role">
              <Select
                value={newMember.role}
                onChange={(e) =>
                  setNewMember({ ...newMember, role: e.target.value })
                }
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'editor', label: 'Editor' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
            </FormGroup>

            <FormGroup label="">
              <Button
                onClick={handleAddTeamMember}
                isLoading={isSaving}
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Invite
              </Button>
            </FormGroup>
          </div>
        </div>

        {/* Team Members Table */}
        <DataTable
          columns={teamColumns}
          data={teamMembers}
          isLoading={false}
          emptyMessage="No team members yet"
        />

        {/* Role Information */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">Role Permissions</h4>
          <div className="space-y-1 text-sm text-blue-800">
            <p>
              <span className="font-medium">Admin:</span> Full access to all features
            </p>
            <p>
              <span className="font-medium">Editor:</span> Can edit products, prices, and production
            </p>
            <p>
              <span className="font-medium">Viewer:</span> View-only access to all information
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, userId: null })}
        onConfirm={handleRemoveTeamMember}
        title="Remove Team Member"
        message="Are you sure you want to remove this team member from your factory account?"
        confirmText="Remove"
        isDangerous={true}
      />
    </div>
  );
}

export default Settings;
