const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { DATA_DIR } = require('../db');

// Pièces jointes téléchargeables. Pour accepter un type de plus, compléter
// cette liste : le formulaire d'administration s'y adapte tout seul.
const ALLOWED_EXT = ['.torrent', '.zip', '.7z', '.rar'];
const MAX_SIZE = 200 * 1024 * 1024; // 200 Mo

// Affiches. Plafond bien plus bas : une affiche pèse quelques centaines de Ko.
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo

const IMAGE_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
};

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Nom aléatoire sur le disque : le nom d'origine, fourni par le client, ne
  // doit jamais servir de chemin (traversée de répertoire, collisions).
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

function makeUploader(extensions, maxSize) {
  return multer({
    storage,
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!extensions.includes(ext))
        return cb(new Error(`Type de fichier refusé. Extensions acceptées : ${extensions.join(', ')}`));
      cb(null, true);
    },
  });
}

const upload = makeUploader(ALLOWED_EXT, MAX_SIZE);
const uploadImage = makeUploader(IMAGE_EXT, MAX_IMAGE_SIZE);

// Un .torrent est du bencode : il commence toujours par un dictionnaire « d ».
// Vérification légère, pour attraper un fichier renommé par erreur.
function looksLikeTorrent(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, 0);
    return buf.toString('latin1') === 'd';
  } finally {
    fs.closeSync(fd);
  }
}

// Signatures des formats d'image acceptés : on ne se fie pas à l'extension,
// qui est choisie par le client.
function sniffImage(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const b = Buffer.alloc(16);
    fs.readSync(fd, b, 0, 16, 0);
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return 'image/png';
    if (b.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP')
      return 'image/webp';
    if (b.subarray(4, 8).toString('latin1') === 'ftyp' && b.subarray(8, 12).toString('latin1').startsWith('av'))
      return 'image/avif';
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function mimeForImage(name) {
  return IMAGE_MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function removeFile(storedName) {
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, storedName));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('suppression du fichier :', e.message);
  }
}

module.exports = {
  upload,
  uploadImage,
  UPLOAD_DIR,
  ALLOWED_EXT,
  MAX_SIZE,
  IMAGE_EXT,
  MAX_IMAGE_SIZE,
  looksLikeTorrent,
  sniffImage,
  mimeForImage,
  removeFile,
};
