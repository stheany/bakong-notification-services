#!/usr/bin/env node
/**
 * Runtime path resolver - intercepts require() calls and resolves src/ paths
 * This is a workaround for path resolution issues in compiled code
 */

const Module = require('module');
const path = require('path');
const fs = require('fs');

// Store original require
const originalRequire = Module.prototype.require;

// Override require to handle src/ paths
Module.prototype.require = function(id) {
  // If the module ID starts with 'src/', resolve it to the correct dist/ path
  if (id.startsWith('src/')) {
    // Get the calling file's directory
    const callingFile = this.filename || __filename;
    const callingDir = path.dirname(callingFile);
    
    // Convert src/... to dist/... (since dist mirrors src structure)
    const distPath = id.replace(/^src\//, 'dist/');
    
    // Resolve the actual file path
    const resolvedPath = path.resolve(callingDir, distPath);
    
    // Try with .js extension
    let finalPath = resolvedPath + '.js';
    if (!fs.existsSync(finalPath)) {
      // Try without extension
      finalPath = resolvedPath;
      if (!fs.existsSync(finalPath)) {
        // Fall back to original require (will show proper error)
        return originalRequire.call(this, id);
      }
    }
    
    // Use the resolved path
    return originalRequire.call(this, finalPath);
  }
  
  // For all other requires, use original behavior
  return originalRequire.call(this, id);
};

