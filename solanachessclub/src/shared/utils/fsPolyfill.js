// This is a mock implementation of the Node.js 'fs' module for React Native
// It's specifically designed to handle @coral-xyz/anchor's needs

module.exports = {
  readFileSync: function(path, options) {
    console.warn(`fs.readFileSync called with path: ${path} - not supported in React Native`);
    // Return an empty buffer to avoid crashes
    return Buffer.from([]);
  },
  writeFileSync: function(path, data, options) {
    console.warn(`fs.writeFileSync called with path: ${path} - not supported in React Native`);
    // Do nothing
  },
  existsSync: function(path) {
    console.warn(`fs.existsSync called with path: ${path} - not supported in React Native`);
    return false;
  },
  promises: {
    readFile: async function(path, options) {
      console.warn(`fs.promises.readFile called with path: ${path} - not supported in React Native`);
      return Buffer.from([]);
    },
    writeFile: async function(path, data, options) {
      console.warn(`fs.promises.writeFile called with path: ${path} - not supported in React Native`);
      // Do nothing
    }
  }
}; 