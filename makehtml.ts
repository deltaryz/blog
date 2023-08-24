// This script will be run automatically on site update to generate HTML pages for all posts

import fs from 'fs';
import path from 'path';

// relative to current working directory
const mdPath = 'posts/';
const htmlPath = 'p/';

fs.readdir(mdPath, (err, files) => {
  if (err) {
    console.error('Error reading directory:', err);
    return;
  }

  files.forEach((file) => {
    const filePath = path.join(mdPath, file);

    fs.stat(filePath, (statErr, stats) => {
      if (statErr) {
        console.error('Error getting file stats:', statErr);
        return;
      }

      if (stats.isFile()) {
        console.log('File:', filePath);
      }
    });
  });
});
