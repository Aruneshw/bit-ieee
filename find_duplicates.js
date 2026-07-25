const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = process.cwd();
const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'scratch', 'public'];

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        getFiles(fullPath, files);
      }
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getFiles(rootDir);
const hashes = {};
const duplicates = [];

for (const file of allFiles) {
  // Skip files smaller than 50 bytes to avoid false positives on empty/tiny files
  if (fs.statSync(file).size < 50) continue;
  
  const content = fs.readFileSync(file);
  const hash = crypto.createHash('md5').update(content).digest('hex');
  
  if (hashes[hash]) {
    duplicates.push({ original: hashes[hash], duplicate: file });
  } else {
    hashes[hash] = file;
  }
}

console.log(JSON.stringify(duplicates, null, 2));
