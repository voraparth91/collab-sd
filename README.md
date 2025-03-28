# Collaborative Sequence Diagram Editor

A real-time collaborative web application for creating and visualizing sequence diagrams. The application features a split-panel interface with a code editor on the left and a rendered diagram on the right.

## Project Overview

This application allows multiple users to collaboratively edit sequence diagram code in real-time. As users type in the editor, the diagram updates automatically, providing immediate visual feedback.

## Key Features

- Split-panel interface with resizable panels
- Real-time sequence diagram rendering
- Collaborative text editing
- Syntax highlighting for sequence diagram code
- URL-based session sharing
- SVG/PNG export options
- Automatic error highlighting

## Technology Stack

### Frontend
- **React**: UI framework
- **CodeMirror 6**: Text editor component with syntax highlighting
- **Mermaid.js**: Sequence diagram renderer
- **Y.js**: CRDT implementation for collaborative editing
- **TailwindCSS**: Styling framework

### Backend/Infrastructure
- **y-websocket**: WebSocket provider for Y.js
- **Firebase/Supabase**: Backend services (authentication, persistence)
- **Express.js**: (Optional) For custom WebSocket server

## Architecture Overview

The application follows a client-heavy architecture with minimal backend requirements:

1. **Client-side**:
   - React SPA with split-panel layout
   - CodeMirror editor bound to Y.js for collaborative editing
   - Mermaid.js for diagram rendering from text input
   - WebSocket connection for real-time collaboration

2. **Server-side**:
   - WebSocket server for Y.js synchronization
   - Document/room management
   - User authentication (optional)
   - Diagram persistence (optional)

## Implementation Plan

### Phase 1: Basic Editor Setup

1. **Project Initialization**
   - Create React app
   - Install dependencies
   - Set up development environment

2. **Split Panel UI**
   - Implement resizable split panel layout
   - Create basic responsive design

3. **Editor Implementation**
   - Integrate CodeMirror 6
   - Configure syntax highlighting
   - Implement basic editor functionality

4. **Diagram Renderer**
   - Integrate Mermaid.js
   - Create component that renders diagrams from editor content
   - Implement error handling for invalid syntax

### Phase 2: Real-time Collaboration

1. **Y.js Integration**
   - Set up Y.js document structure
   - Bind CodeMirror to Y.js shared document
   - Implement awareness features (cursor positions, user presence)

2. **WebSocket Provider**
   - Set up y-websocket provider
   - Configure connection management
   - Implement reconnection logic

3. **Session Management**
   - Generate unique document IDs
   - Implement URL-based session sharing
   - Add session joining/leaving logic

### Phase 3: Advanced Features

1. **User Interface Enhancements**
   - Implement theming options
   - Add editor preferences
   - Create user presence indicators

2. **Export Functionality**
   - Add SVG/PNG export options
   - Implement copy-to-clipboard feature
   - Create diagram sharing options

3. **Error Handling & Validation**
   - Improve error messages
   - Add syntax validation
   - Implement real-time error highlighting

4. **Persistence Layer**
   - Add diagram saving functionality
   - Implement version history (optional)
   - Create user accounts (optional)

## Setup Instructions

```bash
# Clone the repository
git clone [repository-url]
cd sequence-diagram-editor

# Install dependencies
npm install

# Start development server
npm start

# For production build
npm run build
```

## Code Examples

### Editor Component with Y.js Integration

```jsx
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';

const Editor = ({ documentId }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    // Create a Yjs document
    const ydoc = new Y.Doc();
    
    // Connect to WebSocket server
    const provider = new WebsocketProvider(
      'wss://your-websocket-server.com',
      documentId,
      ydoc
    );
    
    // Get shared text from Yjs document
    const ytext = ydoc.getText('codemirror');
    
    // Set up CodeMirror with collaborative extension
    const view = new EditorView({
      state: EditorState.create({
        extensions: [
          basicSetup,
          yCollab(ytext, provider.awareness)
        ]
      }),
      parent: editorRef.current
    });
    
    viewRef.current = view;
    
    return () => {
      // Clean up
      view.destroy();
      provider.disconnect();
      ydoc.destroy();
    };
  }, [documentId]);

  return <div ref={editorRef} className="editor-container" />;
};
```

### Diagram Renderer Component

```jsx
import mermaid from 'mermaid';
import { useEffect, useRef } from 'react';

const DiagramRenderer = ({ code }) => {
  const diagramRef = useRef(null);
  
  useEffect(() => {
    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      logLevel: 'error',
      fontFamily: 'monospace'
    });
    
    if (diagramRef.current && code) {
      try {
        // Clear previous diagram
        diagramRef.current.innerHTML = '';
        
        // Render new diagram
        mermaid.render('diagram', code, (svgCode) => {
          diagramRef.current.innerHTML = svgCode;
        });
      } catch (error) {
        console.error('Failed to render diagram:', error);
        diagramRef.current.innerHTML = `<div class="error">Diagram rendering error: ${error.message}</div>`;
      }
    }
  }, [code]);
  
  return <div ref={diagramRef} className="diagram-container" />;
};
```

## Future Enhancements

- Mobile-responsive design
- Custom diagram templates
- Offline support
- Integration with design tools
- Commenting and annotation features
- Template gallery

## License

MIT 