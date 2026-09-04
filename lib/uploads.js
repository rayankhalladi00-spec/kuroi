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

// Les photos de profil ne vivent pas dans data/uploads mais dans le dossier
// servi en statique : elles sont publiques par nature et doivent etre lisibles
// sans session, y compris sur la page de connexion.
// Les envois vont dans data/, seul dossier ou le service a le droit d'ecrire
// (ProtectSystem=strict, ReadWritePaths=/opt/kuroi/data). Ecrire dans public/
// echouait avec EROFS. Les photos livrees avec le code restent, elles, dans
// public/img/avatars/ et sont servies en statique.
const AVATAR_DIR = path.join(DATA_DIR, 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 Mo : une photo de profil est petite

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomBytes(8).toString('hex') + ext);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: MAX_AVATAR_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Pas de SVG televerse : un SVG peut porter du script, et il serait servi
    // depuis notre propre domaine.
    if (!['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'].includes(ext))
      return cb(new Error('Formats acceptés : png, jpg, webp, avif, gif.'));
    cb(null, true);
  },
});

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
  uploadAvatar,
  AVATAR_DIR,
  MAX_AVATAR_SIZE,
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
