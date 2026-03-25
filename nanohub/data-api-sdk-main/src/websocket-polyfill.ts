/**
 * WebSocket polyfill for Node.js environments
 */

declare global {
    interface Window {
      WebSocket: typeof WebSocket;
    }
  }
  
  // Check if we're in a browser or Node.js environment
  const isBrowser = typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined';
  
  if (!isBrowser) {
    try {
      // Try to load the ws package
      const WebSocketImpl = require('ws');
      
      // Create a global WebSocket variable that matches the browser API
      if (typeof global !== 'undefined' && !global.WebSocket) {
        // @ts-ignore - Adding WebSocket to global
        global.WebSocket = WebSocketImpl;
      }
    } catch (e) {
      console.warn(
        'WebSocket implementation not found. If you are using Node.js, please install the "ws" package: npm install ws'
      );
    }
  }
  
  export {};