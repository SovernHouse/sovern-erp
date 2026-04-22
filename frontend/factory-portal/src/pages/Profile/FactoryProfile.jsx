import React, { useState, useEffect } from 'react';
import { Save, Upload, Trash2, Plus } from 'lucide-react';
import { FormGroup, Input, Textarea, Button } from '../../components/FormFields';
import FileUpload from '../../components/FileUpload';
import LoadingSpinner from '../../components/LoadingSpinner';
import { factoryAPI } from '../../services/api';
import toast from 'react-hot-toast';

function FactoryProfile() {
  const [profile, setProfile] = useState(null);
  const [certifications, setCertifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const [profileRes, certRes] = await Promise.all([
        factoryAPI.getProfile(),
        factoryAPI.getCertifications(),
      ]);
      setProfile(profileRes.data);
      setCertifications(certRes.data);
      setFormData(profileRes.data);
    } catch (error) {
      toast.error('Failed to load profile');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await factoryAPI.updateProfile(formData);
      toast.success('Profile updated successfully');
      setIsEditing(false);
      await loadProfile();
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadCertification = async (files) => {
    if (!files || files.length === 0) {
      toast.error('Please select a file');
      return;
    }

    setIsSaving(true);
    try {
      const formDataWithFile = new FormData();
      formDataWithFile.append('certificate', files[0]);

      await factoryAPI.uploadCertification(formDataWithFile);
      toast.success('Certification uploaded successfully');
      await loadProfile();
    } catch (error) {
      toast.error('Failed to upload certification');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCertification = async (certId) => {
    setIsSaving(true);
    try {
      await factoryAPI.deleteCertification(certId);
      toast.success('Certification deleted');
      await loadProfile();
    } catch (error) {
      toast.error('Failed to delete certification');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Factory Profile</h1>
          <p className="text-gray-600 mt-1">
            Manage company information and certifications
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
        )}
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Company Information</h2>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="Factory Name" required>
                <Input
                  value={formData.name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Registration Number" required>
                <Input
                  value={formData.registrationNumber || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      registrationNumber: e.target.value,
                    })
                  }
                />
              </FormGroup>

              <FormGroup label="Country">
                <Input
                  value={formData.country || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="City">
                <Input
                  value={formData.city || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Contact Email" required>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </FormGroup>

              <FormGroup label="Contact Phone" required>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </FormGroup>
            </div>

            <FormGroup label="Address">
              <Textarea
                value={formData.address || ''}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                rows={3}
              />
            </FormGroup>

            <FormGroup label="Company Description">
              <Textarea
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                placeholder="Describe your factory, capabilities, specializations..."
              />
            </FormGroup>

            <FormGroup label="Specializations">
              <Textarea
                value={formData.specializations || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    specializations: e.target.value,
                  })
                }
                rows={3}
                placeholder="e.g., Premium flooring, custom sizes, quick turnaround..."
              />
            </FormGroup>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <Button type="submit" isLoading={isSaving}>
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(profile);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Factory Name</p>
                <p className="text-lg font-semibold text-gray-800">
                  {profile.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Registration Number</p>
                <p className="text-lg font-semibold text-gray-800">
                  {profile.registrationNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Location</p>
                <p className="text-lg font-semibold text-gray-800">
                  {profile.city}, {profile.country}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact</p>
                <p className="text-lg font-semibold text-gray-800">
                  {profile.phone}
                </p>
              </div>
            </div>

            {profile.description && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">About Us</p>
                <p className="text-gray-700">{profile.description}</p>
              </div>
            )}

            {profile.specializations && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Specializations</p>
                <p className="text-gray-700">{profile.specializations}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Certifications
          </h2>
          <Button
            size="sm"
            className="flex items-center gap-2"
            onClick={() =>
              document
                .getElementById('cert-upload')
                ?.querySelector('button')
                ?.click()
            }
          >
            <Plus size={18} />
            Add Certification
          </Button>
        </div>

        {/* Upload Section */}
        <div className="mb-6 p-6 bg-gray-50 rounded-lg" id="cert-upload">
          <FileUpload
            onFilesSelected={handleUploadCertification}
            accept=".pdf,.jpg,.jpeg,.png"
            maxSize={10 * 1024 * 1024}
            isLoading={isSaving}
          />
        </div>

        {/* Certifications List */}
        {certifications.length > 0 ? (
          <div className="space-y-3">
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{cert.name}</p>
                  <p className="text-sm text-gray-600">
                    Issued: {cert.issuedDate} | Expires: {cert.expiryDate || 'N/A'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <a
                    href={cert.fileUrl}
                    download={cert.fileName}
                    className="p-2 hover:bg-gray-200 rounded-lg text-blue-600 transition-colors"
                  >
                    <Upload size={18} />
                  </a>
                  <button
                    onClick={() => handleDeleteCertification(cert.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg text-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">
            No certifications uploaded yet
          </p>
        )}
      </div>
    </div>
  );
}

export default FactoryProfile;
