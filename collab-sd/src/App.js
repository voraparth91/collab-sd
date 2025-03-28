import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiDownload, FiShare2 } from 'react-icons/fi';
import './App.css';
import './styles/CollabEditor.css';
import CollabEditor from './components/CollabEditor';
import DiagramRenderer from './components/DiagramRenderer';
import { generateUUID } from './utils/collabUtils';
import { exportDiagramAsJPEG } from './utils/exportUtils';

// Storage keys for localStorage
const STORAGE_KEY = 'collab-sd-diagram-code';
const CURSOR_STORAGE_KEY = 'collab-sd-cursor-position';

// Flag to control localStorage usage for debugging
const USE_LOCAL_STORAGE = false;

function App() {
  // Get ID from URL path parameter
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Set collaboration ID from path or generate a new one
  const [collaborationId, setCollaborationId] = useState(() => {
    if (id) {
      return id;
    } else {
      // Generate a new UUID if none exists
      const newId = generateUUID();
      // Use a short timeout to ensure navigate happens after component is mounted
      setTimeout(() => {
        navigate(`/${newId}`);
      }, 0);
      return newId;
    }
  });

  // Load saved cursor position from localStorage (if enabled)
  const savedCursorPosition = useRef(
    USE_LOCAL_STORAGE ? JSON.parse(localStorage.getItem(CURSOR_STORAGE_KEY) || 'null') : null
  );
  
  // Create a ref for the editor component
  const editorRef = useRef(null);
  
  // Default diagram template
  const defaultDiagram = `participant Alice
participant Bob
participant John
Alice->>John: Hello John, how are you?
loop Health check
    John->>John: Fight against hypochondria
end
Note right of John: Rational thoughts prevail!
John-->>Alice: Great!
John->>Bob: How about you?
Bob-->>John: Jolly good!`;
  
  // Load saved code from localStorage (if enabled) or use default
  const [code, setCode] = useState(() => {
    if (USE_LOCAL_STORAGE) {
      const savedCode = localStorage.getItem(STORAGE_KEY);
      return savedCode || defaultDiagram;
    }
    return defaultDiagram;
  });

  // Setup autosave timer reference
  const autoSaveTimerRef = useRef(null);

  // Panel size state
  const [panelSizes, setPanelSizes] = useState({
    left: 50,
    right: 50,
  });

  const [isDragging, setIsDragging] = useState(false);

  // Handle code changes and trigger auto-save
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    
    // Don't save to localStorage if disabled
    if (!USE_LOCAL_STORAGE) return;
    
    // Clear any existing timer to avoid multiple saves
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Setup a new timer for auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      // Save to localStorage if the code has changed
      if (localStorage.getItem(STORAGE_KEY) !== newCode) {
        localStorage.setItem(STORAGE_KEY, newCode);
        console.log('Auto-saved diagram code to localStorage');
      }
      
      // Also save cursor position
      if (editorRef.current) {
        const cursorPosition = editorRef.current.getCursorPosition();
        if (cursorPosition) {
          localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(cursorPosition));
          console.log('Auto-saved cursor position to localStorage');
        }
      }
    }, 1000); // Save after 1 second of inactivity
  }, []);
  
  // Save cursor position when window unloads (closes or refreshes)
  useEffect(() => {
    // Skip if localStorage is disabled
    if (!USE_LOCAL_STORAGE) return;
    
    const handleBeforeUnload = () => {
      if (editorRef.current) {
        const cursorPosition = editorRef.current.getCursorPosition();
        if (cursorPosition) {
          localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(cursorPosition));
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // When the path ID changes, update our collaboration ID
  useEffect(() => {
    if (id && id !== collaborationId) {
      setCollaborationId(id);
    }
  }, [id, collaborationId]);

  const handleDrag = useCallback((e) => {
    if (!isDragging) return;

    const container = document.getElementById('split-container');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const leftPercentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Set minimum panel sizes (20%)
    const newLeftSize = Math.min(Math.max(leftPercentage, 20), 80);
    const newRightSize = 100 - newLeftSize;

    setPanelSizes({
      left: newLeftSize,
      right: newRightSize,
    });
  }, [isDragging]);

  const handleMouseDown = () => {
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDrag]);
  
  // Set cursor position when editor is mounted
  useEffect(() => {
    if (editorRef.current && savedCursorPosition.current) {
      // Schedule this after a small delay to ensure editor is fully initialized
      setTimeout(() => {
        editorRef.current.setCursorPosition(savedCursorPosition.current);
      }, 200);
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Collaborative Sequence Diagram Editor</h1>
        <div className="session-info">
          Session ID: <code>{collaborationId}</code>
          <button 
            className="share-button"
            onClick={() => {
              // Copy the current URL to clipboard
              navigator.clipboard.writeText(window.location.href);
              alert('Collaboration link copied to clipboard! Share it with others to collaborate.');
            }}
          >
            <FiShare2 className="button-icon" /> Share
          </button>
          <button 
            className="download-button"
            onClick={() => exportDiagramAsJPEG(`sequence-diagram-${collaborationId}.jpg`)}
            title="Download as JPEG"
          >
            <FiDownload className="button-icon" /> Download
          </button>
        </div>
      </header>
      <div 
        id="split-container" 
        className="split-container"
        onMouseUp={handleMouseUp}
      >
        <div 
          className="panel left-panel" 
          style={{ width: `${panelSizes.left}%` }}
        >
          <CollabEditor
            ref={editorRef}
            code={code} 
            setCode={handleCodeChange}
            initialCursor={savedCursorPosition.current}
            roomId={collaborationId}
          />
        </div>
        
        <div 
          className="divider"
          onMouseDown={handleMouseDown}
        />
        
        <div 
          className="panel right-panel" 
          style={{ width: `${panelSizes.right}%` }}
        >
          <DiagramRenderer code={code} />
        </div>
      </div>
    </div>
  );
}

export default App; 