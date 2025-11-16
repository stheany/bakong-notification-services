#!/usr/bin/env node
/**
 * Post-build script to fix unresolved src/ paths in compiled JavaScript
 * This replaces all require('src/...') with relative paths
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

function fixPathsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace require('src/...') and require("src/...") with relative paths
  const srcPathRegex = /require\(['"](src\/[^'"]+)['"]\)/g;
  
  content = content.replace(srcPathRegex, (match, srcPath) => {
    // Calculate relative path from current file to the target
    const currentDir = path.dirname(filePath);
    const targetPath = path.join(__dirname, srcPath);
    const relativePath = path.relative(currentDir, targetPath);
    
    // Normalize path separators and ensure it starts with ./
    let relative = relativePath.replace(/\\/g, '/');
    if (!relative.startsWith('.')) {
      relative = './' + relative;
    }
    
    modified = true;
    return `require('${relative}')`;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed paths in: ${path.relative(distDir, filePath)}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js')) {
      fixPathsInFile(filePath);
    }
  }
}

console.log('Fixing src/ paths in dist/...');
walkDir(distDir);
console.log('Done!');

