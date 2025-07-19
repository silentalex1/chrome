const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, 'users.json');
const FILES_DIR = path.join(__dirname, 'user_files');
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR);

app.use(express.static(__dirname));
app.use(express.json());

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function hash(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

const sessions = {};

function makeSession(username) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions[sid] = username;
  return sid;
}

function auth(req, res, next) {
  const sid = req.headers.cookie?.split('sid=')[1];
  if (sid && sessions[sid]) {
    req.username = sessions[sid];
    next();
  } else {
    res.redirect('/');
  }
}

app.post('/register', (req, res) => {
  const {username, password} = req.body;
  if (!username || !password) return res.sendStatus(400);
  const users = loadUsers();
  if (users[username]) return res.sendStatus(409);
  users[username] = {password: hash(password), files: []};
  saveUsers(users);
  const sid = makeSession(username);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const {username, password} = req.body;
  const users = loadUsers();
  if (users[username] && users[username].password === hash(password)) {
    const sid = makeSession(username);
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.post('/logout', (req, res) => {
  const sid = req.headers.cookie?.split('sid=')[1];
  if (sid) delete sessions[sid];
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0');
  res.sendStatus(200);
});

app.get('/filedrop', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'filedrop.html'));
});

app.get('/files', auth, (req, res) => {
  const users = loadUsers();
  const user = users[req.username];
  if (!user) return res.sendStatus(404);
  
  const files = user.files.map(file => ({
    id: file.id,
    name: file.name,
    link: `/files/${req.username}/${file.id}`,
    uploaded: file.uploaded || Date.now(),
    size: file.size || 0
  }));
  
  res.json(files);
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(FILES_DIR, req.username);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = crypto.randomBytes(12).toString('hex');
    cb(null, base + ext);
  }
});
const upload = multer({ storage: storage });

app.post('/upload', auth, upload.single('file'), (req, res) => {
  const users = loadUsers();
  const user = users[req.username];
  const fileId = req.file.filename;
  user.files.push({
    id: fileId, 
    name: req.file.originalname,
    uploaded: Date.now(),
    size: req.file.size
  });
  saveUsers(users);
  const link = `/files/${req.username}/${fileId}`;
  res.json({ link });
});

app.delete('/files/:fileId', auth, (req, res) => {
  const { fileId } = req.params;
  const users = loadUsers();
  const user = users[req.username];
  
  const fileIndex = user.files.findIndex(f => f.id === fileId);
  if (fileIndex === -1) return res.sendStatus(404);
  
  const file = user.files[fileIndex];
  const filePath = path.join(FILES_DIR, req.username, fileId);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    user.files.splice(fileIndex, 1);
    saveUsers(users);
    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

app.use('/files', (req, res, next) => {
  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts.length < 2) return res.sendStatus(404);
  
  const [username, fileId] = pathParts;
  const userDir = path.join(FILES_DIR, username);
  const filePath = path.join(userDir, fileId);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => {
  console.log('xtendify running on http://localhost:' + PORT);
});