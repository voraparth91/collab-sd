import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

const DiagramRenderer = ({ code }) => {
  const diagramRef = useRef(null);
  const errorOverlayRef = useRef(null);
  const previousCodeRef = useRef('');
  // State to track if there's a rendering error
  const [hasError, setHasError] = useState(false);
  // State to store error message
  const [errorMessage, setErrorMessage] = useState('');
  
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
    
    try {
      // Create a unique ID for this diagram instance
      const id = `mermaid-${Math.random().toString(36).substring(2)}`;
      
      // Save the error overlay element if it exists
      const errorOverlay = errorOverlayRef.current;
      
      // Don't clear the diagram container yet - wait until we have a successful render
      // We'll create the new diagram in a temporary element first
      const tempContainer = document.createElement('div');
      tempContainer.style.display = 'none';
      tempContainer.className = 'temp-diagram-container';
      
      if (diagramRef.current) {
        diagramRef.current.appendChild(tempContainer);
      }
      
      // Use the async render method to check if the code is valid
      mermaid.render(id, diagramCode).then(({ svg }) => {
        if (diagramRef.current) {
          // Now that we've successfully rendered, we can replace the old diagram
          
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
        // Remove temp container since we won't be using it
        tempContainer.remove();
        
        console.error('Mermaid rendering error:', error);
        // Don't clear the existing diagram, just set error state
        setHasError(true);
        setErrorMessage(error ? (error.message || error.toString()) : 'Unknown error');
      });
    } catch (error) {
      console.error('Failed during diagram setup:', error);
      // Don't clear the existing diagram, just set error state
      setHasError(true);
      setErrorMessage(error ? (error.message || error.toString()) : 'Unknown error');
    }
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
  
  return (
    <div ref={diagramRef} className="diagram-container" style={{ position: 'relative' }} />
  );
};

export default DiagramRenderer; 