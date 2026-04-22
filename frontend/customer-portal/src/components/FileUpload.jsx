import React, { useRef, useState } from 'react'
import { Upload, X, FileIcon } from 'lucide-react'

export default function FileUpload({
  onFilesSelected,
  maxSize = 10,
  maxFiles = 5,
  acceptedTypes = '.jpg,.jpeg,.png,.pdf,.doc,.docx',
  multiple = true,
}) {
  const [files, setFiles] = useState([])
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFileSelect = (selectedFiles) => {
    setError(null)
    const fileArray = Array.from(selectedFiles)

    // Validate file count
    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Validate file size
    const invalidFiles = fileArray.filter((file) => file.size > maxSize * 1024 * 1024)
    if (invalidFiles.length > 0) {
      setError(`Files must be smaller than ${maxSize}MB`)
      return
    }

    const newFiles = fileArray.map((file) => ({
      id: Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }))

    const updated = [...files, ...newFiles]
    setFiles(updated)
    onFilesSelected?.(updated.map((f) => f.file))
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleFileSelect(e.dataTransfer.files)
  }

  const removeFile = (id) => {
    const updated = files.filter((f) => f.id !== id)
    setFiles(updated)
    onFilesSelected?.(updated.map((f) => f.file))
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes, k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-900">
          Drag and drop files here or click to select
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Maximum {maxFiles} files, up to {maxSize}MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <FileIcon size={20} className="text-gray-400" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
