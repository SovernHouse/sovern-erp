import React, { useRef, useEffect, useState } from 'react'
import { X, Zap, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Barcode Scanner Component using native browser APIs
 * Supports: Code128, EAN-13, QR codes
 * Falls back to manual input if BarcodeDetector API unavailable
 */
const BarcodeScanner = ({ onScan, onClose, supportedFormats = ['code_128', 'ean_13', 'qr_code'] }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [useFrontCamera, setUseFrontCamera] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [barcodeDetectorAvailable, setBarcodeDetectorAvailable] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  // Check for BarcodeDetector API support
  useEffect(() => {
    const checkBarcodeDetectorSupport = async () => {
      if ('BarcodeDetector' in window) {
        try {
          // Test if BarcodeDetector is supported in this browser
          const detector = new window.BarcodeDetector({ formats: supportedFormats });
          setBarcodeDetectorAvailable(true);
        } catch (e) {
          console.warn('BarcodeDetector API not fully supported:', e);
          setBarcodeDetectorAvailable(false);
        }
      } else {
        setBarcodeDetectorAvailable(false);
      }
    };

    checkBarcodeDetectorSupport();
  }, [supportedFormats]);

  // Initialize camera
  useEffect(() => {
    if (!isCameraActive) return;

    const initCamera = async () => {
      try {
        const constraints = {
          video: {
            facingMode: useFrontCamera ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Check for torch support
          const track = stream.getVideoTracks()[0];
          if (track) {
            const capabilities = track.getCapabilities?.();
            if (capabilities?.torch) {
              setTorchSupported(true);
            }
          }
        }

        toast.success('Camera initialized');
        setIsScanning(true);
      } catch (error) {
        console.error('Camera access error:', error);
        toast.error('Unable to access camera. Check permissions.');
        setIsCameraActive(false);
      }
    };

    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraActive, useFrontCamera]);

  // Start barcode detection loop
  useEffect(() => {
    if (!isScanning || !barcodeDetectorAvailable || !videoRef.current) return;

    const detectBarcodes = async () => {
      try {
        if (!videoRef.current) return;

        const detector = new window.BarcodeDetector({ formats: supportedFormats });
        const barcodes = await detector.detect(videoRef.current);

        if (barcodes && barcodes.length > 0) {
          const barcode = barcodes[0]; // Use first detected barcode
          setIsScanning(false);
          handleBarcodeScan(barcode.rawValue);
        }
      } catch (error) {
        console.error('Barcode detection error:', error);
      }

      // Continue scanning
      if (isScanning) {
        requestAnimationFrame(detectBarcodes);
      }
    };

    if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
      const detectionLoop = requestAnimationFrame(detectBarcodes);
      return () => cancelAnimationFrame(detectionLoop);
    }
  }, [isScanning, barcodeDetectorAvailable, supportedFormats]);

  // Toggle torch/flash
  const toggleTorch = async () => {
    if (!torchSupported || !streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
        toast.success(torchOn ? 'Torch off' : 'Torch on');
      }
    } catch (error) {
      console.error('Torch toggle error:', error);
      toast.error('Unable to toggle torch');
    }
  };

  // Switch camera (front/back)
  const switchCamera = () => {
    setUseFrontCamera(!useFrontCamera);
    setTorchOn(false);
  };

  // Handle barcode scan
  const handleBarcodeScan = (barcode) => {
    if (!barcode) return;

    setManualInput('');
    if (onScan) {
      onScan({
        value: barcode,
        timestamp: new Date(),
        format: 'auto-detected',
      });
    }
    toast.success(`Scanned: ${barcode}`);
  };

  // Handle manual input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeScan(manualInput);
      setManualInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {barcodeDetectorAvailable ? 'Barcode Scanner' : 'Manual Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Camera Section (if BarcodeDetector available) */}
          {barcodeDetectorAvailable && (
            <div className="mb-6">
              {!isCameraActive ? (
                <button
                  onClick={() => setIsCameraActive(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
                >
                  Start Camera
                </button>
              ) : (
                <>
                  {/* Camera Feed */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-96 object-cover"
                      onLoadedMetadata={() => {
                        setIsScanning(true);
                      }}
                    />

                    {/* Scanning Guide Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-4 border-green-400 rounded-lg opacity-50"></div>
                    </div>

                    {/* Status Indicator */}
                    <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                      {isScanning ? '🔴 Scanning...' : '⏸️ Ready'}
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {/* Torch Button */}
                    {torchSupported && (
                      <button
                        onClick={toggleTorch}
                        className={`flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-semibold transition ${
                          torchOn
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        <Zap size={18} />
                        Torch
                      </button>
                    )}

                    {/* Camera Switch */}
                    <button
                      onClick={switchCamera}
                      className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                    >
                      <RotateCw size={18} />
                      Switch
                    </button>

                    {/* Stop Camera */}
                    <button
                      onClick={() => {
                        setIsCameraActive(false);
                        setIsScanning(false);
                      }}
                      className="py-2 px-3 rounded-lg font-semibold bg-red-500 hover:bg-red-600 text-white transition"
                    >
                      Stop
                    </button>
                  </div>

                  <div className="text-center text-sm text-gray-600 mb-4">
                    Position barcode or QR code within the frame to scan
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {barcodeDetectorAvailable ? 'Or enter manually:' : 'Enter barcode/QR code:'}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Scan or type barcode..."
                  autoFocus
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
                >
                  Submit
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported formats:</p>
              <ul className="list-disc list-inside">
                <li>Code128, EAN-13, QR Codes</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default BarcodeScanner
