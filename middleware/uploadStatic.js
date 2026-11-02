const express = require('express');
const path = require('node:path');
const contentDisposition = require('content-disposition');
const { TYPES, safeFilename } = require('../services/uploadSecurity');

// Use the same validation for legacy files: URL encoding must not bypass the check.
function allowedUploadPath(raw) {
  try {
    let decoded = decodeURIComponent(raw);
    if (decoded.includes('%') || decoded.includes('\\') || decoded.includes('\0')) return false;
    const segments = decoded.split('/').filter(Boolean);
    if (!segments.length || segments.some(segment => !safeFilename(segment))) return false;
    return !!TYPES[path.extname(segments.at(-1)).toLowerCase()] || path.extname(segments.at(-1)).toLowerCase() === '.json';
  } catch (_) { return false; }
}

function uploadStatic(root) {
  const serve = express.static(root, {
    dotfiles: 'deny', index: false, redirect: false,
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; frame-ancestors 'self'");
      const inline = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm', '.json'].includes(ext);
      if (!inline) res.setHeader('Content-Disposition', contentDisposition(path.basename(filePath), { type: 'attachment' }));
    }
  });
  return (req, res, next) => {
    if (!allowedUploadPath(req.path)) return res.status(404).end();
    serve(req, res, next);
  };
}
module.exports = { uploadStatic, allowedUploadPath };
