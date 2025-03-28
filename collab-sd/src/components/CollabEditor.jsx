import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/mode/javascript/javascript';
// Import the addon for active line highlighting
import 'codemirror/addon/selection/active-line';
// Add autocomplete addons
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';

// Import Yjs and y-websocket for collaboration
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
// Use the official y-codemirror binding
import { CodemirrorBinding } from 'y-codemirror';
// Import IndexedDB provider for offline persistence
import { IndexeddbPersistence } from 'y-indexeddb';

// Define a custom mode for sequence diagrams
const defineSequenceDiagramMode = () => {
  CodeMirror.defineMode("sequence", function() {
    return {
      token: function(stream, state) {
        // Keywords in blue
        if (stream.match(/title|note\s+over|sequenceDiagram|participant|loop|end|opt|alt|else/i)) {
          return "keyword"; // Keywords like "title", "note over" in blue
        }
        
        // Actors (typically at the start of a line with arrows)
        if (stream.match(/^\s*[A-Za-z0-9_-]+(?=->|<-|->>|<<-|-->>|<<--)/)) {
          return "variable-2"; // Participants in green
        }
        
        // Right-side actors (after arrows)
        if (stream.match(/(?:->|<-|->>|<<-|-->>|<<--)\s*[A-Za-z0-9_-]+/)) {
          // Extract just the name part
          stream.backUp(stream.current().length);
          stream.match(/(?:->|<-|->>|<<-|-->>|<<--)\s*/);
          if (stream.match(/[A-Za-z0-9_-]+/)) {
            return "variable-2"; // Actors in green
          }
        }
        
        // Arrow operators
        if (stream.match(/->|<-|->>|<<-|-->>|<<--/)) {
          return "operator"; // Arrows in a different color
        }
        
        // Skip over text inside strings
        if (stream.match(/".+?"|'.+?'/)) {
          return "string";
        }
        
        // Skip over any other character
        stream.next();
        return null;
      }
    };
  });
};

// Dynamically determine WebSocket URL based on current domain
// const WEBSOCKET_SERVER = `ws://${window.location.hostname}:1234`;
const WEBSOCKET_SERVER = `wss://collab-sd-production.up.railway.app/`;

// Sequence diagram keywords and symbols
const KEYWORDS = [
  'sequenceDiagram',
  'participant',
  'actor',
  'note',
  'note over',
  'note left of',
  'note right of',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'rect',
  'end',
  'activate',
  'deactivate',
  'title',
  'autonumber'
];

const ARROWS = [
  '->',
  '-->',
  '->>',
  '-->>',
  '-x',
  '--x',
  '-)',
  '--)',
  '<->',
  '<-->',
  '<->>'
];

// Custom hint function for sequence diagrams
const createSequenceDiagramHint = (cm) => {
  const cursor = cm.getCursor();
  const line = cm.getLine(cursor.line);
  const token = cm.getTokenAt(cursor);
  const start = token.start;
  const end = cursor.ch;
  const currentWord = line.slice(start, end).toLowerCase();

  // Get all participant names from the current document
  const docText = cm.getValue();
  const participantMatches = docText.match(/participant\s+(\w+)/g) || [];
  const participants = participantMatches.map(p => p.split(/\s+/)[1]);
  
  // Create suggestions based on context
  let suggestions = [];
  
  // At the start of a line, suggest keywords
  if (token.start === 0 || /^\s+$/.test(line.slice(0, token.start))) {
    suggestions = suggestions.concat(KEYWORDS);
  }
  
  // After 'participant', suggest existing participant names as examples
  if (line.slice(0, start).trim().endsWith('participant')) {
    suggestions = suggestions.concat(participants);
  }
  
  // When typing an arrow, suggest arrow types
  if (/[-<>]/.test(currentWord)) {
    suggestions = suggestions.concat(ARROWS);
  }
  
  // After an arrow, suggest participant names
  const beforeCursor = line.slice(0, cursor.ch);
  if (/[-]>|-->>|->>\s*$/.test(beforeCursor)) {
    suggestions = suggestions.concat(participants);
  }
  
  // Add all existing participant names as suggestions
  suggestions = suggestions.concat(participants);
  
  // Filter suggestions based on current input
  const filteredSuggestions = suggestions
    .filter(s => s.toLowerCase().startsWith(currentWord))
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  return {
    list: filteredSuggestions,
    from: CodeMirror.Pos(cursor.line, start),
    to: CodeMirror.Pos(cursor.line, end)
  };
};

