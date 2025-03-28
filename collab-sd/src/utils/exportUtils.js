/**
 * Exports the current diagram as a JPEG image
 * @param {string} filename - The name of the file to download
 */
export const exportDiagramAsJPEG = (filename = 'diagram.jpg') => {
  // Find the SVG element in the diagram container
  const svgElement = document.querySelector('.diagram-container svg');
  
  if (!svgElement) {
    console.error('No diagram found to export');
    return;
  }
  
  // Get the dimensions of the SVG
  const svgWidth = svgElement.viewBox.baseVal.width;
  const svgHeight = svgElement.viewBox.baseVal.height;
  
  // Add padding (10% on each side)
  const padding = Math.min(svgWidth, svgHeight) * 0.1;
  const width = svgWidth + (padding * 2);
  const height = svgHeight + (padding * 2);
  
  // Create a canvas element to draw the image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  // Get the canvas context
  const ctx = canvas.getContext('2d');
  
  // Fill with white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Create an image from the SVG
  const img = new Image();
  
  // Create a Blob from the SVG
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  // When the image loads, draw it on the canvas and export
  img.onload = () => {
    // Draw the image on the canvas with padding
    ctx.drawImage(img, padding, padding, svgWidth, svgHeight);
    
    // Convert canvas to JPEG
    const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
    
    // Create a link to download the image
    const link = document.createElement('a');
    link.href = jpegUrl;
    link.download = filename;
    link.click();
    
    // Clean up
    URL.revokeObjectURL(svgUrl);
  };
  
  // Set the source of the image
  img.src = svgUrl;
}; 