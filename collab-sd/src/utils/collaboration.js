import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { v4 as uuidv4 } from 'uuid';

// WebSocket server URL
const WEBSOCKET_SERVER = 'ws://localhost:1234';
console.log('WebSocket server URL:', WEBSOCKET_SERVER);

// Client ID - persistent for the browser session
const CLIENT_ID = localStorage.getItem('collab-sd-clientId') || uuidv4();
// Store the client ID in localStorage
localStorage.setItem('collab-sd-clientId', CLIENT_ID);
console.log('Client ID:', CLIENT_ID);

// Storage for Y.js documents
const docs = new Map();

// Storage for WebSocket providers
const providers = new Map();

// Generate a new UUID for new documents
export const generateUUID = () => uuidv4();

/**
 * Get or create a Y.js document with the given ID
 * @param {string} docId - The document ID
 * @returns {Y.Doc} The Y.js document
 */
export const getYDoc = (docId) => {
  if (!docs.has(docId)) {
    console.log(`Creating new Y.js document: ${docId}`);
    const doc = new Y.Doc();
    docs.set(docId, doc);
    
    // Initialize the text type
    doc.getText('codemirror');
    
    // Listen for updates to track document state
    doc.on('update', (update, origin) => {
      console.log(`Document ${docId} updated`, {
        byteLength: update.byteLength,
        originType: origin ? (typeof origin) : 'null',
        hasOrigin: !!origin
      });
    });
    
    return doc;
  }
  
  return docs.get(docId);
};

/**
 * Create robust WebSocket provider with reliable reconnection
 * @param {string} docId - The document ID
 * @param {Y.Doc} doc - The Y.js document
 * @returns {WebsocketProvider} The WebSocket provider
 */
