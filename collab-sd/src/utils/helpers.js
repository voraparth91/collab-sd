/**
 * Generate a random color for user identification
 * @returns {string} A random HEX color code
 */
export const randomColor = () => {
  // Use a limited palette of distinct, visually pleasing colors
  const colors = [
    '#3498db', // blue
    '#e74c3c', // red
    '#2ecc71', // green
    '#9b59b6', // purple
    '#f1c40f', // yellow
    '#1abc9c', // turquoise
    '#e67e22', // orange
    '#34495e', // navy
    '#7f8c8d', // gray
    '#16a085', // dark green
    '#d35400', // dark orange
    '#2980b9', // dark blue
    '#8e44ad', // dark purple
    '#c0392b', // dark red
  ];
  
  // Pick a random color from the palette
  return colors[Math.floor(Math.random() * colors.length)];
}; 