import React, { useState, useEffect, useRef, useCallback } from 'react';

// Main App Component - Digital Whiteboard MVP
const App = () => {
  // State Management
  const [notebooks, setNotebooks] = useState({});
  const [currentNotebook, setCurrentNotebook] = useState(null);
  const [currentSheet, setCurrentSheet] = useState(null);
  const [activeTool, setActiveTool] = useState('pen');
  const [penSettings, setPenSettings] = useState({ color: '#000000', width: 4 });
  const [eraserSize, setEraserSize] = useState(8);
  
  // Canvas and drawing state
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingHistory, setDrawingHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showEraserCursor, setShowEraserCursor] = useState(false);

  // Initialize app with default notebook
  useEffect(() => {
    const savedData = localStorage.getItem('whiteboard-data');
    if (savedData) {
      const data = JSON.parse(savedData);
      setNotebooks(data.notebooks || {});
      setCurrentNotebook(data.currentNotebook);
      setCurrentSheet(data.currentSheet);
    } else {
      // Create default notebook and sheet
      const defaultNotebookId = 'notebook-1';
      const defaultSheetId = 'sheet-1';
      const defaultNotebook = {
        id: defaultNotebookId,
        name: 'My Notebook',
        sheets: {
          [defaultSheetId]: {
            id: defaultSheetId,
            name: 'Sheet 1',
            canvasData: null
          }
        }
      };
      
      setNotebooks({ [defaultNotebookId]: defaultNotebook });
      setCurrentNotebook(defaultNotebookId);
      setCurrentSheet(defaultSheetId);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (currentNotebook && currentSheet) {
      const data = {
        notebooks,
        currentNotebook,
        currentSheet
      };
      localStorage.setItem('whiteboard-data', JSON.stringify(data));
    }
  }, [notebooks, currentNotebook, currentSheet]);

  // Draw notebook lines
  const drawNotebookLines = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');
    const lineSpacing = 20; // Space between lines
    const margin = 40; // Left margin
    
    // Save current state
    ctx.save();
    
    // Set line style
    ctx.strokeStyle = '#e5e7eb'; // Light gray color
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw horizontal lines
    for (let y = lineSpacing; y < canvas.height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(margin, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw vertical margin line
    ctx.strokeStyle = '#d1d5db'; // Slightly darker for margin
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, 0);
    ctx.lineTo(margin, canvas.height);
    ctx.stroke();
    
    // Restore state
    ctx.restore();
  }, []);

  // Drawing functions
  const getPointFromEvent = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Calculate coordinates relative to canvas without scaling
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getPointFromEvent(e);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (activeTool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.strokeStyle = penSettings.color;
      ctx.lineWidth = penSettings.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineWidth = eraserSize;
      ctx.lineCap = 'round';
    }
  }, [activeTool, penSettings, eraserSize, getPointFromEvent]);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    
    e.preventDefault();
    const point = getPointFromEvent(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (activeTool === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    } else if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      
      // Redraw notebook lines after erasing
      setTimeout(() => {
        drawNotebookLines(canvas);
      }, 0);
    }
  }, [isDrawing, activeTool, getPointFromEvent, drawNotebookLines]);

  const stopDrawing = useCallback((e) => {
    if (!isDrawing) return;
    
    e.preventDefault();
    setIsDrawing(false);
    
    // Save current canvas state to history
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL();
    const newHistory = drawingHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setDrawingHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // Save to current sheet
    if (currentNotebook && currentSheet) {
      setNotebooks(prev => ({
        ...prev,
        [currentNotebook]: {
          ...prev[currentNotebook],
          sheets: {
            ...prev[currentNotebook].sheets,
            [currentSheet]: {
              ...prev[currentNotebook].sheets[currentSheet],
              canvasData: imageData
            }
          }
        }
      }));
    }
  }, [isDrawing, currentNotebook, currentSheet, drawingHistory, historyIndex]);

  // Load canvas data when switching sheets
  useEffect(() => {
    if (currentNotebook && currentSheet && notebooks[currentNotebook]) {
      const sheet = notebooks[currentNotebook].sheets[currentSheet];
      if (sheet && sheet.canvasData) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw notebook lines first
          drawNotebookLines(canvas);
          // Then draw the saved content
          ctx.drawImage(img, 0, 0);
        };
        img.src = sheet.canvasData;
      } else {
        // Clear canvas and draw notebook lines if no data
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawNotebookLines(canvas);
      }
    }
  }, [currentNotebook, currentSheet, notebooks, drawNotebookLines]);

  // Tool functions
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw notebook lines
    drawNotebookLines(canvas);
    
    // Save cleared state
    const imageData = canvas.toDataURL();
    const newHistory = drawingHistory.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setDrawingHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    if (currentNotebook && currentSheet) {
      setNotebooks(prev => ({
        ...prev,
        [currentNotebook]: {
          ...prev[currentNotebook],
          sheets: {
            ...prev[currentNotebook].sheets,
            [currentSheet]: {
              ...prev[currentNotebook].sheets[currentSheet],
              canvasData: imageData
            }
          }
        }
      }));
    }
  };

  // Notebook and Sheet management
  const createNewNotebook = () => {
    const id = `notebook-${Date.now()}`;
    const newNotebook = {
      id,
      name: `Notebook ${Object.keys(notebooks).length + 1}`,
      sheets: {
        [`sheet-${Date.now()}`]: {
          id: `sheet-${Date.now()}`,
          name: 'Sheet 1',
          canvasData: null
        }
      }
    };
    
    setNotebooks(prev => ({ ...prev, [id]: newNotebook }));
    setCurrentNotebook(id);
    setCurrentSheet(Object.keys(newNotebook.sheets)[0]);
  };

  const createNewSheet = () => {
    if (!currentNotebook) return;
    
    const sheetId = `sheet-${Date.now()}`;
    const sheetNumber = Object.keys(notebooks[currentNotebook].sheets).length + 1;
    
    setNotebooks(prev => ({
      ...prev,
      [currentNotebook]: {
        ...prev[currentNotebook],
        sheets: {
          ...prev[currentNotebook].sheets,
          [sheetId]: {
            id: sheetId,
            name: `Sheet ${sheetNumber}`,
            canvasData: null
          }
        }
      }
    }));
    setCurrentSheet(sheetId);
  };

  const switchToSheet = (sheetId) => {
    setCurrentSheet(sheetId);
  };

  const switchToNotebook = (notebookId) => {
    setCurrentNotebook(notebookId);
    const firstSheet = Object.keys(notebooks[notebookId].sheets)[0];
    setCurrentSheet(firstSheet);
  };

  // Mouse tracking for eraser cursor
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      setMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (activeTool === 'eraser') {
      setShowEraserCursor(true);
    }
  }, [activeTool]);

  const handleMouseLeave = useCallback(() => {
    setShowEraserCursor(false);
  }, []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Set canvas size to match display size
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Draw notebook lines after resize
        drawNotebookLines(canvas);
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, [drawNotebookLines]);

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">Digital Whiteboard</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Notebooks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-700">Notebooks</h2>
                <button
                  onClick={createNewNotebook}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + New
                </button>
              </div>
              
              <div className="space-y-1">
                {Object.values(notebooks).map(notebook => (
                  <div key={notebook.id} className="space-y-1">
                    <button
                      onClick={() => switchToNotebook(notebook.id)}
                      className={`w-full text-left p-2 rounded text-sm ${
                        currentNotebook === notebook.id
                          ? 'bg-blue-100 text-blue-800'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {notebook.name}
                    </button>
                    
                    {currentNotebook === notebook.id && (
                      <div className="ml-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Sheets</span>
                          <button
                            onClick={createNewSheet}
                            className="text-green-600 hover:text-green-800 text-xs"
                          >
                            + New
                          </button>
                        </div>
                        
                        {Object.values(notebook.sheets).map(sheet => (
                          <button
                            key={sheet.id}
                            onClick={() => switchToSheet(sheet.id)}
                            className={`w-full text-left p-1 rounded text-xs ${
                              currentSheet === sheet.id
                                ? 'bg-green-100 text-green-800'
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                          >
                            {sheet.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTool('pen')}
                className={`px-4 py-2 rounded font-medium ${
                  activeTool === 'pen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Pen
              </button>
              <button
                onClick={() => setActiveTool('eraser')}
                className={`px-4 py-2 rounded font-medium ${
                  activeTool === 'eraser'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Eraser
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Color:</label>
              <input
                type="color"
                value={penSettings.color}
                onChange={(e) => setPenSettings(prev => ({ ...prev, color: e.target.value }))}
                className="w-8 h-8 rounded border"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Pen Size:</label>
              <input
                type="range"
                min="1"
                max="20"
                value={penSettings.width}
                onChange={(e) => setPenSettings(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                className="w-20"
              />
              <span className="text-sm text-gray-600">{penSettings.width}px</span>
            </div>
            
            {activeTool === 'eraser' && (
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Eraser Size:</label>
                <input
                  type="range"
                  min="4"
                  max="40"
                  value={eraserSize}
                  onChange={(e) => setEraserSize(parseInt(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">{eraserSize}px</span>
              </div>
            )}
            
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className={`w-full h-full drawing-canvas ${activeTool === 'eraser' ? 'eraser' : ''}`}
            onMouseDown={startDrawing}
            onMouseMove={(e) => {
              draw(e);
              handleMouseMove(e);
            }}
            onMouseUp={stopDrawing}
            onMouseLeave={(e) => {
              stopDrawing(e);
              handleMouseLeave();
            }}
            onMouseEnter={handleMouseEnter}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{ touchAction: 'none' }}
          />
          
          {/* Eraser Cursor */}
          {showEraserCursor && activeTool === 'eraser' && (
            <div
              className="absolute pointer-events-none border-2 border-red-400 rounded-full bg-red-200 bg-opacity-30"
              style={{
                left: mousePosition.x - eraserSize / 2,
                top: mousePosition.y - eraserSize / 2,
                width: eraserSize,
                height: eraserSize,
                zIndex: 10
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
