import React, { useEffect, useRef, useState } from 'react';
import { FaPlay } from 'react-icons/fa';
import mermaid from 'mermaid';
import DiagramPlayer from './DiagramPlayer';

const DiagramRenderer = ({ code }) => {
  const diagramRef = useRef(null);
  const errorOverlayRef = useRef(null);
  const previousCodeRef = useRef('');
  // State to track if there's a rendering error
  const [hasError, setHasError] = useState(false);
  // State to store error message
  const [errorMessage, setErrorMessage] = useState('');
  // State to track if player is active
  const [isPlayerActive, setIsPlayerActive] = useState(false);

  // Initialize Mermaid once when component mounts
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        logLevel: 'fatal', // Only log fatal errors
        securityLevel: 'loose'
      });
    } catch (error) {
      console.error('Failed to initialize Mermaid:', error);
    }

    // Create error overlay element to be reused
    errorOverlayRef.current = document.createElement('div');
    errorOverlayRef.current.id = 'diagram-error-overlay';
    errorOverlayRef.current.className = 'error';
    errorOverlayRef.current.style.display = 'none';

    return () => {
      // Clean up error overlay on component unmount
      if (errorOverlayRef.current && errorOverlayRef.current.parentNode) {
        errorOverlayRef.current.parentNode.removeChild(errorOverlayRef.current);
      }
    };
  }, []);

  // Force re-render diagram whenever code changes
  useEffect(() => {
    if (!diagramRef.current || !code) return;

    // Ensure the error overlay is attached to the diagram container
    if (errorOverlayRef.current && !diagramRef.current.contains(errorOverlayRef.current)) {
      diagramRef.current.appendChild(errorOverlayRef.current);
    }

    // Check if code has actually changed to avoid unnecessary re-renders
    if (code === previousCodeRef.current && diagramRef.current.querySelector('svg')) {
      return;
    }

    // Update the previous code reference
    previousCodeRef.current = code;

    // Make sure the code starts with sequenceDiagram
    let diagramCode = code.trim();
    if (!diagramCode.startsWith('sequenceDiagram')) {
      diagramCode = 'sequenceDiagram\n' + diagramCode;
    }

    // Log that we're rendering a new diagram
    console.log(`Rendering diagram with code (length: ${diagramCode.length})`);

    // Use our helper function to render the diagram
    renderDiagram(diagramCode);
  }, [code]); // Only depend on code

  // Display error message overlay if there's an error
  useEffect(() => {
    if (!errorOverlayRef.current) return;

    if (hasError) {
      // Update error message and show overlay
      errorOverlayRef.current.innerHTML = `
        <h3>Diagram Rendering Error</h3>
        <pre>${errorMessage}</pre>
        <p>Please check your sequence diagram syntax.</p>
      `;
      errorOverlayRef.current.style.display = 'block';
    } else {
      // Hide overlay if no error
      errorOverlayRef.current.style.display = 'none';
    }
  }, [hasError, errorMessage]);

  // Toggle player visibility
  const togglePlayer = () => {
    const newState = !isPlayerActive;
    setIsPlayerActive(newState);

    // If we're closing the player, re-render the diagram after a short delay
    if (!newState) {
      // First, clear the diagram container completely
      if (diagramRef.current) {
        diagramRef.current.innerHTML = '';
      }

      // Re-initialize mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        logLevel: 'fatal',
        securityLevel: 'loose'
      });

      // Wait a bit longer to ensure fullscreen has fully exited
      setTimeout(() => {
        if (diagramRef.current) {
          // Force re-render the diagram
          const currentCode = previousCodeRef.current;
          console.log('Re-rendering diagram after fullscreen exit with code:', currentCode);
          renderDiagram(currentCode);
        }
      }, 300);
    }
  };

  // Helper function to render the diagram
  const renderDiagram = (diagramCode) => {
    if (!diagramRef.current || !diagramCode) return;

    try {
      // Create a unique ID for this diagram instance
      const id = `mermaid-${Math.random().toString(36).substring(2)}`;

      // Save the error overlay element if it exists
      const errorOverlay = errorOverlayRef.current;

      // Create a temporary container for rendering
      const tempContainer = document.createElement('div');
      tempContainer.style.display = 'none';
      tempContainer.className = 'temp-diagram-container';

      if (diagramRef.current) {
        diagramRef.current.appendChild(tempContainer);
      }

      // Initialize mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        logLevel: 'fatal',
        securityLevel: 'loose'
      });

      // SIMPLE APPROACH: Just ensure the diagram starts with sequenceDiagram
      let finalCode = diagramCode.trim();
      if (!finalCode.startsWith('sequenceDiagram')) {
        finalCode = 'sequenceDiagram\n' + finalCode;
      }

      console.log('Rendering diagram with code:', finalCode);

      // Render the diagram with the original code
      mermaid.render(id, finalCode).then(({ svg }) => {
        if (diagramRef.current) {
          // Remove all old SVG elements
          const existingSvgs = diagramRef.current.querySelectorAll('svg');
          existingSvgs.forEach(svg => svg.remove());

          // Also remove any other children except the error overlay
          Array.from(diagramRef.current.children).forEach(child => {
            if (child !== errorOverlay && child !== tempContainer) {
              child.remove();
            }
          });

          // Create element for the new SVG
          const svgContainer = document.createElement('div');
          svgContainer.innerHTML = svg;

          // Get the SVG element
          const svgElement = svgContainer.querySelector('svg');
          if (svgElement) {
            // Append the new SVG
            diagramRef.current.appendChild(svgElement);
          }

          // Clean up temp container
          tempContainer.remove();

          // Clear any previous error state
          setHasError(false);
          setErrorMessage('');

          // Hide error overlay
          if (errorOverlayRef.current) {
            errorOverlayRef.current.style.display = 'none';
          }
        }
      }).catch(error => {
        // Handle errors
        console.error('Mermaid rendering error:', error);
        setHasError(true);
        setErrorMessage(error ? (error.message || error.toString()) : 'Unknown error');
      });
    } catch (error) {
      console.error('Failed during diagram setup:', error);
      setHasError(true);
      setErrorMessage(error ? (error.message || error.toString()) : 'Unknown error');
    }
  };

  // Effect to re-render diagram when player state changes
  useEffect(() => {
    // If player is not active and we have a diagram reference, make sure diagram is rendered
    if (!isPlayerActive && diagramRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const currentCode = previousCodeRef.current;
        if (currentCode) {
          console.log('Re-rendering diagram after player state change');
          renderDiagram(currentCode);
        }
      }, 200);
    }
  }, [isPlayerActive]);

  return (
    <div className="diagram-renderer" style={{ position: 'relative', height: '100%' }}>
      {!isPlayerActive && (
        <button className="play-button" onClick={togglePlayer} title="Launch fullscreen presentation">
          <FaPlay /> Fullscreen Presentation
        </button>
      )}

      {isPlayerActive ? (
        <DiagramPlayer code={code} onClose={togglePlayer} />
      ) : (
        <div ref={diagramRef} className="diagram-container" style={{ position: 'relative', height: '100%' }} />
      )}
    </div>
  );
};

export default DiagramRenderer;