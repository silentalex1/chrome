class FileManager {
  constructor() {
    this.currentFiles = [];
    this.currentUser = null;
  }

  generateRandomId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  generatePublishLink() {
    const randomId = this.generateRandomId();
    return `xtendify.wtf/xtendify_${randomId}`;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(new Date(date));
  }

  loadFiles() {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[this.currentUser];
    if (user && user.files) {
      this.currentFiles = user.files;
    } else {
      this.currentFiles = [];
    }
    return this.currentFiles;
  }

  saveFiles() {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (!users[this.currentUser]) {
      users[this.currentUser] = { files: [] };
    }
    users[this.currentUser].files = this.currentFiles;
    localStorage.setItem('users', JSON.stringify(users));
  }

  addFile(fileData) {
    this.currentFiles.push(fileData);
    this.saveFiles();
  }

  removeFile(fileId) {
    const index = this.currentFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      this.currentFiles.splice(index, 1);
      this.saveFiles();
      return true;
    }
    return false;
  }

  getFile(fileId) {
    return this.currentFiles.find(f => f.id === fileId);
  }

  updateFileDownloads(fileId) {
    const file = this.getFile(fileId);
    if (file) {
      file.downloads = (file.downloads || 0) + 1;
      this.saveFiles();
    }
  }

  createFileData(file, fileId) {
    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      uploaded: Date.now(),
      downloads: 0,
      data: null
    };
  }
}

class UserManager {
  constructor() {
    this.currentUser = null;
  }

  hashPassword(password) {
    return btoa(password).split('').reverse().join('');
  }

  createUser(username, password) {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[username]) {
      return { success: false, error: 'Username already exists' };
    }
    
    users[username] = {
      password: this.hashPassword(password),
      files: [],
      created: Date.now(),
      lastLogin: null
    };
    
    localStorage.setItem('users', JSON.stringify(users));
    return { success: true, user: users[username] };
  }

  authenticateUser(username, password) {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[username];
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    if (user.password !== this.hashPassword(password)) {
      return { success: false, error: 'Invalid password' };
    }
    
    user.lastLogin = Date.now();
    users[username] = user;
    localStorage.setItem('users', JSON.stringify(users));
    return { success: true, user };
  }

  createSession(username) {
    const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const sessions = JSON.parse(localStorage.getItem('sessions') || '{}');
    sessions[sessionId] = {
      username,
      created: Date.now(),
      lastActivity: Date.now()
    };
    localStorage.setItem('sessions', JSON.stringify(sessions));
    return sessionId;
  }

  validateSession(sessionId) {
    const sessions = JSON.parse(localStorage.getItem('sessions') || '{}');
    const session = sessions[sessionId];
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }
    
    const now = Date.now();
    const sessionAge = now - session.created;
    const lastActivity = now - session.lastActivity;
    
    if (sessionAge > 24 * 60 * 60 * 1000) {
      delete sessions[sessionId];
      localStorage.setItem('sessions', JSON.stringify(sessions));
      return { valid: false, error: 'Session expired' };
    }
    
    if (lastActivity > 60 * 60 * 1000) {
      delete sessions[sessionId];
      localStorage.setItem('sessions', JSON.stringify(sessions));
      return { valid: false, error: 'Session inactive' };
    }
    
    session.lastActivity = now;
    sessions[sessionId] = session;
    localStorage.setItem('sessions', JSON.stringify(sessions));
    return { valid: true, username: session.username };
  }

  destroySession(sessionId) {
    const sessions = JSON.parse(localStorage.getItem('sessions') || '{}');
    if (sessions[sessionId]) {
      delete sessions[sessionId];
      localStorage.setItem('sessions', JSON.stringify(sessions));
      return true;
    }
    return false;
  }

  getCurrentUser() {
    const sessionId = localStorage.getItem('currentSession');
    if (sessionId) {
      const result = this.validateSession(sessionId);
      if (result.valid) {
        this.currentUser = result.username;
        return result.username;
      }
    }
    return null;
  }

  logout() {
    const sessionId = localStorage.getItem('currentSession');
    if (sessionId) {
      this.destroySession(sessionId);
    }
    localStorage.removeItem('currentSession');
    this.currentUser = null;
  }
}

class NotificationManager {
  constructor() {
    this.notification = document.getElementById('notification');
  }

  show(message, type = 'info') {
    this.notification.textContent = message;
    this.notification.className = `notification ${type}`;
    this.notification.style.display = 'block';
    setTimeout(() => {
      this.notification.style.display = 'none';
    }, 4000);
  }
}

window.FileManager = FileManager;
window.UserManager = UserManager;
window.NotificationManager = NotificationManager; 