import { useState, useEffect } from 'react'
import { Save, Copy, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { personalizationAPI } from '../services/api'

/**
 * FilterPresets - Component for managing and loading filter presets
 * Integrates with list pages to save/load filter combinations
 */
export default function FilterPresets({ entityType, onLoadPreset, currentFilters }) {
  const [presets, setPresets] = useState([])
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadPresets()
  }, [entityType])

  const loadPresets = async () => {
    try {
      setIsLoading(true)
      const response = await personalizationAPI.getFilterPresets({ entityType })
      setPresets(response.data || [])
    } catch (error) {
      console.error('Failed to load presets:', error)
      toast.error('Failed to load presets')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name')
      return
    }

    try {
      setIsSaving(true)
      await personalizationAPI.createFilterPreset({
        entityType,
        name: presetName,
        filters: currentFilters,
        isPublic
      })
      toast.success('Preset saved successfully')
      setPresetName('')
      setIsPublic(false)
      setShowSaveForm(false)
      loadPresets()
    } catch (error) {
      console.error('Failed to save preset:', error)
      toast.error('Failed to save preset')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeletePreset = async (id) => {
    if (!window.confirm('Are you sure you want to delete this preset?')) return

    try {
      await personalizationAPI.deleteFilterPreset(id)
      toast.success('Preset deleted successfully')
      loadPresets()
    } catch (error) {
      console.error('Failed to delete preset:', error)
      toast.error('Failed to delete preset')
    }
  }

  const handleCopyShareLink = (shareToken) => {
    const url = `${window.location.origin}?preset=${shareToken}`
    navigator.clipboard.writeText(url)
    toast.success('Share link copied to clipboard')
  }

  if (isLoading) return <div className="text-sm text-slate-600">Loading presets...</div>

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-slate-700">Filter Presets</label>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Save</span>
        </button>
      </div>

      {/* Save Form */}
      {showSaveForm && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 mb-3">
          <input
            type="text"
            placeholder="Preset name..."
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded"
            />
            <span>Make public (shareable)</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSavePreset}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
            <button
              onClick={() => setShowSaveForm(false)}
              className="flex-1 px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Presets List */}
      {presets.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {presets.map(preset => (
            <div key={preset.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-sm hover:bg-slate-100 transition-colors">
              <button
                onClick={() => onLoadPreset(preset.filters)}
                className="flex-1 text-left text-blue-600 hover:text-blue-700 font-medium"
              >
                {preset.name}
              </button>
              {preset.isPublic && (
                <button
                  onClick={() => handleCopyShareLink(preset.shareToken)}
                  className="p-1 hover:bg-blue-100 rounded transition-colors"
                  title="Copy share link"
                >
                  <Copy className="w-3 h-3 text-blue-600" />
                </button>
              )}
              <button
                onClick={() => handleDeletePreset(preset.id)}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Delete preset"
              >
                <Trash2 className="w-3 h-3 text-red-600" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 py-2">No presets saved yet</p>
      )}
    </div>
  )
}
