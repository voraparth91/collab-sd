import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '../components/Editor';
import DiagramRenderer from '../components/DiagramRenderer';
import { getYDoc, getWebsocketProvider, updateUserInfo } from '../utils/collaboration';
import { randomColor } from '../utils/helpers';

// Storage prefixes for localStorage
const STORAGE_PREFIX = 'collab-sd-';
// Access CLIENT_ID from localStorage to use in transactions
const CLIENT_ID = localStorage.getItem('collab-sd-clientId') || '';

const EditorPage = ({ docId }) => {
  // Generate a unique user color for this session
  const userColor = useRef(randomColor());
  // User ID should be persistent for the session
  const userId = useRef(localStorage.getItem(`${STORAGE_PREFIX}userId`) || `User-${Math.floor(Math.random() * 1000)}`);
  
  // Store user ID in localStorage to persist it
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}userId`, userId.current);
  }, []);
  
  // References
  const editorRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  
  // Document and provider references
  const docRef = useRef(null);
  const providerRef = useRef(null);
  const yTextRef = useRef(null);
  
  // Panel size state
  const [panelSizes, setPanelSizes] = useState({
    left: 50,
    right: 50,
  });
  
  // Editor content
  const [code, setCode] = useState(() => {
    // Try to load from localStorage first
    const storageKey = `${STORAGE_PREFIX}${docId}`;
    const savedCode = localStorage.getItem(storageKey);
    return savedCode || `