export const getWebsocketProvider = (docId, doc) => {
  if (!providers.has(docId)) {
    console.log(`Creating new WebSocket provider for document: ${docId}`);
    console.log(`Connecting to ${WEBSOCKET_SERVER}`);
    
    try {
      // Create provider with enhanced options for better reliability
      const provider = new WebsocketProvider(
        WEBSOCKET_SERVER,
        docId,
        doc,
        { 
          connect: true,
          resyncInterval: 3000,      // Shorter resync interval for better consistency
          maxBackoffTime: 5000,      // Maximum reconnection delay
          disableBc: false,          // Enable broadcast channel for same-tab sync
          bcChannel: `collab-sd-${docId}`, // Custom channel name
        }
      );
      
      // Set the client ID on the awareness instance
      provider.awareness.setLocalStateField('clientID', CLIENT_ID);
      
      // Setup maximum reconnection attempts
      let reconnectAttempts = 0;
      const MAX_RECONNECT_ATTEMPTS = 10;
      
      // Enhanced connection status handling
      provider.on('status', event => {
        console.log(`WebSocket connection status for ${docId}:`, event.status);
        
        if (event.status === 'connected') {
          // Reset reconnect attempts when connected
          reconnectAttempts = 0;
          
          try {
            // Add thorough null checks
            if (provider && provider.awareness) {
              const states = provider.awareness.getStates();
              if (states) {
                const keys = Array.from(states.keys());
                console.log('Connected clients:', keys.length);
              } else {
                console.log('Connected clients: No awareness states available');
              }
            } else {
              console.log('Connected clients: Awareness not available');
            }
          } catch (err) {
            console.error('Error accessing awareness states:', err);
            console.log('Connected clients: Error retrieving data');
          }
          
          // Verify sync status after connecting
          try {
            setTimeout(() => {
              if (doc && doc.store && doc.store.pendingStructs) {
                if (doc.store.pendingStructs.length > 0) {
                  console.warn(`Document ${docId} has pending structures after connecting. Forcing sync...`);
                  if (provider) {
                    provider.disconnect();
                    setTimeout(() => provider.connect(), 50);
                  }
                } else {
                  console.log(`Document ${docId} fully synced after connecting.`);
                }
              }
            }, 1000);
          } catch (err) {
            console.error('Error checking document sync status:', err);
          }
        } else if (event.status === 'disconnected') {
          reconnectAttempts++;
          
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            // Implement exponential backoff for reconnection
            const reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            setTimeout(() => {
              if (!provider.wsconnected) {
                console.log(`Attempting to reconnect for ${docId}...`);
                provider.connect();
              }
            }, reconnectDelay);
          } else {
            console.error(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${docId}.`);
          }
        }
      });
      
      // Handle connection close with specific error logging
      if (provider && provider.ws) {
        provider.ws.addEventListener('close', event => {
          console.error(`WebSocket connection closed for ${docId}. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
          
          // Log all connected users at time of disconnect
          try {
            if (provider && provider.awareness) {
              const states = provider.awareness.getStates();
              if (states) {
                console.log('Users at time of disconnect:', Array.from(states.entries()).map(([id, state]) => ({
                  id,
                  user: state && state.user ? state.user : 'No user data'
                })));
              } else {
                console.log('Users at time of disconnect: No states available');
              }
            }
          } catch (err) {
            console.error('Error listing users at disconnect:', err);
          }
        });
        
        // Enhanced error handling
        provider.ws.addEventListener('error', error => {
          console.error(`WebSocket error for ${docId}:`, error);
        });
      } else {
        console.warn(`Provider or WebSocket not available for ${docId}, skipping event listeners`);
      }
      
      // Log sync events for debugging
      if (doc) {
        doc.on('sync', (isSynced) => {
          console.log(`Document ${docId} sync state:`, isSynced ? 'SYNCED' : 'SYNCING');
          
          if (isSynced && doc) {
            try {
              let textLength = 0;
              let hasContent = false;
              
              // Extra defensive coding - only access properties if they exist
              if (typeof doc.getText === 'function') {
                const text = doc.getText('codemirror');
                if (text) {
                  if (typeof text.toString === 'function') {
                    const content = text.toString();
                    if (content !== null && content !== undefined) {
                      textLength = content.length;
                      hasContent = true;
                      console.log('Document content length after sync:', textLength);
                      
                      // Debug log to help detect issues with duplicated content
                      if (textLength > 1000) {
                        console.warn('Document content is unusually large, first 100 chars:',
                          content.substring(0, 100));
                      }
                    }
                  }
                  
                  if (provider) {
                    console.log('Provider connectivity after sync:', 
                      provider.wsconnected ? 'CONNECTED' : 'DISCONNECTED');
                  }
                  
                  // Force update checks on sync completion - with thorough null checking
                  if (textLength === 0 && text && typeof text.isEmpty !== 'undefined' && !text.isEmpty) {
                    console.warn('Document appears empty after sync but is not marked as empty. Forcing resync...');
                    setTimeout(() => {
                      if (provider) {
                        provider.disconnect();
                        setTimeout(() => provider.connect(), 100);
                      }
                    }, 500);
                  }
                } else {
                  console.log('Document text type not found after sync');
                }
              } else {
                console.log('Document does not have getText method');
              }
              
              if (!hasContent) {
                console.log('Could not retrieve document content after sync');
              }
            } catch (err) {
              console.error('Error accessing document text after sync:', err);
            }
          }
        });
      } else {
        console.warn(`Document not available for ${docId}, skipping sync events`);
      }
      
      // Add utility methods to provider for manual connection management
      provider.manualSync = () => {
        console.log(`Manually syncing document ${docId}`);
        try {
          if (provider && typeof provider.disconnect === 'function' && 
              typeof provider.connect === 'function') {
            if (provider.wsconnected) {
              provider.disconnect();
              setTimeout(() => {
                try {
                  provider.connect();
                } catch (err) {
                  console.error('Error reconnecting provider:', err);
                }
              }, 100);
            } else {
              provider.connect();
            }
            
            // After connecting, verify document state
            setTimeout(() => {
              try {
                if (doc && typeof doc.getText === 'function') {
                  const text = doc.getText('codemirror');
                  const content = text && typeof text.toString === 'function' ? text.toString() : '';
                  const textLength = content ? content.length : 0;
                  console.log(`Document ${docId} content length after manual sync: ${textLength}`);
                } else {
                  console.log(`Document ${docId} not available for content check after manual sync`);
                }
              } catch (err) {
                console.error('Error checking document content after manual sync:', err);
              }
            }, 1000);
            
            return true;
          } else {
            console.warn('Provider missing disconnect/connect methods');
            return false;
          }
        } catch (err) {
          console.error('Error during manual sync:', err);
          return false;
        }
      };
      
      providers.set(docId, provider);
    } catch (error) {
      console.error(`Error creating WebSocket provider for ${docId}:`, error);
      
      // Create a fallback provider that will retry connection after a delay
      const retryLater = () => {
        console.log(`Retrying WebSocket connection for ${docId} after error...`);
        setTimeout(() => {
          try {
            providers.delete(docId);
            // Only retry if the document reference is still valid
            if (doc) {
              getWebsocketProvider(docId, doc);
            } else {
              console.warn(`Document reference for ${docId} is no longer valid, not retrying connection`);
            }
          } catch (err) {
            console.error(`Error during retry for ${docId}:`, err);
          }
        }, 5000);
      };
      
      // Return a minimal provider that will be replaced later
      const fallbackProvider = {
        wsconnected: false,
        ws: null,
        connect: () => {
          console.log(`Attempting connection for ${docId} using fallback provider`);
          retryLater();
          return fallbackProvider;
        },
        disconnect: () => { return fallbackProvider; },
        on: (event, callback) => {
          if (event === 'status') {
            try {
              callback({ status: 'disconnected' });
            } catch (err) {
              console.error('Error in status callback:', err);
            }
          }
          return fallbackProvider;
        },
        off: () => fallbackProvider,
        awareness: {
          setLocalStateField: () => {},
          getStates: () => new Map(),
          on: () => {},
          off: () => {}
        },
        manualSync: () => {
          console.log(`Manual sync requested for ${docId} using fallback provider`);
          retryLater();
          return false;
        }
      };
      
      providers.set(docId, fallbackProvider);
      retryLater();
      
      return fallbackProvider;
    }
  }
  
  return providers.get(docId);
};

/**
 * Update the local user info in the awareness protocol
 * @param {string} docId - The document ID
 * @param {object} userInfo - User information to share
 */
export const updateUserInfo = (docId, userInfo) => {
  const provider = providers.get(docId);
  if (!provider) {
    console.warn(`Cannot update user info: provider for ${docId} not found`);
    return;
  }
  
  const awareness = provider.awareness;
  if (!awareness) {
    console.warn(`Cannot update user info: awareness for ${docId} not found`);
    return;
  }
  
  try {
    // Update the local state
    awareness.setLocalStateField('user', {
      ...userInfo,
      clientId: CLIENT_ID, // Always include the client ID
      timestamp: Date.now() // Add timestamp to help with uniqueness
    });
    
    console.log(`Updated user info for ${docId}:`, userInfo);
    console.log('Connected users:', Array.from(awareness.getStates().keys()).length);
  } catch (error) {
    console.error(`Error updating user info for ${docId}:`, error);
  }
};

/**
 * Clean up resources for a document
 * @param {string} docId - The document ID
 */
export const cleanupDocument = (docId) => {
  // Get provider and document
  const provider = providers.get(docId);
  const doc = docs.get(docId);
  
  // Disconnect provider if it exists
  if (provider) {
    try {
      provider.disconnect();
      providers.delete(docId);
      console.log(`WebSocket provider for ${docId} disconnected and removed`);
    } catch (error) {
      console.error(`Error disconnecting provider for ${docId}:`, error);
    }
  }
  
  // Clean up document if it exists
  if (doc) {
    try {
      doc.destroy();
      docs.delete(docId);
      console.log(`Y.js document ${docId} destroyed and removed`);
    } catch (error) {
      console.error(`Error destroying document ${docId}:`, error);
    }
  }
}; 