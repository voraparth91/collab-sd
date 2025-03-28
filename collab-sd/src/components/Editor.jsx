import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/mode/javascript/javascript';

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

const Editor = forwardRef(({ code, setCode, initialCursor }, ref) => {
  const editorRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const isInitializedRef = useRef(false);
  const initialCursorRef = useRef(initialCursor || null);

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

  // Initialize the editor only once
  useEffect(() => {
    if (!editorRef.current || isInitializedRef.current) return;

    try {
      // Initialize CodeMirror
      const codeMirrorInstance = CodeMirror(editorRef.current, {
        value: code,
        mode: "sequence", // Use our custom mode for sequence diagrams
        theme: "eclipse", // Light theme similar to the image
        lineNumbers: true,
        lineWrapping: true,
        autofocus: true,
        indentWithTabs: false,
        tabSize: 2,
        indentUnit: 2,
        viewportMargin: Infinity,
        // Ensure text is left-aligned
        extraKeys: {
          "Tab": (cm) => cm.replaceSelection("  ")
        }
      });

      // Store the instance in a ref
      codeMirrorRef.current = codeMirrorInstance;

      // Set up event listener for changes
      codeMirrorInstance.on('change', (instance) => {
        // Only update if the change is from user input
        if (!instance.getOption('readOnly')) {
          const value = instance.getValue();
          setCode(value);
        }
      });

      // Set up cursor activity listener
      codeMirrorInstance.on('cursorActivity', () => {
        // This will trigger whenever the cursor moves
        // We don't need to do anything here, but this could be used
        // for additional tracking if needed
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

      // Mark as initialized
      isInitializedRef.current = true;

      // Log when editor is initialized successfully
      console.log('CodeMirror editor initialized successfully');
    } catch (error) {
      console.error('Error setting up CodeMirror editor:', error);
      
      // Show error if editor fails to initialize
      if (editorRef.current) {
        editorRef.current.innerHTML = `
          <div style="color: red; padding: 10px;">
            Error initializing editor: ${error.message}
          </div>
          <pre style="white-space: pre-wrap; padding: 10px; background: #f5f5f5; 
               color: #333; height: calc(100% - 50px); overflow: auto;">${code}</pre>
        `;
      }
    }
    
    return () => {
      // Clean up on unmount
      if (codeMirrorRef.current) {
        // No explicit destroy method in CodeMirror 5, but we can clean up the DOM
        const wrapper = codeMirrorRef.current.getWrapperElement();
        if (wrapper && wrapper.parentNode) {
          wrapper.parentNode.removeChild(wrapper);
        }
        codeMirrorRef.current = null;
        isInitializedRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initialize only once on mount

  // Update the editor when code changes externally
  useEffect(() => {
    if (codeMirrorRef.current && isInitializedRef.current) {
      const editor = codeMirrorRef.current;
      const currentValue = editor.getValue();
      
      // Only update if the value is actually different and not just from our own changes
      if (currentValue !== code && !editor.hasFocus()) {
        // Save cursor position
        const cursor = editor.getCursor();
        const scrollInfo = editor.getScrollInfo();
        
        // Temporarily set editor to readOnly to prevent triggering change event
        editor.setOption('readOnly', true);
        
        // Update the value
        editor.setValue(code);
        
        // Restore cursor position and scroll
        editor.setCursor(cursor);
        editor.scrollTo(scrollInfo.left, scrollInfo.top);
        
        // Remove readOnly
        editor.setOption('readOnly', false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div ref={editorRef} className="editor-container" />
  );
});

export default Editor; 