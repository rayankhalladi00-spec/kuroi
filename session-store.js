const session = require('express-session');
const { db } = require('./db');

const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000; // 30 jours

// Magasin de sessions adossé à la base SQLite du site : pas de dépendance
// native, et les sessions survivent aux redémarrages.
class SqliteSessionStore extends session.Store {
  constructor({ cleanupIntervalMs = 15 * 60 * 1000 } = {}) {
    super();
    this.stmts = {
      get: db.prepare('SELECT data, expires FROM sessions WHERE sid = ?'),
      set: db.prepare(
        `INSERT INTO sessions (sid, expires, data) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET expires = excluded.expires, data = excluded.data`
      ),
      touch: db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?'),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      purge: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
      all: db.prepare('SELECT sid, data FROM sessions WHERE expires > ?'),
      count: db.prepare('SELECT COUNT(*) c FROM sessions WHERE expires > ?'),
      clear: db.prepare('DELETE FROM sessions'),
    };

    this.purge();
    this.timer = setInterval(() => this.purge(), cleanupIntervalMs);
    this.timer.unref?.();
  }

  purge() {
    try {
      this.stmts.purge.run(Date.now());
    } catch (e) {
      console.error('purge sessions:', e.message);
    }
  }

  expiryOf(sess) {
    const ms = sess?.cookie?.originalMaxAge ?? sess?.cookie?.maxAge ?? DEFAULT_TTL;
    return Date.now() + ms;
  }

  get(sid, cb) {
    try {
      const row = this.stmts.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires <= Date.now()) {
        this.stmts.destroy.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (e) {
      cb(e);
    }
  }

  set(sid, sess, cb) {
    try {
      this.stmts.set.run(sid, this.expiryOf(sess), JSON.stringify(sess));
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  touch(sid, sess, cb) {
    try {
      this.stmts.touch.run(this.expiryOf(sess), sid);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  destroy(sid, cb) {
    try {
      this.stmts.destroy.run(sid);
      cb(null);
    } catch (e) {
      cb(e);
    }
  }

  length(cb) {
    try {
      cb(null, this.stmts.count.get(Date.now()).c);
    } catch (e) {
      cb(e);
    }
  }

  all(cb) {
    try {
      cb(null, this.stmts.all.all(Date.now()).map((r) => JSON.parse(r.data)));
    } catch (e) {
      cb(e);
    }
  }

  clear(cb) {
    try {
      this.stmts.clear.run();
      cb(null);
    } catch (e) {
      cb(e);
    }
  }
}

module.exports = SqliteSessionStore;