participant Alice
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
  });
  
  // Cursor position
  const savedCursorPosition = useRef(
    JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}cursor-${docId}`) || 'null')
  );
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  
  // Initialize Y.js document and WebSocket provider
  useEffect(() => {
    // Get or create Y.js document
    const doc = getYDoc(docId);
    docRef.current = doc;
    
    // Get the shared text type
    const yText = doc.getText('codemirror');
    yTextRef.current = yText;
    
    // Initialize with content if empty
    if (yText.length === 0 && code) {
      yText.insert(0, code);
    }
    
    // Get or create WebSocket provider
    const provider = getWebsocketProvider(docId, doc);
    providerRef.current = provider;
    
    // Set up awareness (user info)
    updateUserInfo(docId, {
      name: userId.current,
      color: userColor.current
    });
    
    // Handle connection status
    const handleStatus = ({ status }) => {
      console.log(`Connection status: ${status}`);
      
      // When we're connected, make sure we're using the latest content
      if (status === 'connected') {
        // If the document has content from the server, update local state
        const content = yText.toString();
        if (content && content !== code) {
          setCode(content);
        }
      }
    };
    
    provider.on('status', handleStatus);
    
    // Clean up
    return () => {
      provider.off('status', handleStatus);
      // We don't disconnect the provider here to allow reconnection when component remounts
    };
  }, [docId, code]);
  
  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Update connection status when provider changes
  useEffect(() => {
    if (!providerRef.current) return;
    
    const updateStatus = (event) => {
      setConnectionStatus(event.status);
    };
    
    providerRef.current.on('status', updateStatus);
    
    return () => {
      if (providerRef.current) {
        providerRef.current.off('status', updateStatus);
      }
    };
  }, []);

  // Handle code changes and sync with Y.js
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    
    // Auto-save to localStorage
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      const storageKey = `${STORAGE_PREFIX}${docId}`;
      localStorage.setItem(storageKey, newCode);
      
      // Save cursor position
      if (editorRef.current) {
        const cursorPosition = editorRef.current.getCursorPosition();
        if (cursorPosition) {
          localStorage.setItem(`${STORAGE_PREFIX}cursor-${docId}`, JSON.stringify(cursorPosition));
        }
      }
      
      console.log(`Auto-saved document ${docId} to localStorage`);
    }, 1000);
  }, [docId]);
  
  // Set up window unload handler to save state
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save code
      const storageKey = `${STORAGE_PREFIX}${docId}`;
      localStorage.setItem(storageKey, code);
      
      // Save cursor
      if (editorRef.current) {
        const cursorPosition = editorRef.current.getCursorPosition();
        if (cursorPosition) {
          localStorage.setItem(`${STORAGE_PREFIX}cursor-${docId}`, JSON.stringify(cursorPosition));
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
  }, [docId, code]);
  
  // Set cursor position when editor is mounted
  useEffect(() => {
    if (editorRef.current && savedCursorPosition.current) {
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.setCursorPosition(savedCursorPosition.current);
        }
      }, 200);
    }
  }, []);
  
  // Handle drag to resize panels
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

  // Handle copying URL to clipboard
  const handleCopyUrl = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('URL copied to clipboard!');
    }).catch(err => {
      console.error('Could not copy URL: ', err);
    });
  }, []);

  // Force manual sync with server
  const handleForceSync = useCallback(() => {
    if (providerRef.current) {
      console.log('Manually forcing synchronization with server');
      
      try {
        // Use the new manualSync method which handles all sync scenarios
        if (typeof providerRef.current.manualSync === 'function') {
          providerRef.current.manualSync();
        } 
        // Fallback to the old methods if available
        else if (typeof providerRef.current.forceSync === 'function') {
          providerRef.current.forceSync();
        }
        else if (typeof providerRef.current.disconnect === 'function' && 
                typeof providerRef.current.connect === 'function') {
          providerRef.current.disconnect();
          setTimeout(() => {
            providerRef.current.connect();
          }, 100);
        }
        else {
          console.warn('No suitable sync method found on the provider');
        }
      } catch (err) {
        console.error('Error during force sync:', err);
      }
    } else {
      console.warn('Cannot force sync - provider not available');
    }
  }, []);

  // Track connected users
  const [connectedUsers, setConnectedUsers] = useState([]);
  
  // Update connected users when awareness changes
  useEffect(() => {
    if (!providerRef.current) return;
    
    const awareness = providerRef.current.awareness;
    
    const updateUsers = () => {
      if (!awareness) return;
      
      const states = awareness.getStates();
      const users = Array.from(states.entries())
        .filter(([_, state]) => state.user)
        .map(([clientId, state], index) => ({
          clientId,
          uniqueKey: `${clientId}-${index}-${Date.now()}`,
          ...state.user
        }));
      
      setConnectedUsers(users);
      console.log('Updated connected users:', users.length);
    };
    
    // Use change event to track user updates
    const handleChange = () => {
      updateUsers();
    };
    
    awareness.on('change', handleChange);
    updateUsers(); // Initial update
    
    return () => {
      if (awareness) {
        awareness.off('change', handleChange);
      }
    };
  }, []);

  return (
    <div 
      id="split-container" 
      className="split-container"
      onMouseUp={handleMouseUp}
    >
      <div 
        className="panel left-panel" 
        style={{ width: `${panelSizes.left}%` }}
      >
        <Editor 
          ref={editorRef}
          key={`editor-${docId}`}
          code={code} 
          setCode={handleCodeChange}
          initialCursor={savedCursorPosition.current}
          docId={docId}
          yDoc={docRef.current}
          provider={providerRef.current}
          yText={yTextRef.current}
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
      
      {/* Connection Status and Document Info */}
      <div className="document-info">
        <div className="connection-status">
          <div className={`connection-status-dot ${connectionStatus}`}></div>
          <span>{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
        </div>
        
        <div className="share-url" onClick={handleCopyUrl}>
          <span>Share URL</span>
        </div>
        
        <div className="force-sync" onClick={handleForceSync}>
          <div className="sync-icon"></div>
          <span>Force Sync</span>
        </div>
      </div>
      
      {/* Connected Users */}
      <div className="users-container">
        {connectedUsers.map(user => (
          <div 
            key={user.uniqueKey || user.clientId} 
            className="user-badge"
            style={{ backgroundColor: user.color }}
          >
            <div className="user-dot"></div>
            <span>{user.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditorPage; 