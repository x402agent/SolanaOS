// Add TypeScript declarations for global objects
declare global {
  interface Window {
    fs: any;
  }
  interface Global {
    ReadableStream: any;
    WritableStream: any;
    TransformStream: any;
  }
  // Add EventEmitter to Process interface
  interface Process {
    EventEmitter?: any;
  }
}

// Polyfill for structuredClone
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = function structuredClone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Polyfill ReadableStream and WritableStream for AI SDK
if (typeof global.ReadableStream === 'undefined') {
  // Simple stub implementations that will allow the code to run
  class MockReadableStream {
    constructor(source?: any) {
      // Minimal implementation
    }
    
    getReader() {
      return {
        read: async () => ({ done: true, value: undefined }),
        releaseLock: () => {},
        cancel: async () => {},
      };
    }
  }
  
  class MockWritableStream {
    constructor(sink?: any) {
      // Minimal implementation
    }
    
    getWriter() {
      return {
        write: async () => {},
        close: async () => {},
        abort: async () => {},
        releaseLock: () => {},
      };
    }
  }
  
  class MockTransformStream {
    constructor(transformer?: any) {
      this.readable = new MockReadableStream();
      this.writable = new MockWritableStream();
    }
    
    readable: typeof MockReadableStream.prototype;
    writable: typeof MockWritableStream.prototype;
  }
  
  // Assign to global
  (global as any).ReadableStream = MockReadableStream;
  (global as any).WritableStream = MockWritableStream;
  (global as any).TransformStream = MockTransformStream;
  
  console.log('Polyfilled ReadableStream and WritableStream for AI SDK compatibility');
}

// Ensure TextEncoder and TextDecoder are available
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  console.log('Polyfilled TextEncoder and TextDecoder');
}

// Buffer polyfill with fixes for Anchor and readUIntLE methods
import { Buffer } from "buffer";
global.Buffer = Buffer;

// Fix for Buffer.subarray to properly maintain prototype chain for methods like readUIntLE
Buffer.prototype.subarray = function subarray(
  begin: number | undefined,
  end: number | undefined
) {
  const result = Uint8Array.prototype.subarray.apply(this, [begin, end]);
  Object.setPrototypeOf(result, Buffer.prototype); // Explicitly add the Buffer prototype (adds readUIntLE!)
  return result as unknown as Buffer; // Cast through unknown to Buffer to satisfy TypeScript
};

// Add EventEmitter polyfill
// Ensure global.process exists before attempting to attach EventEmitter
if (typeof global.process === 'undefined') {
  console.warn('[Polyfills] global.process is undefined, attempting to initialize.');
  global.process = require('process'); // Ensure process is polyfilled
  if (typeof global.process.env === 'undefined') {
    // Check if __DEV__ exists before using it
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    global.process.env = { NODE_ENV: isDev ? 'development' : 'production' } as any;
  }
   if (typeof global.process.nextTick === 'undefined') {
    global.process.nextTick = setImmediate;
  }
}

// Now, safely attach EventEmitter
if (typeof global.process.EventEmitter === 'undefined') {
  const EventEmitter = require('events');
  global.process.EventEmitter = EventEmitter;
  console.log('Polyfilled process.EventEmitter');
} else {
  console.log('process.EventEmitter already exists.');
}

// Mock fs module for React Native environment
const mockFs = {
  readFileSync: () => {
    throw new Error('fs.readFileSync is not supported in React Native');
  },
  writeFileSync: () => {
    throw new Error('fs.writeFileSync is not supported in React Native');
  },
  promises: {
    readFile: async () => {
      throw new Error('fs.promises.readFile is not supported in React Native');
    },
    writeFile: async () => {
      throw new Error('fs.promises.writeFile is not supported in React Native');
    },
  },
};

// Assign to global
(global as any).fs = mockFs;

// Export the polyfill functions for explicit importing where needed
export function ensureBuffer() {
  // This is now handled by the global Buffer check above
  return global.Buffer !== undefined;
}

export {};
