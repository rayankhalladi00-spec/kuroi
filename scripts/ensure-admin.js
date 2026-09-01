const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, audit, DATA_DIR } = require('../db');

// Crée le compte administrateur au tout premier démarrage s'il n'en existe aucun.
// Le mot de passe vient de .env, sinon il est généré et écrit dans
// data/ADMIN_CREDENTIALS.txt (à supprimer une fois noté).
module.exports = function ensureAdmin() {
  const existing = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
  if (existing > 0) return null;

  const username = process.env.ADMIN_USERNAME || 'rayan';
  const email = process.env.ADMIN_EMAIL || 'rayan.khalladi@icloud.com';
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

  const info = db
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(username, email, bcrypt.hashSync(password, 12));
  audit(null, 'bootstrap_admin', `user#${info.lastInsertRowid}`, username);

  const file = path.join(DATA_DIR, 'ADMIN_CREDENTIALS.txt');
  fs.writeFileSync(
    file,
    `Compte administrateur Kuroi\n` +
      `Pseudo        : ${username}\n` +
      `E-mail        : ${email}\n` +
      `Mot de passe  : ${password}\n\n` +
      `Change ce mot de passe depuis /admin, puis supprime ce fichier.\n`,
    { mode: 0o600 }
  );

  console.log('\n=========================================');
  console.log('  COMPTE ADMINISTRATEUR CRÉÉ');
  console.log(`  Pseudo       : ${username}`);
  console.log(`  E-mail       : ${email}`);
  console.log(`  Mot de passe : ${password}`);
  console.log(`  (copié dans ${file})`);
  console.log('=========================================\n');

  return { username, email, password };
};
