import React, { useState, useRef, useEffect } from 'react'
import { Download, ShoppingCart, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import toast from 'react-hot-toast'

const RoomVisualizer = () => {
  const canvasRef = useRef(null)
  const [roomShape, setRoomShape] = useState('rectangle')
  const [roomDimensions, setRoomDimensions] = useState({ length: 5, width: 4 })
  const [selectedTile, setSelectedTile] = useState(null)
  const [tileSize, setTileSize] = useState('60x60')
  const [pattern, setPattern] = useState('straight')
  const [groutColor, setGroutColor] = useState('#E0E0E0')
  const [groutWidth, setGroutWidth] = useState(2)
  const [zoom, setZoom] = useState(1)
  const [tileColor, setTileColor] = useState('#D4A574')

  // Sample products from catalog
  const tileProducts = [
    { id: 1, name: 'Beige Marble', color: '#D4A574', price: 450 },
    { id: 2, name: 'Dark Gray', color: '#4A4A4A', price: 380 },
    { id: 3, name: 'White Pearl', color: '#F5F5F0', price: 520 },
    { id: 4, name: 'Black Slate', color: '#2C2C2C', price: 600 },
    { id: 5, name: 'Cream Marble', color: '#F4E8D8', price: 480 },
    { id: 6, name: 'Natural Stone', color: '#8B7355', price: 390 },
  ]

  const tileSizes = [
    { label: '30x30 cm', value: '30x30' },
    { label: '45x45 cm', value: '45x45' },
    { label: '60x60 cm', value: '60x60' },
    { label: '60x120 cm', value: '60x120' },
    { label: '80x80 cm', value: '80x80' },
    { label: '120x120 cm', value: '120x120' },
  ]

  const patterns = [
    { label: 'Straight', value: 'straight' },
    { label: 'Brick/Offset', value: 'brick' },
    { label: 'Diagonal', value: 'diagonal' },
    { label: 'Herringbone', value: 'herringbone' },
    { label: 'Checkerboard', value: 'checkerboard' },
  ]

  const groutOptions = [
    { label: 'Thin (1mm)', value: 1 },
    { label: 'Medium (2mm)', value: 2 },
    { label: 'Thick (3mm)', value: 3 },
  ]

  // Calculate tile dimensions in cm
  const getTileDimensionsCm = () => {
    const [w, h] = tileSize.split('x').map(Number)
    return { width: w, height: h }
  }

  // Calculate total area and tile count
  const calculateMetrics = () => {
    const { length, width } = roomDimensions
    const totalArea = length * width
    const tileDims = getTileDimensionsCm()
    const tileSqm = (tileDims.width / 100) * (tileDims.height / 100)
    const tilesNeeded = Math.ceil((totalArea / tileSqm) * 1.1) // 10% waste factor
    const product = tileProducts.find((p) => p.id === selectedTile) || tileProducts[0]
    const estimatedCost = tilesNeeded * (product.price / 10) // Price per sqm

    return { totalArea, tilesNeeded, estimatedCost: estimatedCost.toFixed(2) }
  }

  // Draw room and tiles on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const padding = 40
    const canvasWidth = canvas.width - 2 * padding
    const canvasHeight = canvas.height - 2 * padding

    // Calculate scale to fit room
    const scaleX = canvasWidth / (roomDimensions.length * zoom)
    const scaleY = canvasHeight / (roomDimensions.width * zoom)
    const scale = Math.min(scaleX, scaleY)

    const roomWidth = roomDimensions.length * scale
    const roomHeight = roomDimensions.width * scale
    const startX = (canvas.width - roomWidth) / 2
    const startY = (canvas.height - roomHeight) / 2

    // Clear canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw grid background
    ctx.strokeStyle = '#E0E0E0'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= canvasWidth; i += 20 * zoom) {
      ctx.beginPath()
      ctx.moveTo(i + padding, padding)
      ctx.lineTo(i + padding, padding + canvasHeight)
      ctx.stroke()
    }
    for (let i = 0; i <= canvasHeight; i += 20 * zoom) {
      ctx.beginPath()
      ctx.moveTo(padding, i + padding)
      ctx.lineTo(padding + canvasWidth, i + padding)
      ctx.stroke()
    }

    // Draw room outline
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 3
    ctx.fillStyle = tileColor

    if (roomShape === 'rectangle') {
      ctx.fillRect(startX, startY, roomWidth, roomHeight)
      ctx.strokeRect(startX, startY, roomWidth, roomHeight)
    } else if (roomShape === 'l-shape') {
      const mainW = roomWidth * 0.7
      const mainH = roomHeight
      const armW = roomWidth * 0.3
      const armH = roomHeight * 0.6

      ctx.fillRect(startX, startY, mainW, mainH)
      ctx.fillRect(startX + mainW, startY, armW, armH)
      ctx.strokeRect(startX, startY, mainW, mainH)
      ctx.strokeRect(startX + mainW, startY, armW, armH)
    } else if (roomShape === 'u-shape') {
      const sideW = roomWidth * 0.2
      const centerW = roomWidth * 0.6
      const centerH = roomHeight * 0.7

      ctx.fillRect(startX, startY, sideW, roomHeight)
      ctx.fillRect(startX + sideW, startY, centerW, centerH)
      ctx.fillRect(startX + sideW + centerW, startY, sideW, roomHeight)
      ctx.strokeRect(startX, startY, sideW, roomHeight)
      ctx.strokeRect(startX + sideW, startY, centerW, centerH)
      ctx.strokeRect(startX + sideW + centerW, startY, sideW, roomHeight)
    }

    // Draw tiles
    drawTiles(ctx, startX, startY, roomWidth, roomHeight, scale)

    // Draw dimensions
    ctx.fillStyle = '#333333'
    ctx.font = '12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`${roomDimensions.length}m`, startX + roomWidth / 2, startY - 10)
    ctx.textAlign = 'right'
    ctx.save()
    ctx.translate(startX - 15, startY + roomHeight / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText(`${roomDimensions.width}m`, 0, 0)
    ctx.restore()
  }, [roomShape, roomDimensions, tileColor, zoom, pattern, groutColor, groutWidth, tileSize])

  // Draw tiles pattern
  const drawTiles = (ctx, startX, startY, roomWidth, roomHeight, scale) => {
    const tileDims = getTileDimensionsCm()
    const tileWidthPx = (tileDims.width / 100) * scale
    const tileHeightPx = (tileDims.height / 100) * scale
    const groutPx = groutWidth

    ctx.strokeStyle = groutColor
    ctx.lineWidth = groutPx
    ctx.fillStyle = tileColor

    let tileX = startX
    let tileY = startY
    let offsetX = 0

    if (pattern === 'straight') {
      while (tileY < startY + roomHeight) {
        tileX = startX
        while (tileX < startX + roomWidth) {
          ctx.fillRect(tileX, tileY, tileWidthPx, tileHeightPx)
          ctx.strokeRect(tileX, tileY, tileWidthPx, tileHeightPx)
          tileX += tileWidthPx + groutPx
        }
        tileY += tileHeightPx + groutPx
      }
    } else if (pattern === 'brick') {
      let row = 0
      while (tileY < startY + roomHeight) {
        tileX = startX + (row % 2 === 1 ? (tileWidthPx + groutPx) / 2 : 0)
        while (tileX < startX + roomWidth) {
          ctx.fillRect(tileX, tileY, tileWidthPx, tileHeightPx)
          ctx.strokeRect(tileX, tileY, tileWidthPx, tileHeightPx)
          tileX += tileWidthPx + groutPx
        }
        tileY += tileHeightPx + groutPx
        row++
      }
    } else if (pattern === 'diagonal') {
      // Simplified diagonal - rotated straight pattern
      ctx.save()
      ctx.translate(startX + roomWidth / 2, startY + roomHeight / 2)
      ctx.rotate((Math.PI / 180) * 45)
      tileX = -roomWidth
      tileY = -roomHeight
      while (tileY < roomHeight) {
        tileX = -roomWidth
        while (tileX < roomWidth) {
          ctx.fillRect(tileX, tileY, tileWidthPx, tileHeightPx)
          ctx.strokeRect(tileX, tileY, tileWidthPx, tileHeightPx)
          tileX += tileWidthPx + groutPx
        }
        tileY += tileHeightPx + groutPx
      }
      ctx.restore()
    } else if (pattern === 'herringbone') {
      // Simplified herringbone - alternating direction
      let row = 0
      tileY = startY
      while (tileY < startY + roomHeight) {
        tileX = startX
        const isHorizontal = row % 2 === 0
        if (isHorizontal) {
          while (tileX < startX + roomWidth) {
            ctx.fillRect(tileX, tileY, tileWidthPx, tileHeightPx)
            ctx.strokeRect(tileX, tileY, tileWidthPx, tileHeightPx)
            tileX += tileWidthPx + groutPx
          }
        } else {
          while (tileY < startY + roomHeight && tileX < startX + roomWidth) {
            ctx.fillRect(tileX, tileY, tileHeightPx, tileWidthPx)
            ctx.strokeRect(tileX, tileY, tileHeightPx, tileWidthPx)
            tileX += tileHeightPx + groutPx
            tileY += tileWidthPx + groutPx
          }
          tileY = startY + (row * (tileHeightPx + groutPx))
        }
        tileY += tileHeightPx + groutPx
        row++
      }
    } else if (pattern === 'checkerboard') {
      let row = 0
      tileY = startY
      const colors = [tileColor, '#E8DCC8']
      while (tileY < startY + roomHeight) {
        tileX = startX
        let col = 0
        while (tileX < startX + roomWidth) {
          ctx.fillStyle = colors[(row + col) % 2]
          ctx.fillRect(tileX, tileY, tileWidthPx, tileHeightPx)
          ctx.strokeStyle = groutColor
          ctx.strokeRect(tileX, tileY, tileWidthPx, tileHeightPx)
          tileX += tileWidthPx + groutPx
          col++
        }
        tileY += tileHeightPx + groutPx
        row++
      }
    }
  }

  const handleSaveLayout = () => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `room-layout-${Date.now()}.png`
    link.click()
    toast.success('Layout saved as PNG')
  }

  const handleGetQuote = () => {
    const metrics = calculateMetrics()
    const product = tileProducts.find((p) => p.id === selectedTile) || tileProducts[0]

    // Navigate to quotation request with pre-filled data
    const quoteData = {
      product: product.name,
      quantity: metrics.tilesNeeded,
      area: metrics.totalArea,
      tileSize,
      pattern,
      estimatedCost: metrics.estimatedCost,
    }
    localStorage.setItem('prefilledQuote', JSON.stringify(quoteData))
    window.location.href = '/quotations/request'
  }

  const handleReset = () => {
    setRoomDimensions({ length: 5, width: 4 })
    setTileSize('60x60')
    setPattern('straight')
    setGroutColor('#E0E0E0')
    setGroutWidth(2)
    setZoom(1)
    setTileColor('#D4A574')
    setSelectedTile(null)
  }

  const metrics = calculateMetrics()
  const selectedProduct = tileProducts.find((p) => p.id === selectedTile) || tileProducts[0]

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">3D Room Visualizer</h1>
        <p className="text-gray-600 mb-6">Preview tiles in your room and get an instant quote</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Panel */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-6 h-fit max-h-screen overflow-y-auto">
            {/* Room Shape */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Room Shape</label>
              <select
                value={roomShape}
                onChange={(e) => setRoomShape(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="rectangle">Rectangle</option>
                <option value="l-shape">L-Shape</option>
                <option value="u-shape">U-Shape</option>
              </select>
            </div>

            {/* Room Dimensions */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Room Dimensions (meters)</label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-gray-600">Length</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={roomDimensions.length}
                    onChange={(e) =>
                      setRoomDimensions({ ...roomDimensions, length: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Width</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    step="0.5"
                    value={roomDimensions.width}
                    onChange={(e) =>
                      setRoomDimensions({ ...roomDimensions, width: parseFloat(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tile Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Select Tile</label>
              <div className="grid grid-cols-2 gap-2">
                {tileProducts.map((tile) => (
                  <button
                    key={tile.id}
                    onClick={() => {
                      setSelectedTile(tile.id)
                      setTileColor(tile.color)
                    }}
                    className={`p-3 rounded-lg border-2 transition ${
                      selectedTile === tile.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div
                      className="h-8 rounded mb-1"
                      style={{ backgroundColor: tile.color }}
                    ></div>
                    <div className="text-xs font-semibold truncate">{tile.name}</div>
                    <div className="text-xs text-gray-500">${tile.price}/sqm</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tile Size */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tile Size</label>
              <select
                value={tileSize}
                onChange={(e) => setTileSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {tileSizes.map((size) => (
                  <option key={size.value} value={size.value}>
                    {size.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pattern */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Layout Pattern</label>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {patterns.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Grout Color */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Grout Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={groutColor}
                  onChange={(e) => setGroutColor(e.target.value)}
                  className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <select
                    value={groutColor}
                    onChange={(e) => setGroutColor(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="#FFFFFF">White</option>
                    <option value="#E0E0E0">Light Gray</option>
                    <option value="#808080">Gray</option>
                    <option value="#2C2C2C">Black</option>
                    <option value="#D4A574">Beige</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Grout Width */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Grout Width</label>
              <select
                value={groutWidth}
                onChange={(e) => setGroutWidth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {groutOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Zoom</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-3 rounded flex items-center justify-center gap-1"
                >
                  <ZoomOut size={16} /> Zoom Out
                </button>
                <button
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-3 rounded flex items-center justify-center gap-1"
                >
                  <ZoomIn size={16} /> Zoom In
                </button>
              </div>
              <div className="text-center text-sm text-gray-600 mt-2">{(zoom * 100).toFixed(0)}%</div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded flex items-center justify-center gap-1"
              >
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </div>

          {/* Canvas and Results */}
          <div className="lg:col-span-2">
            {/* Canvas */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full border border-gray-300 rounded-lg bg-white"
              />
            </div>

            {/* Metrics and Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Metrics Card */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculation Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Area:</span>
                    <span className="font-semibold">{metrics.totalArea} sqm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tiles Needed (10% waste):</span>
                    <span className="font-semibold">{metrics.tilesNeeded}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tile Size:</span>
                    <span className="font-semibold">{tileSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pattern:</span>
                    <span className="font-semibold">{pattern}</span>
                  </div>
                  <div className="flex justify-between text-blue-600 border-t pt-3">
                    <span className="font-semibold">Estimated Cost:</span>
                    <span className="font-bold text-lg">${metrics.estimatedCost}</span>
                  </div>
                </div>
              </div>

              {/* Product Details Card */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Product</h3>
                <div className="mb-4">
                  <div
                    className="h-24 rounded-lg border-4 border-gray-300"
                    style={{ backgroundColor: selectedProduct.color }}
                  ></div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-600">Product:</span>
                    <span className="block font-semibold text-lg">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Price per sqm:</span>
                    <span className="font-semibold">${selectedProduct.price}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <button
                onClick={handleSaveLayout}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <Download size={20} /> Save Layout as PNG
              </button>
              <button
                onClick={handleGetQuote}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition"
              >
                <ShoppingCart size={20} /> Get Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoomVisualizer
