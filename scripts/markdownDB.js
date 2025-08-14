const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class MarkdownDB {
  constructor(dbPath = path.join(__dirname, '../db/markdownDB.sqlite')) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Ensure db directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, _reject) => {
      const timeEntriesTable = `
        CREATE TABLE IF NOT EXISTS time_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          duration_hours REAL NOT NULL,
          task TEXT NOT NULL,
          project TEXT NOT NULL,
          tags TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, start_time, end_time, task, project)
        )
      `;

      const projectsTable = `
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT UNIQUE NOT NULL,
          departmental_goals TEXT,
          strategic_directions TEXT,
          tags TEXT,
          status TEXT,
          start_date TEXT,
          summary TEXT,
          file_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const indexQueries = [
        'CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date)',
        'CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project)',
        'CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name)',
      ];

      this.db.serialize(() => {
        this.db.run(timeEntriesTable, (err) => {
          if (err) {
            console.error('Error creating time_entries table:', err);
          }
        });
        this.db.run(projectsTable, (err) => {
          if (err) {
            console.error('Error creating projects table:', err);
          }
        });

        indexQueries.forEach((query) => {
          this.db.run(query, (err) => {
            if (err) {
              console.error('Error creating index:', err);
            }
          });
        });

        // Use db.run with a completion callback to ensure all commands are done
        this.db.run('SELECT 1', (err) => {
          if (err) {
            console.error('Database initialization check failed:', err);
          }
          resolve();
        });
      });
    });
  }

  async insertTimeEntry(entry) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO time_entries 
        (date, start_time, end_time, duration_hours, task, project, tags, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        entry.date,
        entry.startTime,
        entry.endTime,
        entry.durationHours,
        entry.task,
        entry.project,
        JSON.stringify(entry.tags || []),
        entry.notes || null,
      ];

      this.db.run(query, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...entry });
        }
      });
    });
  }

  async insertProject(project) {
    return new Promise((resolve, reject) => {
      // Check if database connection exists
      if (!this.db) {
        reject(new Error('Database connection not initialized'));
        return;
      }

      const query = `
        INSERT OR REPLACE INTO projects 
        (project_name, departmental_goals, strategic_directions, tags, status, start_date, summary, file_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        project.projectName,
        JSON.stringify(project.departmentalGoals || []),
        JSON.stringify(project.strategicDirections || []),
        JSON.stringify(project.tags || []),
        project.status,
        project.startDate,
        project.summary,
        project.filePath,
      ];

      this.db.run(query, params, function (err) {
        if (err) {
          reject(new Error(`Database error: ${err.message}`));
        } else {
          resolve({ id: this.lastID, ...project });
        }
      });
    });
  }

  async getTimeEntriesForDate(date) {
    return new Promise((resolve, reject) => {
      const query =
        'SELECT * FROM time_entries WHERE date = ? ORDER BY start_time';

      this.db.all(query, [date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const entries = rows.map((row) => ({
            id: row.id,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            durationHours: row.duration_hours,
            task: row.task,
            project: row.project,
            tags: JSON.parse(row.tags || '[]'),
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          resolve(entries);
        }
      });
    });
  }

  async getTimeEntriesForProject(projectName) {
    return new Promise((resolve, reject) => {
      const query =
        'SELECT * FROM time_entries WHERE project = ? ORDER BY date, start_time';

      this.db.all(query, [projectName], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const entries = rows.map((row) => ({
            id: row.id,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            durationHours: row.duration_hours,
            task: row.task,
            project: row.project,
            tags: JSON.parse(row.tags || '[]'),
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          resolve(entries);
        }
      });
    });
  }

  async getTimeEntriesForTag(tag) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM time_entries 
        WHERE tags LIKE ? 
        ORDER BY date, start_time
      `;

      this.db.all(query, [`%"${tag}"%`], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const entries = rows.map((row) => ({
            id: row.id,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            durationHours: row.duration_hours,
            task: row.task,
            project: row.project,
            tags: JSON.parse(row.tags || '[]'),
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          resolve(entries);
        }
      });
    });
  }

  async getTimeEntryCount() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM time_entries';

      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row.count);
      });
    });
  }

  async getTimeEntriesInDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM time_entries 
        WHERE date >= ? AND date <= ?
        ORDER BY date, start_time
      `;

      this.db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const entries = rows.map((row) => ({
            id: row.id,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            durationHours: row.duration_hours,
            task: row.task,
            project: row.project,
            tags: JSON.parse(row.tags || '[]'),
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
          resolve(entries);
        }
      });
    });
  }

  async getProject(projectName) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM projects WHERE project_name = ?';

      this.db.get(query, [projectName], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          const project = {
            ...row,
            departmentalGoals: JSON.parse(row.departmental_goals || '[]'),
            strategicDirections: JSON.parse(row.strategic_directions || '[]'),
            tags: JSON.parse(row.tags || '[]'),
          };
          resolve(project);
        } else {
          resolve(null);
        }
      });
    });
  }

  async getAllProjects() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM projects ORDER BY start_date';

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const projects = rows.map((row) => ({
            ...row,
            departmentalGoals: JSON.parse(row.departmental_goals || '[]'),
            strategicDirections: JSON.parse(row.strategic_directions || '[]'),
            tags: JSON.parse(row.tags || '[]'),
          }));
          resolve(projects);
        }
      });
    });
  }

  /**
   * Clear all time entries from database
   * @async
   * @returns {Promise<void>}
   */
  async clearTimeEntries() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM time_entries', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all projects from database
   * @async
   * @returns {Promise<void>}
   */
  async clearProjects() {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM projects', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all data from database
   * @async
   * @returns {Promise<void>}
   */
  async clearAllData() {
    await this.clearTimeEntries();
    await this.clearProjects();
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = MarkdownDB;
