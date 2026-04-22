import React, { useRef, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

function FileUpload({
  onFilesSelected,
  accept = '*',
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB
  isLoading = false,
}) {
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (file.size > maxSize) {
      return `File ${file.name} is too large. Maximum size is ${maxSize / 1024 / 1024}MB`;
    }
    return null;
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = multiple ? selectedFiles : [selectedFiles[0]];
    const validationErrors = [];

    newFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    setErrors([]);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const newFiles = multiple ? droppedFiles : [droppedFiles[0]];

    const validationErrors = [];
    newFiles.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      validationErrors.forEach((error) => toast.error(error));
      return;
    }

    setErrors([]);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesSelected(newFiles);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-factory-500 transition-colors cursor-pointer"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex flex-col items-center gap-3 w-full disabled:opacity-50"
        >
          <Upload size={32} className="text-factory-600" />
          <div>
            <p className="font-medium text-gray-800">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500">
              {accept === '*'
                ? 'Any file type'
                : `Accepts ${accept}`}{' '}
              - Max {maxSize / 1024 / 1024}MB
            </p>
          </div>
        </button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
            >
              <div className="flex items-center gap-3 flex-1">
                <CheckCircle size={20} className="text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-4 space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