const CollabEditor = forwardRef(({ code, setCode, initialCursor, roomId }, ref) => {
  const editorRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const isInitializedRef = useRef(false);
  const initialCursorRef = useRef(initialCursor || null);
  
  // Refs for Yjs collaboration
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const yTextRef = useRef(null);
  const bindingRef = useRef(null);

  // Add ref for the IndexedDB provider
  const indexeddbProviderRef = useRef(null);

  // Status of the collaboration
  const [collaborationStatus, setCollaborationStatus] = React.useState('connecting');
  const [connectedUsers, setConnectedUsers] = React.useState(1);

  // Expose methods to get and set cursor position
  useImperativeHandle(ref, () => ({
    getCursorPosition: () => {
      if (codeMirrorRef.current) {
        const cursor = codeMirrorRef.current.getCursor();
        return {
          line: cursor.line,
          ch: cursor.ch
        };
      }
      return null;
    },
    setCursorPosition: (position) => {
      if (codeMirrorRef.current && position) {
        codeMirrorRef.current.setCursor(position);
        codeMirrorRef.current.focus();
      }
    }
  }));

  // Define the custom mode once when the component mounts
  useEffect(() => {
    defineSequenceDiagramMode();
  }, []);

  // Initialize the editor with Yjs collaboration
  useEffect(() => {
    if (!editorRef.current || isInitializedRef.current) return;

    try {
      console.log('Initializing editor with collaboration...');
      
      // Set up Yjs document and collaboration first
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      
      // Room name based on the roomId
      const roomName = `collab-sd-${roomId}`;
      
      // Set up IndexedDB persistence
      console.log(`Setting up IndexedDB persistence for room: ${roomName}`);
      const indexeddbProvider = new IndexeddbPersistence(roomName, ydoc);
      indexeddbProviderRef.current = indexeddbProvider;
      
      // Handle IndexedDB provider events
      indexeddbProvider.on('synced', () => {
        console.log('Content loaded from IndexedDB');
      });
      
      // Connect to the websocket server for collaboration
      console.log(`Connecting to WebSocket server for room: ${roomName}`);
      const provider = new WebsocketProvider(
        WEBSOCKET_SERVER,
        roomName,
        ydoc,
        { connect: true }
      );
      providerRef.current = provider;

      // Create a shared text type for the editor content
      const yText = ydoc.getText('codemirror');
      yTextRef.current = yText;
      
      // Configure awareness
      provider.awareness.setLocalStateField('user', {
        name: 'User-' + Math.floor(Math.random() * 100),
        color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
      });
      
      // Track document initialization
      let hasInitialized = false;
      
      // Handle offline status
      const updateConnectionStatus = () => {
        if (navigator.onLine) {
          console.log('Browser is online, trying to connect...');
          provider.connect();
        } else {
          console.log('Browser is offline, using stored data');
          setCollaborationStatus('offline');
        }
      };
      
      // Listen for online/offline events
      window.addEventListener('online', updateConnectionStatus);
      window.addEventListener('offline', () => {
        console.log('Browser went offline');
        setCollaborationStatus('offline');
      });
      
      // Initialize CodeMirror with empty content first
      // We'll set the content after determining what should be used
      const codeMirrorInstance = CodeMirror(editorRef.current, {
        value: '', // Start with empty content
        mode: "sequence", 
        theme: "eclipse",
        lineNumbers: true,
        lineWrapping: true,
        autofocus: true,
        indentWithTabs: false,
        tabSize: 2,
        indentUnit: 2,
        smartIndent: false, // Disable smart indentation
        styleActiveLine: true, // Highlight the active line
        viewportMargin: Infinity,
        extraKeys: {
          "Tab": (cm) => cm.replaceSelection("  "),
          "Ctrl-Space": "autocomplete", // Trigger autocomplete with Ctrl-Space
          "Cmd-Space": "autocomplete"   // For Mac users
        },
        hintOptions: {
          hint: createSequenceDiagramHint,
          completeSingle: false,        // Don't auto-complete if there's only one option
          alignWithWord: true,          // Align the completion box with the word
          closeOnUnfocus: true,         // Close completion box when editor loses focus
          closeCharacters: /[\s()[\]{};:>,]/,
          customKeys: {
            "Up": function(cm, handle) { handle.moveFocus(-1); },
            "Down": function(cm, handle) { handle.moveFocus(1); },
            "PageUp": function(cm, handle) { handle.moveFocus(-10); },
            "PageDown": function(cm, handle) { handle.moveFocus(10); },
            "Enter": function(cm, handle) { handle.pick(); },
            "Tab": function(cm, handle) { handle.pick(); },
            "Esc": function(cm, handle) { handle.close(); }
          }
        }
      });
      
      // Store the instance in a ref
      codeMirrorRef.current = codeMirrorInstance;
      
      // Create the binding between CodeMirror and Yjs
      const binding = new CodemirrorBinding(yText, codeMirrorInstance, provider.awareness);
      bindingRef.current = binding;

      // Set up key mappings
      codeMirrorInstance.setOption('extraKeys', {
        ...codeMirrorInstance.getOption('extraKeys'),
        "Tab": (cm) => cm.replaceSelection("  ")
      });

      // Override the awareness handling to fix JSON parsing error
      const originalOnAwarenessChange = binding._awarenessChangeHandler;
      binding._awarenessChangeHandler = (changes, transaction) => {
        try {
          originalOnAwarenessChange(changes, transaction);
        } catch (err) {
          if (err.message && err.message.includes('not valid JSON')) {
            console.warn('Caught JSON parsing error in awareness change handler', err);
          } else {
            throw err;
          }
        }
      };
      
      // Handle connection status changes
      provider.on('status', ({ status }) => {
        console.log(`WebSocket connection status: ${status}`);
        setCollaborationStatus(status);
        
        // Initialize document content when connected
        if ((status === 'connected' || navigator.onLine === false) && !hasInitialized) {
          // IMPORTANT: Wait a moment to ensure the remote document is fully synced
          setTimeout(() => {
            const yTextContent = yText.toString();
            console.log(`Document content length: ${yTextContent.length}`);
            
            if (yTextContent.length > 0) {
              // Remote or IndexedDB document exists, use its content
              console.log('Using existing document content');
              hasInitialized = true;
              
              // Make sure UI state is updated with remote content
              if (yTextContent !== code) {
                setCode(yTextContent);
              }
              
              // Update CodeMirror with the content directly
              if (codeMirrorRef.current) {
                const currentValue = codeMirrorRef.current.getValue();
                if (currentValue !== yTextContent) {
                  codeMirrorRef.current.setValue(yTextContent);
                }
              }
            } else {
              // No existing document, initialize with provided code
              console.log('Document is empty, initializing with provided content');
              if (code && code.length > 0) {
                console.log(`Initializing with ${code.length} characters`);
                
                // Normalize the code - make sure it has sequenceDiagram if needed
                let initialCode = code.trim();
                if (!initialCode.startsWith('sequenceDiagram')) {
                  // Don't add sequenceDiagram to the editor content
                  // The renderer will handle this automatically
                }
                
                // Use transaction for atomic changes
                ydoc.transact(() => {
                  // Only insert if the document is still empty
                  if (yText.toString() === '') {
                    yText.insert(0, initialCode);
                  }
                });
                hasInitialized = true;
              }
            }
          }, 500); // Wait 500ms to ensure sync has completed
        }
      });

      // Handle awareness updates (connected users)
      provider.awareness.on('change', () => {
        const users = Array.from(provider.awareness.getStates().keys());
        setConnectedUsers(users.length);
      });

      // Listen for text changes to update the parent component
      let updateTimer = null;
      
      const updateParentCode = () => {
        const value = yText.toString();
        if (value !== code) {
          console.log(`Updating parent component with new content (length: ${value.length})`);
          // Immediately update the parent's state
          setCode(value);
        }
      };

      // Set up observer for Yjs document changes
      yText.observe(() => {
        // Clear any existing timer
        if (updateTimer) clearTimeout(updateTimer);
        // For Yjs updates, use a very short timeout to batch rapid changes
        updateTimer = setTimeout(updateParentCode, 50); // Much shorter timeout
      });

      // Also listen for local changes from CodeMirror
      codeMirrorInstance.on('changes', () => {
        // This captures direct user input
        // The change will be reflected in yText via the binding,
        // which will then trigger the yText.observe above
      });

      // Force a refresh to ensure proper rendering
      setTimeout(() => {
        codeMirrorInstance.refresh();
        
        // Set cursor position if available from previous session
        if (initialCursorRef.current) {
          codeMirrorInstance.setCursor(initialCursorRef.current);
          codeMirrorInstance.focus();
        }
      }, 100);

      // Start with current online status
      updateConnectionStatus();

      // Mark as initialized
      isInitializedRef.current = true;
      console.log(`Editor initialization complete for room: ${roomName}`);
      
      // Add automatic trigger for autocomplete
      codeMirrorInstance.on("inputRead", function(cm, change) {
        if (change.origin !== "complete" && /[\w->]/.test(change.text[0])) {
          cm.showHint({ completeSingle: false });
        }
      });

      // Cleanup function
      return () => {
        // Clean up online/offline event listeners
        window.removeEventListener('online', updateConnectionStatus);
        window.removeEventListener('offline', updateConnectionStatus);
        
        // Clean up on unmount
        console.log('Cleaning up collaboration resources...');
        
        // Clean up binding first
        if (bindingRef.current) {
          try {
            bindingRef.current.destroy();
          } catch (err) {
            console.warn('Error while destroying binding:', err);
          }
          bindingRef.current = null;
        }
        
        // Clean up WebSocket provider
        if (providerRef.current) {
          try {
            providerRef.current.disconnect();
          } catch (err) {
            console.warn('Error while disconnecting provider:', err);
          }
          providerRef.current = null;
        }
        
        // Clean up IndexedDB provider
        if (indexeddbProviderRef.current) {
          try {
            indexeddbProviderRef.current.destroy();
          } catch (err) {
            console.warn('Error while destroying IndexedDB provider:', err);
          }
          indexeddbProviderRef.current = null;
        }
        
        // Clean up Yjs document
        if (ydocRef.current) {
          try {
            ydocRef.current.destroy();
          } catch (err) {
            console.warn('Error while destroying ydoc:', err);
          }
          ydocRef.current = null;
        }
        
        // Clean up CodeMirror instance
        if (codeMirrorRef.current) {
          try {
            const wrapper = codeMirrorRef.current.getWrapperElement();
            if (wrapper && wrapper.parentNode) {
              wrapper.parentNode.removeChild(wrapper);
            }
          } catch (err) {
            console.warn('Error while cleaning up CodeMirror:', err);
          }
          codeMirrorRef.current = null;
        }
        
        // Reset initialization flag
        isInitializedRef.current = false;
      };
    } catch (error) {
      console.error('Error setting up collaborative editor:', error);
      
      // Show error if editor fails to initialize
      if (editorRef.current) {
        editorRef.current.innerHTML = `
          <div style="color: red; padding: 10px;">
            Error initializing collaborative editor: ${error.message}
          </div>
          <pre style="white-space: pre-wrap; padding: 10px; background: #f5f5f5; 
               color: #333; height: calc(100% - 50px); overflow: auto;">${code}</pre>
        `;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]); // Re-initialize when the roomId changes

  // Render the editor with collaboration status
  return (
    <div className="collaborative-editor">
      <div className="collaboration-status">
        {collaborationStatus === 'connected' ? (
          <span className="status-connected">
            <span className="dot connected"></span>
            Connected with {connectedUsers} user{connectedUsers !== 1 ? 's' : ''}
          </span>
        ) : collaborationStatus === 'offline' ? (
          <span className="status-offline">
            <span className="dot offline"></span>
            Offline mode (changes will sync when reconnected)
          </span>
        ) : (
          <span className="status-connecting">
            <span className="dot connecting"></span>
            {collaborationStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        )}
      </div>
      <div ref={editorRef} className="editor-container" />
    </div>
  );
});

export default CollabEditor; 