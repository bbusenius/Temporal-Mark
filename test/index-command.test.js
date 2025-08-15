/**
 * @fileoverview Tests for the index CLI command
 * Tests database clearing, re-indexing, and data synchronization
 */

const fs = require('fs');
const path = require('path');
const DataIndexer = require('../scripts/dataIndexer');

describe('Index Command', () => {
  const testDir = path.join(__dirname, 'fixtures/index-test');
  const testDbPath = path.join(testDir, 'markdownDB.sqlite');
  const testProjectsDir = path.join(testDir, 'projects');
  const testTimeLogsDir = path.join(testDir, 'time-logs');

  let dataIndexer;

  beforeEach(async () => {
    // Clean up and create test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(testProjectsDir, { recursive: true });
    fs.mkdirSync(testTimeLogsDir, { recursive: true });

    // Create test project file
    const testProject = `---
project: Test Project
departmentalGoal: [Technology]
strategicDirection: [Innovation]
tags: [testing, development]
status: Active
startDate: 2025-07-01
---
## Summary
A test project for unit testing the index functionality.
`;
    fs.writeFileSync(
      path.join(testProjectsDir, 'test-project.md'),
      testProject
    );

    // Create test time log file
    const testTimeLog = `# Time Log 2025-2026

## Summary
Test time log for index command testing.

---

### 2025-07-30
- **09:00-10:00**: First task [[Test Project]] [testing]
- **10:30-11:30**: Second task [[Test Project]] [development]

### 2025-07-31
- **14:00-15:00**: Third task [[Test Project]] [debugging]
`;
    fs.writeFileSync(
      path.join(testTimeLogsDir, 'time-log-2025-2026.md'),
      testTimeLog
    );

    // Initialize DataIndexer with test directory and test database
    dataIndexer = new DataIndexer(testDir, testDbPath);
    await dataIndexer.initialize();
  });

  afterEach(async () => {
    if (dataIndexer) {
      await dataIndexer.close();
    }
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Initial Indexing', () => {
    test('should index projects and time entries on first run', async () => {
      const results = await dataIndexer.indexAllData();

      expect(results.projects.indexed).toBe(1);
      expect(results.timeEntries.indexed).toBe(3);
      expect(results.projects.errors).toHaveLength(0);
      expect(results.timeEntries.errors).toHaveLength(0);
    });

    test('should create database entries for projects', async () => {
      await dataIndexer.indexAllData();

      const project = await dataIndexer.db.getProject('Test Project');
      expect(project).toBeTruthy();
      expect(project.project_name).toBe('Test Project');
      expect(project.status).toBe('Active');
      expect(project.start_date).toBe('2025-07-01');
    });

    test('should create database entries for time entries', async () => {
      await dataIndexer.indexAllData();

      const entries =
        await dataIndexer.db.getTimeEntriesForProject('Test Project');
      expect(entries).toHaveLength(3);

      const firstEntry = entries.find((e) => e.task === 'First task');
      expect(firstEntry).toBeTruthy();

      expect(firstEntry.date).toBe('2025-07-30');
      expect(firstEntry.startTime).toBe('09:00');
      expect(firstEntry.endTime).toBe('10:00');
      expect(firstEntry.durationHours).toBe(1);
    });
  });

  describe('Re-indexing Behavior', () => {
    test('should clear existing data before re-indexing', async () => {
      // First indexing
      await dataIndexer.indexAllData();
      let entryCount = await dataIndexer.db.getTimeEntryCount();
      expect(entryCount).toBe(3);

      // Second indexing should clear and re-add same data
      await dataIndexer.indexAllData();
      entryCount = await dataIndexer.db.getTimeEntryCount();
      expect(entryCount).toBe(3);
    });

    test('should reflect changes when entries are modified in files', async () => {
      // Initial index
      await dataIndexer.indexAllData();
      let entries =
        await dataIndexer.db.getTimeEntriesForProject('Test Project');
      expect(entries).toHaveLength(3);

      // Modify the time log file to add an entry
      const timeLogPath = path.join(testTimeLogsDir, 'time-log-2025-2026.md');
      let content = fs.readFileSync(timeLogPath, 'utf8');
      content +=
        '\n- **16:00-17:00**: Fourth task [[Test Project]] [new-feature]\n';
      fs.writeFileSync(timeLogPath, content);

      // Re-index
      await dataIndexer.indexAllData();
      entries = await dataIndexer.db.getTimeEntriesForProject('Test Project');
      expect(entries).toHaveLength(4);

      const newEntry = entries.find((e) => e.task === 'Fourth task');
      expect(newEntry).toBeTruthy();
      expect(newEntry.startTime).toBe('16:00');
    });

    test('should remove entries when deleted from files', async () => {
      // Initial index
      await dataIndexer.indexAllData();
      let entries =
        await dataIndexer.db.getTimeEntriesForProject('Test Project');
      expect(entries).toHaveLength(3);

      // Remove an entry from the time log file
      const timeLogPath = path.join(testTimeLogsDir, 'time-log-2025-2026.md');
      let content = fs.readFileSync(timeLogPath, 'utf8');
      content = content.replace(
        '- **09:00-10:00**: First task [[Test Project]] [testing]\n',
        ''
      );
      fs.writeFileSync(timeLogPath, content);

      // Re-index
      await dataIndexer.indexAllData();
      entries = await dataIndexer.db.getTimeEntriesForProject('Test Project');
      expect(entries).toHaveLength(2);

      const deletedEntry = entries.find((e) => e.task === 'First task');
      expect(deletedEntry).toBeFalsy();
    });
  });

  describe('Data Synchronization', () => {
    test('should handle project file changes', async () => {
      // Initial index
      await dataIndexer.indexAllData();
      let project = await dataIndexer.db.getProject('Test Project');
      expect(project.status).toBe('Active');

      // Modify project file
      const projectPath = path.join(testProjectsDir, 'test-project.md');
      let content = fs.readFileSync(projectPath, 'utf8');
      content = content.replace('status: Active', 'status: Completed');
      fs.writeFileSync(projectPath, content);

      // Re-index
      await dataIndexer.indexAllData();
      project = await dataIndexer.db.getProject('Test Project');
      expect(project.status).toBe('Completed');
    });

    test('should handle new project files', async () => {
      // Initial index
      await dataIndexer.indexAllData();
      let projects = await dataIndexer.db.getAllProjects();
      expect(projects).toHaveLength(1);

      // Add new project file
      const newProject = `---
project: Second Test Project
departmentalGoal: [Marketing]
strategicDirection: [Growth]
tags: [new, testing]
status: Active
startDate: 2025-07-15
---
## Summary
Another test project.
`;
      fs.writeFileSync(
        path.join(testProjectsDir, 'second-test-project.md'),
        newProject
      );

      // Re-index
      await dataIndexer.indexAllData();
      projects = await dataIndexer.db.getAllProjects();
      expect(projects).toHaveLength(2);

      const newProjectEntry = projects.find(
        (p) => p.project_name === 'Second Test Project'
      );
      expect(newProjectEntry).toBeTruthy();
    });

    test('should handle deleted project files', async () => {
      // Initial index
      await dataIndexer.indexAllData();
      let projects = await dataIndexer.db.getAllProjects();
      expect(projects).toHaveLength(1);

      // Delete project file
      const projectPath = path.join(testProjectsDir, 'test-project.md');
      fs.unlinkSync(projectPath);

      // Re-index
      await dataIndexer.indexAllData();
      projects = await dataIndexer.db.getAllProjects();
      expect(projects).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed project files gracefully', async () => {
      // Create malformed project file
      const malformedProject = `---
project: Malformed Project
This is not valid YAML frontmatter
---
Content here`;
      fs.writeFileSync(
        path.join(testProjectsDir, 'malformed.md'),
        malformedProject
      );

      // Suppress console output during this test to avoid noise in CI
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      console.log = jest.fn();
      console.error = jest.fn();

      try {
        const results = await dataIndexer.indexAllData();

        // Should still index the valid project but report error for malformed one
        expect(results.projects.indexed).toBe(1);
        expect(results.projects.errors.length).toBeGreaterThan(0);
      } finally {
        // Restore console functions
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
      }
    });

    test('should handle empty time log files', async () => {
      // Create empty time log file
      fs.writeFileSync(
        path.join(testTimeLogsDir, 'empty-log.md'),
        '# Empty Log\n'
      );

      const results = await dataIndexer.indexAllData();

      // Should process without errors even with empty files
      expect(results.timeEntries.indexed).toBe(3); // Still the original 3 entries
      expect(results.timeEntries.errors).toHaveLength(0);
    });
  });
});
