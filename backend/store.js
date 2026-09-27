import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial database schema
const defaultDb = {
  ca_config: null,
  certificates: [],
  key_directory: [],
  signed_documents: [],
  b2b_messages: [],
  audit_logs: []
};

export class JsonStore {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    }
  }

  read() {
    try {
      if (!fs.existsSync(DB_FILE)) {
        this.init();
      }
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading JSON store:', err);
      return defaultDb;
    }
  }

  write(data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Error writing to JSON store:', err);
      return false;
    }
  }

  // Helper audit logger
  logAudit(action, actor, details, status = 'SUCCESS') {
    const db = this.read();
    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      action,
      actor: actor || 'System / Admin',
      details,
      status,
      timestamp: new Date().toISOString()
    };
    db.audit_logs.unshift(logEntry);
    // keep max 500 logs
    if (db.audit_logs.length > 500) {
      db.audit_logs = db.audit_logs.slice(0, 500);
    }
    this.write(db);
    return logEntry;
  }
}

export const store = new JsonStore();
