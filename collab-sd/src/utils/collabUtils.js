import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a new UUID for collaboration sessions
 * @returns {string} A new UUID
 */
export const generateUUID = () => {
  return uuidv4();
};

/**
 * @deprecated Use React Router's useParams() hook instead
 * Gets the collaboration ID from the URL path or generates a new one
 * @returns {{ id: string, isNew: boolean }} The collaboration ID and whether it's newly generated
 */
export const getCollaborationId = () => {
  // Get the current URL path
  const path = window.location.pathname;
  
  // Check if there's an ID in the path (excluding the leading slash)
  if (path.length > 1) {
    // Extract the ID from the path (removing the leading slash)
    const id = path.substring(1);
    return { id, isNew: false };
  } else {
    // Generate a new UUID if none exists in the path
    const newId = generateUUID();
    return { id: newId, isNew: true };
  }
};

/**
 * @deprecated Use React Router's navigate() hook instead
 * Redirects to the page with the given ID as a path parameter
 * @param {string} id - The collaboration ID to redirect to
 */
export const redirectToCollabSession = (id) => {
  // Create URL with the ID as the path
  const baseUrl = `${window.location.origin}/${id}`;
  
  // Use history API to update URL without full page reload
  window.history.pushState({}, '', baseUrl);
  
  // Log that we've redirected to a new session
  console.log(`Redirected to collaboration session: ${id}`);
}; 