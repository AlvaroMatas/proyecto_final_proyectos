const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_DIR = path.join(__dirname);
const DB_FILE = path.join(DB_DIR, 'users.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_FILE);

function run(sql, params=[]) {
  return new Promise((resolve, reject)=> {
    db.run(sql, params, function(err){ if(err) reject(err); else resolve(this); });
  });
}

function get(sql, params=[]) {
  return new Promise((resolve, reject)=> {
    db.get(sql, params, (err, row)=> { if(err) reject(err); else resolve(row); });
  });
}

function all(sql, params=[]) {
  return new Promise((resolve, reject)=> {
    db.all(sql, params, (err, rows)=> { if(err) reject(err); else resolve(rows); });
  });
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ensure default admin exists (username: admin, password: Admin1)
  const admin = await get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!admin) {
    const hash = await bcrypt.hash('Admin1', 10);
    await run('INSERT INTO users (username, name, password_hash, role) VALUES (?,?,?,?)', ['admin', 'Administrador', hash, 'admin']);
    console.log('Admin user created: username=admin password=Admin1');
  }
}

async function createUser({ username, name, password, role='user' }) {
  const hash = await bcrypt.hash(password, 10);
  try {
    const res = await run('INSERT INTO users (username, name, password_hash, role) VALUES (?,?,?,?)', [username, name||'', hash, role]);
    return { id: res.lastID, username, name: name||'', role };
  } catch (e) {
    // bubble up
    throw e;
  }
}

async function findUserByUsername(username) {
  return await get('SELECT * FROM users WHERE username = ?', [username]);
}

async function getAllUsers() {
  return await all('SELECT id, username, name, role, created_at FROM users ORDER BY id DESC');
}

module.exports = { init, createUser, findUserByUsername, getAllUsers, db };
