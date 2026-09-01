// Réinitialise (ou crée) le compte administrateur en ligne de commande.
//   node scripts/seed-admin.js                 -> mot de passe aléatoire
//   node scripts/seed-admin.js monMotDePasse   -> mot de passe imposé
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, audit } = require('../db');

const username = process.env.ADMIN_USERNAME || 'rayan';
const email = process.env.ADMIN_EMAIL || 'rayan.khalladi@icloud.com';
const password = process.argv[2] || crypto.randomBytes(12).toString('base64url');
const hash = bcrypt.hashSync(password, 12);

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare("UPDATE users SET password_hash = ?, role = 'admin', banned = 0 WHERE id = ?").run(
    hash,
    existing.id
  );
  audit(null, 'cli_reset_admin', `user#${existing.id}`, username);
  console.log(`Mot de passe réinitialisé pour "${username}".`);
} else {
  const info = db
    .prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run(username, email, hash);
  audit(null, 'cli_create_admin', `user#${info.lastInsertRowid}`, username);
  console.log(`Administrateur "${username}" créé.`);
}

console.log(`E-mail       : ${email}`);
console.log(`Mot de passe : ${password}`);
