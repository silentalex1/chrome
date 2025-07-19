const crypto = require('crypto');

class UserManager {
  constructor() {
    this.users = {};
    this.sessions = {};
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  createUser(username, password) {
    if (this.users[username]) {
      return { success: false, error: 'Username already exists' };
    }
    
    this.users[username] = {
      password: this.hashPassword(password),
      files: [],
      created: Date.now(),
      lastLogin: null
    };
    
    return { success: true, user: this.users[username] };
  }

  authenticateUser(username, password) {
    const user = this.users[username];
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    if (user.password !== this.hashPassword(password)) {
      return { success: false, error: 'Invalid password' };
    }
    
    user.lastLogin = Date.now();
    return { success: true, user };
  }

  createSession(username) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    this.sessions[sessionId] = {
      username,
      created: Date.now(),
      lastActivity: Date.now()
    };
    return sessionId;
  }

  validateSession(sessionId) {
    const session = this.sessions[sessionId];
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }
    
    const now = Date.now();
    const sessionAge = now - session.created;
    const lastActivity = now - session.lastActivity;
    
    if (sessionAge > 24 * 60 * 60 * 1000) {
      delete this.sessions[sessionId];
      return { valid: false, error: 'Session expired' };
    }
    
    if (lastActivity > 60 * 60 * 1000) {
      delete this.sessions[sessionId];
      return { valid: false, error: 'Session inactive' };
    }
    
    session.lastActivity = now;
    return { valid: true, username: session.username };
  }

  destroySession(sessionId) {
    if (this.sessions[sessionId]) {
      delete this.sessions[sessionId];
      return true;
    }
    return false;
  }

  getUser(username) {
    return this.users[username] || null;
  }

  updateUser(username, updates) {
    if (!this.users[username]) {
      return false;
    }
    
    Object.assign(this.users[username], updates);
    return true;
  }

  deleteUser(username) {
    if (this.users[username]) {
      delete this.users[username];
      return true;
    }
    return false;
  }

  getAllUsers() {
    return Object.keys(this.users).map(username => ({
      username,
      created: this.users[username].created,
      lastLogin: this.users[username].lastLogin,
      fileCount: this.users[username].files.length
    }));
  }

  getUserStats(username) {
    const user = this.users[username];
    if (!user) return null;
    
    return {
      username,
      created: user.created,
      lastLogin: user.lastLogin,
      fileCount: user.files.length,
      totalStorage: user.files.reduce((total, fileId) => {
        return total + (global.files && global.files[fileId] ? global.files[fileId].size : 0);
      }, 0)
    };
  }

  cleanupSessions() {
    const now = Date.now();
    const expiredSessions = [];
    
    for (const [sessionId, session] of Object.entries(this.sessions)) {
      const sessionAge = now - session.created;
      const lastActivity = now - session.lastActivity;
      
      if (sessionAge > 24 * 60 * 60 * 1000 || lastActivity > 60 * 60 * 1000) {
        expiredSessions.push(sessionId);
      }
    }
    
    expiredSessions.forEach(sessionId => {
      delete this.sessions[sessionId];
    });
    
    return expiredSessions.length;
  }
}

module.exports = UserManager;
