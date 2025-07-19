const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const UserManager = require('./script.js');

const app = express();
const PORT = 3000;

app.use(express.static(__dirname));
app.use(express.json());

const userManager = new UserManager();
const files = {};

global.files = files;

function auth(req, res, next) {
  const sid = req.headers.cookie?.split('sid=')[1];
  if (sid) {
    const sessionResult = userManager.validateSession(sid);
    if (sessionResult.valid) {
      req.username = sessionResult.username;
      next();
    } else {
      res.redirect('/');
    }
  } else {
    res.redirect('/');
  }
}

app.post('/register', (req, res) => {
  const {username, password} = req.body;
  if (!username || !password) return res.sendStatus(400);
  
  const result = userManager.createUser(username, password);
  if (!result.success) return res.sendStatus(409);
  
  const sid = userManager.createSession(username);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  res.sendStatus(200);
});

app.post('/login', (req, res) => {
  const {username, password} = req.body;
  
  const result = userManager.authenticateUser(username, password);
  if (!result.success) return res.sendStatus(401);
  
  const sid = userManager.createSession(username);
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  res.sendStatus(200);
});

app.post('/logout', (req, res) => {
  const sid = req.headers.cookie?.split('sid=')[1];
  if (sid) userManager.destroySession(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; Max-Age=0');
  res.sendStatus(200);
});

app.get('/filedrop', auth, (req, res) => {
  res.sendFile(path.join(__dirname, 'filedrop.html'));
});

app.get('/files', auth, (req, res) => {
  const user = userManager.getUser(req.username);
  if (!user) return res.sendStatus(404);
  
  const userFiles = user.files.map(fileId => {
    const file = files[fileId];
    return {
      id: fileId,
      name: file.name,
      link: `/files/${req.username}/${fileId}`,
      uploaded: file.uploaded,
      size: file.size,
      downloads: file.downloads || 0,
      mimeType: file.mimeType,
      md5: file.md5
    };
  });
  
  res.json(userFiles);
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', auth, upload.single('file'), (req, res) => {
  const fileId = crypto.randomBytes(12).toString('hex');
  const user = userManager.getUser(req.username);
  
  files[fileId] = {
    name: req.file.originalname,
    data: req.file.buffer,
    uploaded: Date.now(),
    size: req.file.size,
    mimeType: req.file.mimetype,
    downloads: 0,
    md5: crypto.createHash('md5').update(req.file.buffer).digest('hex')
  };
  
  user.files.push(fileId);
  const link = `/files/${req.username}/${fileId}`;
  res.json({ link });
});

app.delete('/files/:fileId', auth, (req, res) => {
  const { fileId } = req.params;
  const user = userManager.getUser(req.username);
  
  const fileIndex = user.files.indexOf(fileId);
  if (fileIndex === -1) return res.sendStatus(404);
  
  delete files[fileId];
  user.files.splice(fileIndex, 1);
  res.sendStatus(200);
});

app.use('/files', (req, res, next) => {
  const pathParts = req.path.split('/').filter(Boolean);
  if (pathParts.length < 2) return res.sendStatus(404);
  
  const [username, fileId] = pathParts;
  const file = files[fileId];
  
  if (file) {
    files[fileId].downloads = (files[fileId].downloads || 0) + 1;
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.send(file.data);
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => {
  console.log('xtendify running on http://localhost:' + PORT);
});