/**
 * @fileoverview Tests for SinceReport functionality
 * Tests the since command's ability to find work done since the last occurrence
 * of specified text strings in task descriptions.
 */

const path = require('path');
const fs = require('fs');
const SinceReport = require('../scripts/reportSince');
const DataIndexer = require('../scripts/dataIndexer');
const MCPIntegration = require('../scripts/mcpIntegration');

describe('SinceReport', () => {
  let report;
  let tempDbPath;

  async function insertTestData() {
    const { db } = report.indexer;

    // Insert test time entries in chronological order
    const testEntries = [
      {
        date: '2025-07-15',
        startTime: '09:00',
        endTime: '10:00',
        durationHours: 1.0,
        task: 'standup meeting with team',
        project: 'Meetings',
        tags: 'standup',
        notes: null,
      },
      {
        date: '2025-07-15',
        startTime: '10:00',
        endTime: '12:00',
        durationHours: 2.0,
        task: 'worked on feature A',
        project: 'Project Alpha',
        tags: 'development',
        notes: null,
      },
      {
        date: '2025-07-16',
        startTime: '09:00',
        endTime: '11:00',
        durationHours: 2.0,
        task: 'continued feature A development',
        project: 'Project Alpha',
        tags: 'development',
        notes: null,
      },
      {
        date: '2025-07-16',
        startTime: '14:00',
        endTime: '15:00',
        durationHours: 1.0,
        task: 'standup meeting discussion',
        project: 'Meetings',
        tags: 'standup',
        notes: null,
      },
      {
        date: '2025-07-17',
        startTime: '09:00',
        endTime: '10:30',
        durationHours: 1.5,
        task: 'bug fixes for Project Beta',
        project: 'Project Beta',
        tags: 'bug-fix',
        notes: null,
      },
      {
        date: '2025-07-17',
        startTime: '11:00',
        endTime: '12:00',
        durationHours: 1.0,
        task: 'documentation updates',
        project: 'Project Beta',
        tags: 'documentation',
        notes: null,
      },
      {
        date: '2025-07-17',
        startTime: '12:30',
        endTime: '13:30',
        durationHours: 1.0,
        task: 'lunch break',
        project: 'Unproductive',
        tags: 'unproductive',
        notes: null,
      },
    ];

    const insertPromises = testEntries.map((entry) =>
      db.insertTimeEntry(entry)
    );
    await Promise.all(insertPromises);
  }

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(
      __dirname,
      'fixtures',
      `test-since-${Date.now()}.sqlite`
    );
    report = new SinceReport();

    // Override the database path
    report.indexer = new DataIndexer(
      path.join(__dirname, 'fixtures'),
      tempDbPath
    );
    await report.indexer.initialize({ skipAutoReindex: true });

    // Insert test data
    await insertTestData();
  });

  afterEach(async () => {
    if (report) {
      await report.close();
    }

    // Clean up test database
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  describe('findLastOccurrence', () => {
    test('should find the most recent occurrence of a search string', async () => {
      const result = await report.findLastOccurrence('standup meeting');

      expect(result).toBeDefined();
      expect(result.date).toBe('2025-07-16');
      expect(result.task).toBe('standup meeting discussion');
      expect(result.project).toBe('Meetings');
    });

    test('should return null when search string is not found', async () => {
      const result = await report.findLastOccurrence('nonexistent task');
      expect(result).toBeNull();
    });

    test('should be case insensitive', async () => {
      const result = await report.findLastOccurrence('STANDUP MEETING');
      expect(result).toBeDefined();
      expect(result.task).toBe('standup meeting discussion');
    });

    test('should match partial strings', async () => {
      const result = await report.findLastOccurrence('standup');
      expect(result).toBeDefined();
      expect(result.date).toBe('2025-07-16');
      expect(result.task).toBe('standup meeting discussion');
    });
  });

  describe('getEntriesSince', () => {
    test('should return entries after a specific date and time', async () => {
      const entries = await report.getEntriesSince('2025-07-16', '15:00');

      expect(entries).toHaveLength(3);
      expect(entries[0].date).toBe('2025-07-17');
      expect(entries[0].task).toBe('bug fixes for Project Beta');
      expect(entries[1].task).toBe('documentation updates');
      expect(entries[2].task).toBe('lunch break');
    });

    test('should return empty array when no entries found after date', async () => {
      const entries = await report.getEntriesSince('2025-07-20', '00:00');
      expect(entries).toHaveLength(0);
    });

    test('should handle same date with different time correctly', async () => {
      const entries = await report.getEntriesSince('2025-07-16', '13:00');

      expect(entries).toHaveLength(4); // standup at 14:00 + 3 entries on 07-17
      expect(entries[0].startTime).toBe('14:00');
      expect(entries[0].task).toBe('standup meeting discussion');
    });
  });

  describe('groupEntriesByProject', () => {
    test('should group entries by project and calculate totals', async () => {
      const entries = await report.getEntriesSince('2025-07-15', '10:00');
      const grouped = await report.groupEntriesByProject(entries);

      expect(grouped.projects).toHaveLength(4);
      expect(grouped.totalHours).toBe(6.5);
      expect(grouped.totalEntries).toBe(5);

      // Should be sorted by hours (descending)
      const alphaProject = grouped.projects.find(
        (p) => p.project === 'Project Alpha'
      );
      const betaProject = grouped.projects.find(
        (p) => p.project === 'Project Beta'
      );
      const meetingsProject = grouped.projects.find(
        (p) => p.project === 'Meetings'
      );
      const unproductiveProject = grouped.projects.find(
        (p) => p.project === 'Unproductive'
      );

      expect(alphaProject.totalHours).toBe(2.0);
      expect(betaProject.totalHours).toBe(2.5);
      expect(meetingsProject.totalHours).toBe(1.0);
      expect(unproductiveProject.totalHours).toBe(1.0);

      // Should be sorted by total hours (descending)
      expect(grouped.projects[0].project).toBe('Project Beta');
      expect(grouped.projects[1].project).toBe('Project Alpha');
    });

    test('should handle empty entries array', async () => {
      const grouped = await report.groupEntriesByProject([]);

      expect(grouped.projects).toHaveLength(0);
      expect(grouped.totalHours).toBe(0);
      expect(grouped.totalEntries).toBe(0);
      expect(grouped.dateRange).toBeNull();
    });
  });

  describe('generateReport', () => {
    test('should generate complete report for found search string', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'markdown',
      });

      expect(reportContent).toContain('# Work Since Last "standup meeting"');
      expect(reportContent).toContain('## Last Occurrence');
      expect(reportContent).toContain('- **Date**: 2025-07-16');
      expect(reportContent).toContain('- **Task**: standup meeting discussion');
      expect(reportContent).toContain('## Summary');
      expect(reportContent).toContain('- **Total Hours**: 2.5h');
      expect(reportContent).toContain('- **Total Entries**: 2');
      expect(reportContent).toContain('- **Projects**: 1');
      expect(reportContent).toContain('### Project Beta (2.5h)');
    });

    test('should throw error when search string is not found', async () => {
      await expect(report.generateReport('nonexistent string')).rejects.toThrow(
        'No entries found containing "nonexistent string"'
      );
    });

    test('should handle case where no work found since last occurrence', async () => {
      // Add a standup meeting as the most recent entry
      const { db } = report.indexer;
      await db.insertTimeEntry({
        date: '2025-07-18',
        startTime: '09:00',
        endTime: '10:00',
        durationHours: 1.0,
        task: 'standup meeting final',
        project: 'Meetings',
        tags: 'standup',
        notes: null,
      });

      const reportContent = await report.generateReport(
        'standup meeting final'
      );

      expect(reportContent).toContain(
        'No work found since the last occurrence.'
      );
      expect(reportContent).toContain('- **Total Hours**: 0h');
      expect(reportContent).toContain('- **Total Entries**: 0');
    });

    test('should generate CSV format report', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'csv',
      });

      expect(reportContent).toMatch(
        /^Project,Date,StartTime,EndTime,Duration,Task,Tags,Notes/
      );
      expect(reportContent).toContain('"Project Beta"');
      expect(reportContent).toContain('2025-07-17');
      expect(reportContent).toContain('"bug fixes for Project Beta"');
    });

    test('should generate JSON format report', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'json',
      });

      const reportData = JSON.parse(reportContent);

      expect(reportData.searchString).toBe('standup meeting');
      expect(reportData.lastOccurrence.date).toBe('2025-07-16');
      expect(reportData.summary.totalHours).toBe(2.5);
      expect(reportData.projects).toHaveLength(1);
      expect(reportData.projects[0].project).toBe('Project Beta');
    });

    test('should show all tasks without limits', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'markdown',
      });

      expect(reportContent).toContain('bug fixes for Project Beta');
      expect(reportContent).toContain('documentation updates');
      expect(reportContent).not.toContain('more entries');
    });
  });

  describe('project suppression', () => {
    test('should automatically suppress Unproductive project', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'markdown',
      });

      expect(reportContent).not.toContain('Unproductive');
      expect(reportContent).toContain('Project Beta');
      expect(reportContent).toContain('- **Total Hours**: 2.5h'); // Should exclude the 1h from Unproductive
      expect(reportContent).toContain('- **Total Entries**: 2'); // Should exclude the 1 entry from Unproductive
      expect(reportContent).toContain('- **Projects**: 1'); // Should only count Project Beta
    });

    test('should suppress additional projects when specified', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'markdown',
        suppressProjects: 'Project Alpha',
      });

      expect(reportContent).not.toContain('Unproductive'); // Always suppressed
      expect(reportContent).not.toContain('Project Alpha'); // Explicitly suppressed
      expect(reportContent).toContain('Project Beta'); // Should remain
    });

    test('should suppress multiple projects', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'markdown',
        suppressProjects: 'Project Alpha, Project Beta',
      });

      expect(reportContent).not.toContain('Unproductive');
      expect(reportContent).not.toContain('Project Alpha');
      expect(reportContent).not.toContain('Project Beta');
      expect(reportContent).toContain(
        'No work found since the last occurrence.'
      ); // All projects should be filtered out
    });

    test('should handle JSON format with suppression', async () => {
      const reportContent = await report.generateReport('standup meeting', {
        format: 'json',
        suppressProjects: 'Project Alpha',
      });

      const reportData = JSON.parse(reportContent);

      expect(reportData.projects).toHaveLength(1);
      expect(reportData.projects[0].project).toBe('Project Beta');
      expect(reportData.summary.totalHours).toBe(2.5);
      expect(reportData.summary.totalEntries).toBe(2);
    });

    test('parseSuppressedProjects should always include Unproductive', async () => {
      const suppressedEmpty = report.parseSuppressedProjects('');
      const suppressedCustom = report.parseSuppressedProjects('Project Alpha');

      expect(suppressedEmpty.has('Unproductive')).toBe(true);
      expect(suppressedCustom.has('Unproductive')).toBe(true);
      expect(suppressedCustom.has('Project Alpha')).toBe(true);
    });

    test('applySuppression should filter projects and recalculate totals', async () => {
      const entries = await report.getEntriesSince('2025-07-15', '10:00');
      const grouped = await report.groupEntriesByProject(entries);
      const suppressed = new Set(['Unproductive', 'Project Alpha']);

      const filtered = report.applySuppression(grouped, suppressed);

      expect(filtered.projects).toHaveLength(2); // Beta and Meetings
      expect(filtered.totalHours).toBe(3.5); // 2.5 (Beta) + 1.0 (Meetings)
      expect(filtered.totalEntries).toBe(3); // 2 (Beta) + 1 (Meetings)
    });
  });

  describe('MCP integration', () => {
    test('should be compatible with MCP tool interface', async () => {
      const mcp = new MCPIntegration();
      // Override the dataIndexer to use the test database
      mcp.dataIndexer = new DataIndexer(
        path.join(__dirname, 'fixtures'),
        tempDbPath
      );
      await mcp.initialize();

      const result = await mcp.generateSinceReport({
        searchString: 'standup meeting',
        suppressProjects: 'Project Alpha',
        summarize: false,
      });

      expect(result.success).toBe(true);
      expect(result.mcpCompatible).toBe(true);
      expect(result.data.searchString).toBe('standup meeting');
      expect(result.data.suppressProjects).toBe('Project Alpha');
      expect(result.data.summarize).toBe(false);
      expect(result.data.lastOccurrence).toBeDefined();
      expect(result.data.summary).toBeDefined();
      expect(result.data.projects).toBeDefined();
      expect(result.data.aiInstructions).toBeUndefined(); // Should not be present when summarize=false

      await mcp.cleanup();
    });

    test('should include aiInstructions when summarize is true', async () => {
      const mcp = new MCPIntegration();
      // Override the dataIndexer to use the test database
      mcp.dataIndexer = new DataIndexer(
        path.join(__dirname, 'fixtures'),
        tempDbPath
      );
      await mcp.initialize();

      const result = await mcp.generateSinceReport({
        searchString: 'standup meeting',
        summarize: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.summarize).toBe(true);
      expect(result.data.aiInstructions).toBeDefined();
      expect(result.data.aiInstructions).toContain('organized by project');
      expect(result.data.aiInstructions).toContain('first-class citizen');
      expect(result.data.aiInstructions).toContain(
        'synthesize the individual tasks'
      );

      await mcp.cleanup();
    });

    test('should handle errors gracefully', async () => {
      const mcp = new MCPIntegration();
      // Override the dataIndexer to use the test database
      mcp.dataIndexer = new DataIndexer(
        path.join(__dirname, 'fixtures'),
        tempDbPath
      );
      await mcp.initialize();

      const result = await mcp.generateSinceReport({
        searchString: 'nonexistent string that will never be found',
      });

      expect(result.success).toBe(false);
      expect(result.mcpCompatible).toBe(true);
      expect(result.error).toBeDefined();

      await mcp.cleanup();
    });
  });
});
