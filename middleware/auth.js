const { db } = require('../db');

// Recharge l'utilisateur depuis la base à chaque requête :
// un ban ou un changement de rôle prend effet immédiatement, sans re-login.
function loadUser(req, res, next) {
  req.user = null;
  if (req.session?.userId) {
    const u = db
      .prepare('SELECT id, username, email, role, banned, ban_reason, avatar FROM users WHERE id = ?')
      .get(req.session.userId);
    if (!u) {
      req.session.destroy(() => {});
    } else if (u.banned) {
      req.bannedUser = u;
      req.session.destroy(() => {});
    } else {
      req.user = u;
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (req.bannedUser) {
    return res.status(403).json({
      error: 'Compte banni',
      reason: req.bannedUser.ban_reason || null,
    });
  }
  if (!req.user) return res.status(401).json({ error: 'Connexion requise' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Connexion requise' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis' });
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin };
