import { useState, useEffect } from 'react'
import { Save, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { personalizationAPI } from '../../services/api'
import LoadingSpinner from '../../components/LoadingSpinner'

const NOTIFICATION_CATEGORIES = [
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'shipments', label: 'Shipments' },
  { id: 'claims', label: 'Claims' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'reports', label: 'Reports' }
]

const CHANNELS = [
  { id: 'email', label: 'Email' },
  { id: 'inApp', label: 'In-App' },
  { id: 'sms', label: 'SMS' }
]

const DIGEST_FREQUENCIES = [
  { value: 'real-time', label: 'Real-time' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
]

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      setIsLoading(true)
      const response = await personalizationAPI.getNotificationPreferences(user.id)
      setPreferences(response.data)
    } catch (error) {
      console.error('Failed to load preferences:', error)
      toast.error('Failed to load notification preferences')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleNotification = (channel, category) => {
    setPreferences(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [channel]: {
          ...prev.preferences[channel],
          [category]: !prev.preferences[channel][category]
        }
      }
    }))
  }

  const handleChangeDigestFrequency = (frequency) => {
    setPreferences(prev => ({
      ...prev,
      digestFrequency: frequency
    }))
  }

  const handleChangeDigestTime = (time) => {
    setPreferences(prev => ({
      ...prev,
      digestTime: time
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await personalizationAPI.updateNotificationPreferences(user.id, {
        preferences: preferences.preferences,
        digestFrequency: preferences.digestFrequency,
        digestTime: preferences.digestTime
      })
      toast.success('Notification preferences saved successfully')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Failed to save notification preferences')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <LoadingSpinner message="Loading preferences..." />
  if (!preferences) return <div>No preferences found</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Notification Preferences</h1>
        <p className="text-slate-600 mt-1">Manage how and when you receive notifications</p>
      </div>

      {/* Notification Channels Matrix */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Channels</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Category</th>
                  {CHANNELS.map(channel => (
                    <th key={channel.id} className="px-4 py-3 text-center font-semibold text-slate-900">
                      {channel.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_CATEGORIES.map(category => (
                  <tr key={category.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{category.label}</td>
                    {CHANNELS.map(channel => (
                      <td key={`${category.id}-${channel.id}`} className="px-4 py-4 text-center">
                        <label className="flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences.preferences[channel.id]?.[category.id] ?? true}
                            onChange={() => handleToggleNotification(channel.id, category.id)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Digest Settings */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Digest Settings</span>
          </h2>

          <div className="space-y-4">
            {/* Digest Frequency */}
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Digest Frequency
              </label>
              <div className="flex gap-2">
                {DIGEST_FREQUENCIES.map(freq => (
                  <button
                    key={freq.value}
                    onClick={() => handleChangeDigestFrequency(freq.value)}
                    className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                      preferences.digestFrequency === freq.value
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {preferences.digestFrequency === 'real-time'
                  ? 'Receive notifications immediately as events occur'
                  : preferences.digestFrequency === 'hourly'
                  ? 'Receive notifications summary every hour'
                  : preferences.digestFrequency === 'daily'
                  ? 'Receive notifications summary once per day'
                  : 'Receive notifications summary once per week'}
              </p>
            </div>

            {/* Digest Time */}
            {preferences.digestFrequency !== 'real-time' && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Preferred Delivery Time
                </label>
                <input
                  type="time"
                  value={preferences.digestTime || '09:00'}
                  onChange={(e) => handleChangeDigestTime(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-slate-600 mt-2">
                  Digests will be sent at this time in your local timezone
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> These preferences apply to your account only. You can update them anytime.
          Email notifications are subject to email verification.
        </p>
      </div>
    </div>
  )
}
