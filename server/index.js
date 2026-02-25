const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { init, createUser, findUserByUsername, getAllUsers } = require('./db');

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_prod';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// init DB and default admin
init().catch(err => {
  console.error('DB init error', err);
  process.exit(1);
});

// Health
app.get('/api/health', (req,res) => res.json({ ok: true }));

// Register
app.post('/api/register', async (req,res) => {
  try {
    const { username, name, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const existing = await findUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'username_taken' });
    const user = await createUser({ username, name, password });
    // return basic user info (no password)
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (e) {
    console.error('register', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Login -> returns JWT + user
app.post('/api/login', async (req,res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const payload = { id: user.id, username: user.username, role: user.role, name: user.name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: payload });
  } catch (e) {
    console.error('login', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Middleware to protect routes
function authMiddleware(req,res,next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });
  const token = auth.slice(7);
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; next();
  } catch (e) { return res.status(401).json({ error: 'invalid_token' }); }
}

// List users (admin only)
app.get('/api/users', authMiddleware, async (req,res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (e) { res.status(500).json({ error: 'server_error' }); }
});

app.listen(PORT, () => {
  console.log(`Auth server listening on http://localhost:${PORT}`);
});
