const multer = require('multer');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Transform, pipeline } = require('node:stream');
const { validateMetadata, validSignature, containsPhp, uploadError } = require('../services/uploadSecurity');
const uploadsRoot = path.resolve(__dirname, '../uploads');

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function diskStorage(options = {}) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const done = async (error, destination) => {
        if (error) return cb(error);
        try {
          const target = path.resolve(destination || uploadsRoot);
          if (!inside(uploadsRoot, target)) throw uploadError('ตำแหน่งจัดเก็บไฟล์ไม่ถูกต้อง');
          await fsp.mkdir(target, { recursive: true });
          const [realRoot, realTarget] = await Promise.all([fsp.realpath(uploadsRoot), fsp.realpath(target)]);
          if (!inside(realRoot, realTarget)) throw uploadError('ตำแหน่งจัดเก็บไฟล์ไม่ถูกต้อง');
          cb(null, realTarget);
        } catch (err) { cb(err); }
      };
      if (typeof options.destination === 'function') return options.destination(req, file, done);
      done(null, options.destination || uploadsRoot);
    },
    // Never put request fields or a client filename into the stored path.
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
  });
}

function quarantinedStorage(storage) {
  return {
    async _handleFile(req, file, cb) {
      let temporary;
      const interrupted = () => file.stream.destroy(uploadError('การอัปโหลดถูกยกเลิก'));
      req.once('aborted', interrupted);
      try {
        temporary = await fsp.mkdtemp(path.join(os.tmpdir(), 'coopchain-upload-'));
        if (req.aborted) throw uploadError('การอัปโหลดถูกยกเลิก');
        const staged = path.join(temporary, 'content');
        const ext = validateMetadata(file);
        let prefix = Buffer.alloc(0);
        let tail = Buffer.alloc(0);
        const inspect = new Transform({
          transform(chunk, encoding, done) {
            if (prefix.length < 512) prefix = Buffer.concat([prefix, chunk.subarray(0, 512 - prefix.length)]);
            const scan = Buffer.concat([tail, chunk]);
            if (containsPhp(scan)) return done(uploadError('ไม่อนุญาตไฟล์ที่มีโค้ด PHP'));
            if (['.txt', '.csv'].includes(ext) && chunk.includes(0)) return done(uploadError('เนื้อหาไฟล์ไม่ใช่ข้อความ'));
            tail = scan.subarray(-16);
            done(null, chunk);
          },
          flush(done) {
            if (!validSignature(ext, prefix)) return done(uploadError('เนื้อหาไฟล์ไม่ตรงกับชนิดที่ระบุ'));
            done();
          }
        });
        await new Promise((resolve, reject) => pipeline(file.stream, inspect, fs.createWriteStream(staged, { flags: 'wx', mode: 0o600 }), err => err ? reject(err) : resolve()));
        if (file.stream.truncated) throw new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
        // Nothing is written to a web-accessible destination until inspection succeeds.
        const replay = fs.createReadStream(staged);
        const info = await new Promise((resolve, reject) => {
          replay.on('error', reject);
          storage._handleFile(req, { ...file, stream: replay }, (err, value) => err ? reject(err) : resolve(value));
        });
        await fsp.rm(temporary, { recursive: true, force: true });
        cb(null, info);
      } catch (error) {
        if (temporary) await fsp.rm(temporary, { recursive: true, force: true }).catch(() => {});
        cb(error);
      } finally {
        req.removeListener('aborted', interrupted);
      }
    },
    _removeFile(req, file, cb) {
      if (!file.path && !file.buffer) return cb(null);
      storage._removeFile(req, file, cb);
    }
  };
}

function secureUpload(options = {}) {
  const storage = options.storage || (options.dest ? diskStorage({ destination: options.dest }) : multer.memoryStorage());
  const upload = multer({
    ...options,
    preservePath: true,
    storage: quarantinedStorage(storage),
    limits: { fileSize: 20 * 1024 * 1024, files: 20, fields: 100, parts: 150, ...options.limits },
    fileFilter(req, file, cb) {
      try { validateMetadata(file); } catch (err) { return cb(err); }
      if (options.fileFilter) return options.fileFilter(req, file, cb);
      cb(null, true);
    }
  });
  for (const method of ['single', 'array', 'fields', 'any', 'none']) {
    const create = upload[method].bind(upload);
    upload[method] = (...args) => {
      const receive = create(...args);
      return (req, res, next) => {
        const randomNames = /^\/random-names(?:\/|$)/.test(req.originalUrl || '')
          && (req.session?.randomNamesAccessAuthed || req.session?.randomNamesAdminAuthed);
        if (!req.session?.user && !randomNames) {
          return res.status(401).send('กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์');
        }
        receive(req, res, next);
      };
    };
  }
  return upload;
}

secureUpload.fileFilter = extensions => (req, file, cb) => {
  try { validateMetadata(file, extensions); cb(null, true); }
  catch (err) { cb(err); }
};
secureUpload.diskStorage = diskStorage;
secureUpload.memoryStorage = multer.memoryStorage;
secureUpload.MulterError = multer.MulterError;
module.exports = secureUpload;
