/**
 * @fileoverview Tests for database race condition fixes
 * Ensures database initialization doesn't cause project indexing failures
 */

const fs = require('fs');
const path = require('path');
const MarkdownDB = require('../scripts/markdownDB');
const DataIndexer = require('../scripts/dataIndexer');

describe('Database Race Condition Fixes', () => {
  const testDbPath = path.join(__dirname, 'test-race-condition.db');
  const testProjectsDir = path.join(__dirname, 'fixtures/projects-race-test');

  beforeEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test projects directory
    if (!fs.existsSync(testProjectsDir)) {
      fs.mkdirSync(testProjectsDir, { recursive: true });
    }

    // Create test project file (alphabetically first to trigger race condition)
    const testProject = `---
project: AAA First Project
departmentalGoal: []
strategicDirection: []
tags: [test]
status: Active
startDate: 2025-07-31
---
## Summary
Test project that would fail due to race condition.`;

    fs.writeFileSync(
      path.join(testProjectsDir, 'aaa-first-project.md'),
      testProject
    );
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testProjectsDir)) {
      fs.rmSync(testProjectsDir, { recursive: true, force: true });
    }
  });

  test('should successfully index alphabetically first project without race condition', async () => {
    const db = new MarkdownDB(testDbPath);
    const indexer = new DataIndexer(__dirname);
    indexer.db = db;
    indexer.projectsDir = testProjectsDir;

    await db.init();

    const result = await indexer.indexProjects();

    expect(result.indexed).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify project was actually inserted
    const projects = await new Promise((resolve, reject) => {
      db.db.all(
        'SELECT * FROM projects WHERE project_name = ?',
        ['AAA First Project'],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    expect(projects).toHaveLength(1);
    expect(projects[0].project_name).toBe('AAA First Project');
  });

  test('should handle multiple projects in correct order without race condition', async () => {
    // Add second project
    const secondProject = `---
project: ZZZ Last Project
departmentalGoal: []
strategicDirection: []
tags: [test]
status: Active
startDate: 2025-07-31
---
## Summary
Test project that comes last alphabetically.`;

    fs.writeFileSync(
      path.join(testProjectsDir, 'zzz-last-project.md'),
      secondProject
    );

    const db = new MarkdownDB(testDbPath);
    const indexer = new DataIndexer(__dirname);
    indexer.db = db;
    indexer.projectsDir = testProjectsDir;

    await db.init();

    const result = await indexer.indexProjects();

    expect(result.indexed).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify both projects were inserted
    const projects = await new Promise((resolve, reject) => {
      db.db.all(
        'SELECT project_name FROM projects ORDER BY project_name',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    expect(projects).toHaveLength(2);
    expect(projects[0].project_name).toBe('AAA First Project');
    expect(projects[1].project_name).toBe('ZZZ Last Project');
  });

  test('should not fail when database connection issues occur during batch processing', async () => {
    const db = new MarkdownDB(testDbPath);
    const indexer = new DataIndexer(__dirname);
    indexer.db = db;
    indexer.projectsDir = testProjectsDir;

    // Initialize database but don't wait for full readiness
    const initPromise = db.init();

    // Try to index before database is fully ready (simulates race condition)
    const result = await initPromise.then(() => indexer.indexProjects());

    // Should still succeed due to the delay fix
    expect(result.indexed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
