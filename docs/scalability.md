# Multi-User Scalability Considerations

This document outlines the considerations, challenges, and potential solutions for scaling Temporal Mark to support multiple users while maintaining data integrity and performance.

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Multi-User Challenges](#multi-user-challenges)
3. [Scalability Solutions](#scalability-solutions)
4. [Database Considerations](#database-considerations)
5. [Security & Privacy](#security--privacy)
6. [Performance Optimization](#performance-optimization)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Technology Alternatives](#technology-alternatives)

## Current Architecture

### Single-User Design

Temporal Mark is currently designed as a **single-user system** with the following characteristics:

- **File-based storage**: Markdown files stored locally in directories
- **SQLite database**: Single database file for indexing and fast queries
- **No authentication**: No user management or access control
- **Local file system**: All operations assume direct file system access
- **CLI-first**: Designed for individual developer/knowledge worker use

### Components

```
temporal-mark/
├── projects/           # Project definition files
├── time-logs/          # Time log markdown files
├── db/                 # SQLite database for indexing
├── logs/               # System logs
├── scripts/            # Core application logic
└── reports/            # Generated reports
```

## Multi-User Challenges

### 1. Data Isolation

**Challenge**: Each user needs their own isolated time tracking data.

**Current State**: All data stored in shared directories

- Single `projects/` directory for all projects
- Single `time-logs/` directory for all time logs
- Single SQLite database file

**Multi-User Needs**:

- User-specific project lists
- Separate time logs per user
- Isolated databases or multi-tenant database design

### 2. Concurrent Access

**Challenge**: Multiple users accessing the system simultaneously.

**Current Issues**:

- SQLite file locking can cause conflicts
- Markdown file write conflicts
- No synchronization mechanisms

**Multi-User Requirements**:

- Concurrent read/write operations
- Database transaction management
- File locking mechanisms
- Conflict resolution strategies

### 3. Authentication & Authorization

**Challenge**: Identifying and authorizing users.

**Current State**: No authentication system

**Multi-User Needs**:

- User identification system
- Authentication mechanisms (local, OAuth, LDAP)
- Role-based access control
- Session management

### 4. Project Collaboration

**Challenge**: Multiple users working on shared projects.

**Scenarios**:

- Team members tracking time on the same project
- Project managers viewing team time logs
- Departmental reporting across users

**Requirements**:

- Shared project definitions
- Aggregated reporting
- Permission levels (view, edit, admin)

### 5. Data Synchronization

**Challenge**: Keeping data consistent across multiple access points.

**Issues**:

- Real-time updates when multiple users edit
- Cache invalidation
- Database consistency

## Scalability Solutions

### Solution 1: Multi-Tenant File System

**Approach**: Extend current architecture with user-specific directories

```
temporal-mark/
├── users/
│   ├── user1/
│   │   ├── projects/
│   │   ├── time-logs/
│   │   ├── db/
│   │   └── reports/
│   ├── user2/
│   │   ├── projects/
│   │   ├── time-logs/
│   │   ├── db/
│   │   └── reports/
│   └── shared/
│       ├── projects/      # Shared projects
│       └── templates/     # Project templates
├── logs/                  # System-wide logs
└── config/               # System configuration
```

**Pros**:

- Minimal changes to existing codebase
- Clear data separation
- Maintains file-based benefits (Git, Obsidian compatibility)
- Easy backup per user

**Cons**:

- File system overhead
- Limited collaboration features
- Complex shared project management
- Scaling limits based on file system performance

### Solution 2: Multi-Tenant Database

**Approach**: Single database with user isolation

```sql
-- Enhanced database schema
CREATE TABLE users (
    user_id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
    project_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    -- existing project fields
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE TABLE time_entries (
    entry_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    -- existing time entry fields
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (project_id) REFERENCES projects (project_id)
);

CREATE TABLE project_collaborators (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer', -- viewer, contributor, admin
    PRIMARY KEY (project_id, user_id)
);
```

**Pros**:

- Better performance for multi-user queries
- Centralized data management
- Easier aggregated reporting
- Better concurrent access handling

**Cons**:

- Significant architectural changes required
- Loss of simple Markdown file benefits
- More complex backup strategies
- Database administration overhead

### Solution 3: Hybrid Approach

**Approach**: Combine file-based storage with centralized coordination

```
temporal-mark/
├── users/
│   ├── user1/
│   │   ├── time-logs/     # Personal time logs (Markdown)
│   │   └── cache/         # Local SQLite cache
│   └── user2/
│       ├── time-logs/
│       └── cache/
├── shared/
│   ├── projects/          # Shared project definitions
│   ├── db/               # Central coordination database
│   └── reports/          # Aggregated reports
└── config/
    ├── users.json        # User configuration
    └── permissions.json  # Access control
```

**Pros**:

- Preserves file-based benefits for time logs
- Centralized project and user management
- Scalable coordination layer
- Maintains Obsidian/Git compatibility

**Cons**:

- Complex synchronization logic
- Potential data consistency issues
- Mixed storage paradigms

## Database Considerations

### SQLite Limitations

**Current Issues**:

- Single writer at a time
- File locking conflicts
- Limited concurrent access
- No built-in user management

**Multi-User Enhancements**:

```javascript
// WAL mode for better concurrency
const db = new Database('temporal.db');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');

// Connection pooling
class DatabasePool {
  constructor(maxConnections = 10) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }

  async getConnection() {
    // Implementation for connection pooling
  }
}
```

### Alternative Databases

**PostgreSQL**:

- Excellent multi-user support
- ACID compliance
- Advanced indexing
- JSON support for metadata

**MongoDB**:

- Document-based (good for Markdown metadata)
- Horizontal scaling
- Flexible schema
- Built-in replication

**Hybrid (SQLite + Redis)**:

- SQLite for main data
- Redis for real-time coordination
- Pub/Sub for live updates

## Security & Privacy

### Authentication Options

**1. Local Authentication**:

```javascript
// Basic username/password with bcrypt
const bcrypt = require('bcrypt');

class UserAuth {
  async createUser(username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Store in database
  }

  async authenticate(username, password) {
    // Verify credentials
  }
}
```

**2. OAuth Integration**:

```javascript
// GitHub, Google, Microsoft OAuth
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: '/auth/github/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      // Handle OAuth callback
    }
  )
);
```

**3. Enterprise Integration**:

- LDAP/Active Directory
- SAML SSO
- JWT tokens

### Data Privacy

**User Data Isolation**:

```javascript
// Middleware to ensure user data access
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const requireOwnership = (req, res, next) => {
  // Verify user owns the requested resource
  if (req.params.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};
```

**Encryption**:

- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Encrypt database backups

## Performance Optimization

### Caching Strategy

```javascript
// Multi-layer caching
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.redisCache = redis.createClient();
  }

  async get(key) {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // Check Redis cache
    const cached = await this.redisCache.get(key);
    if (cached) {
      const data = JSON.parse(cached);
      this.memoryCache.set(key, data);
      return data;
    }

    return null;
  }
}
```

### Database Optimization

**Indexing Strategy**:

```sql
-- User-specific indexes
CREATE INDEX idx_time_entries_user_date ON time_entries (user_id, date);
CREATE INDEX idx_projects_user_status ON projects (user_id, status);
CREATE INDEX idx_time_entries_project ON time_entries (project_id);

-- Reporting indexes
CREATE INDEX idx_time_entries_user_fiscal_year ON time_entries (user_id, fiscal_year);
CREATE INDEX idx_time_entries_tags ON time_entries (tags); -- GIN index for PostgreSQL
```

**Query Optimization**:

```javascript
// Batched operations
class BatchProcessor {
  async batchInsertTimeEntries(entries) {
    const stmt = db.prepare(`
      INSERT INTO time_entries (user_id, date, start_time, end_time, task, project_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((entries) => {
      for (const entry of entries) {
        stmt.run(
          entry.userId,
          entry.date,
          entry.startTime,
          entry.endTime,
          entry.task,
          entry.projectId
        );
      }
    });

    return transaction(entries);
  }
}
```

### Real-Time Updates

```javascript
// WebSocket integration for live updates
const WebSocket = require('ws');

class RealTimeManager {
  constructor() {
    this.wss = new WebSocket.Server({ port: 8080 });
    this.userConnections = new Map();
  }

  broadcastToUser(userId, data) {
    const connections = this.userConnections.get(userId) || [];
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });
  }

  notifyTimeEntryAdded(userId, entry) {
    this.broadcastToUser(userId, {
      type: 'TIME_ENTRY_ADDED',
      data: entry,
    });
  }
}
```

## Implementation Roadmap

### Phase 1: Basic Multi-User Support (2-4 weeks)

**Goals**: Support multiple users with isolated data

**Tasks**:

1. Add user management system
2. Implement basic authentication
3. Create user-specific directory structure
4. Update CLI to handle user context
5. Add user switching capabilities

**Deliverables**:

- User registration/login system
- Isolated user data directories
- Updated CLI with `--user` flag
- Migration tool for existing single-user data

### Phase 2: Enhanced Database Layer (3-5 weeks)

**Goals**: Improve concurrent access and performance

**Tasks**:

1. Implement database connection pooling
2. Add multi-user database schema
3. Create user-aware data access layer
4. Implement caching system
5. Add database migration system

**Deliverables**:

- Multi-tenant database schema
- Connection pooling system
- Cached data access layer
- Migration scripts

### Phase 3: Collaboration Features (4-6 weeks)

**Goals**: Enable project sharing and team collaboration

**Tasks**:

1. Implement shared project system
2. Add role-based permissions
3. Create aggregated reporting
4. Build team dashboard
5. Add real-time updates

**Deliverables**:

- Shared project management
- Permission system
- Team reporting features
- Real-time collaboration updates

### Phase 4: Enterprise Features (6-8 weeks)

**Goals**: Add enterprise-grade features

**Tasks**:

1. Integrate with enterprise authentication
2. Add audit logging
3. Implement data export/import
4. Create admin dashboard
5. Add monitoring and analytics

**Deliverables**:

- LDAP/SSO integration
- Audit trail system
- Data portability tools
- Administrative interface

## Technology Alternatives

### Option 1: Maintain Current Stack

**Stack**: Node.js + SQLite + Express
**Approach**: Extend existing architecture
**Timeline**: 2-3 months
**Complexity**: Medium

### Option 2: Modern Web Stack

**Stack**: Node.js + PostgreSQL + Redis + React
**Approach**: Rebuild with web-first design
**Timeline**: 4-6 months
**Complexity**: High

### Option 3: Microservices Architecture

**Stack**: Node.js services + PostgreSQL + Message Queue
**Approach**: Service-oriented architecture
**Timeline**: 6-8 months
**Complexity**: Very High

### Option 4: Cloud-First Solution

**Stack**: Serverless functions + Cloud database + CDN
**Approach**: Cloud-native rebuild
**Timeline**: 3-4 months
**Complexity**: High

## Recommendations

### Immediate Steps (Next 3 months)

1. **Start with Hybrid Approach**: Maintain file benefits while adding multi-user support
2. **Implement Basic Authentication**: Simple username/password system
3. **Create User Isolation**: User-specific directories with shared projects
4. **Upgrade Database Layer**: Better SQLite configuration + connection pooling
5. **Add API Layer**: REST API for all operations (already implemented in Phase 6)

### Medium-term Goals (6-12 months)

1. **Add Collaboration Features**: Shared projects with permissions
2. **Implement Real-time Updates**: WebSocket integration
3. **Create Web Interface**: React-based dashboard
4. **Add Enterprise Auth**: OAuth/LDAP integration
5. **Performance Optimization**: Caching and query optimization

### Long-term Vision (1-2 years)

1. **Horizontal Scaling**: Support for thousands of users
2. **Advanced Analytics**: ML-powered insights
3. **Mobile Applications**: Native mobile apps
4. **API Ecosystem**: Public API for integrations
5. **Cloud Hosting**: SaaS offering

The key is to evolve gradually while maintaining backward compatibility and the core benefits that make Temporal Mark unique: file-based storage, Git compatibility, and Obsidian integration.
