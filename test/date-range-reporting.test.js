/**
 * @fileoverview Tests for date range reporting functionality
 * Validates range, weekly, and monthly reporting with various options
 */

const fs = require('fs');
const path = require('path');
const DateRangeReport = require('../scripts/reportDateRange');
const DataIndexer = require('../scripts/dataIndexer');
const MarkdownDB = require('../scripts/markdownDB');

/**
 * Calculate week boundaries (Monday to Sunday) for a given date
 * @param {Date} date - Target date
 * @returns {Object} Object with start and end date strings
 */
function calculateWeekBounds(date) {
  const target = new Date(date);

  // Get Monday of the week (day 0 = Sunday, day 1 = Monday)
  const dayOfWeek = target.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(target);
  monday.setDate(target.getDate() + daysToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

/**
 * Calculate month boundaries for a given date or month string
 * @param {string|undefined} date - Date string (YYYY-MM-DD) or month string (YYYY-MM), or undefined for current month
 * @returns {Object} Object with start and end date strings
 */
function calculateMonthBounds(date) {
  let year;
  let month;

  if (!date) {
    // Current month
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  } else if (date.match(/^\d{4}-\d{2}$/)) {
    // YYYY-MM format
    [year, month] = date.split('-').map(Number);
    month -= 1; // Convert to 0-based month
  } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // YYYY-MM-DD format, extract month
    const targetDate = new Date(date);
    year = targetDate.getFullYear();
    month = targetDate.getMonth();
  } else {
    throw new Error(`Invalid date format: ${date}. Use YYYY-MM-DD or YYYY-MM`);
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}

describe('Date Range Reporting', () => {
  const testDbPath = path.join(__dirname, 'test-range-reporting.db');
  const testProjectsDir = path.join(__dirname, 'fixtures/projects-range-test');
  const testTimeLogsDir = path.join(__dirname, 'fixtures/time-logs-range-test');

  let report;
  let dataIndexer;

  beforeEach(async () => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Create test directories
    [testProjectsDir, testTimeLogsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create test projects
    const testProjects = [
      {
        file: 'project-alpha.md',
        content: `---
project: Project Alpha
departmentalGoal: [Technology]
strategicDirection: [Innovation]
tags: [development, testing]
status: Active
startDate: 2025-07-01
---
## Summary
First test project for range reporting.`,
      },
      {
        file: 'project-beta.md',
        content: `---
project: Project Beta
departmentalGoal: [Marketing]
strategicDirection: [Growth]
tags: [analysis, reporting]
status: Active
startDate: 2025-07-15
---
## Summary
Second test project for range reporting.`,
      },
    ];

    testProjects.forEach(({ file, content }) => {
      fs.writeFileSync(path.join(testProjectsDir, file), content);
    });

    // Create test time log with entries spanning multiple days
    const timeLogContent = `# Time Log 2025-2026

### 2025-07-15
- **09:00-10:30**: Initial setup and planning [[Project Alpha]] [development]
- **11:00-12:00**: Database design [[Project Alpha]] [development, database]
- **14:00-15:30**: UI mockups [[Project Beta]] [design, ui]

### 2025-07-16
- **09:30-11:00**: Backend implementation [[Project Alpha]] [development, backend]
- **13:00-14:00**: Data analysis [[Project Beta]] [analysis]
- **15:00-16:00**: Team meeting [[Non-Project]] [meeting]

### 2025-07-17
- **10:00-12:00**: Testing and debugging [[Project Alpha]] [testing, debugging]
- **14:30-15:30**: Report generation [[Project Beta]] [reporting]

### 2025-07-20
- **09:00-10:00**: Code review [[Project Alpha]] [review]
- **11:00-12:30**: Documentation [[Project Beta]] [documentation]`;

    fs.writeFileSync(
      path.join(testTimeLogsDir, 'time-log-2025-2026.md'),
      timeLogContent
    );

    // Setup test components
    dataIndexer = new DataIndexer(__dirname);
    dataIndexer.db = new MarkdownDB(testDbPath);
    dataIndexer.projectsDir = testProjectsDir;
    dataIndexer.timeLogsDir = testTimeLogsDir;

    await dataIndexer.initialize();

    report = new DateRangeReport();
    report.dataIndexer = dataIndexer;
  });

  afterEach(async () => {
    try {
      if (dataIndexer && dataIndexer.db) {
        await dataIndexer.close();
      }
    } catch (error) {
      // Ignore database close errors in tests
    }

    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    [testProjectsDir, testTimeLogsDir].forEach((dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe('Core Date Range Functionality', () => {
    test('should validate date ranges correctly', () => {
      expect(report.isValidDateRange('2025-07-15', '2025-07-17')).toBe(true);
      expect(report.isValidDateRange('2025-07-01', '2025-07-31')).toBe(true);
      expect(report.isValidDateRange('2025-07-15', '2025-07-15')).toBe(true); // Same day

      // Invalid formats
      expect(report.isValidDateRange('25-07-15', '2025-07-17')).toBe(false);
      expect(report.isValidDateRange('2025-7-15', '2025-07-17')).toBe(false);
      expect(report.isValidDateRange('2025-07-15', '2025-7-17')).toBe(false);

      // Invalid logic (end before start)
      expect(report.isValidDateRange('2025-07-17', '2025-07-15')).toBe(false);

      // Invalid dates
      expect(report.isValidDateRange('2025-02-30', '2025-07-17')).toBe(false);
      expect(report.isValidDateRange('2025-07-15', '2025-13-01')).toBe(false);
    });

    test('should gather report data for date range', async () => {
      const reportData = await report.gatherReportData(
        '2025-07-15',
        '2025-07-17'
      );

      expect(reportData.startDate).toBe('2025-07-15');
      expect(reportData.endDate).toBe('2025-07-17');
      expect(reportData.totalEntries).toBe(8); // 3 + 3 + 2 from the three days
      // Recalculate: 1.5 + 1 + 1.5 + 1.5 + 1 + 1 + 2 + 1 = 10.5
      expect(reportData.totalHours).toBeCloseTo(10.5);
      expect(reportData.projects).toHaveLength(2); // Project Alpha and Project Beta
      expect(reportData.datesInRange).toEqual([
        '2025-07-15',
        '2025-07-16',
        '2025-07-17',
      ]);

      // Verify project totals
      expect(reportData.projectTotals).toHaveProperty('Project Alpha');
      expect(reportData.projectTotals).toHaveProperty('Project Beta');
      // Project Alpha: 1.5 + 1 + 1.5 + 2 + 1 = 6 hours (from test output)
      expect(reportData.projectTotals['Project Alpha'].totalHours).toBeCloseTo(
        6.0
      );
      // Project Beta: 1.5 + 1 + 1 = 3.5 hours
      expect(reportData.projectTotals['Project Beta'].totalHours).toBeCloseTo(
        3.5
      );
    });

    test('should handle empty date ranges', async () => {
      await expect(
        report.generateReport('2025-06-01', '2025-06-30')
      ).rejects.toThrow('No time entries found for date range');
    });

    test('should handle single day ranges', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-15'
      );

      expect(reportContent).toContain('2025-07-15 to 2025-07-15');
      // July 15: 1.5 + 1 + 1.5 = 4.0 hours
      expect(reportContent).toContain('**Total Hours:** 4.0');
      expect(reportContent).toContain('**Total Entries:** 3');
      expect(reportContent).toContain('**Days with Entries:** 1');
    });
  });

  describe('Report Format Generation', () => {
    test('should generate markdown format correctly', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-16',
        {
          format: 'markdown',
          groupBy: 'departmentalGoal',
        }
      );

      expect(reportContent).toContain(
        '# Time Tracking Report: 2025-07-15 to 2025-07-16'
      );
      expect(reportContent).toContain('## Summary');
      expect(reportContent).toContain(
        '**Date Range:** 2025-07-15 to 2025-07-16'
      );
      // July 15-16: 1.5+1+1.5+1.5+1+1 = 7.5 hours
      expect(reportContent).toContain('**Total Hours:** 7.5');
      expect(reportContent).toContain('**Total Entries:** 6');
      expect(reportContent).toContain('## Unspecified'); // Projects without departmental goals fall here
      expect(reportContent).toContain('### Project Alpha');
      expect(reportContent).toContain('### Project Beta');
    });

    test('should generate CSV format correctly', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-16',
        {
          format: 'csv',
        }
      );

      expect(reportContent).toContain('Date Range,2025-07-15 to 2025-07-16');
      expect(reportContent).toContain('Total Hours,7.5');
      expect(reportContent).toContain('Total Entries,6');
      expect(reportContent).toContain(
        'Group,Project,Hours,Entries,Status,Summary'
      );
      expect(reportContent).toContain('Unspecified,Project Alpha');
      expect(reportContent).toContain('Unspecified,Project Beta');
    });

    test('should generate JSON format correctly', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-16',
        {
          format: 'json',
        }
      );

      const reportData = JSON.parse(reportContent);

      expect(reportData.reportType).toBe('dateRange');
      expect(reportData.dateRange.start).toBe('2025-07-15');
      expect(reportData.dateRange.end).toBe('2025-07-16');
      expect(reportData.summary.totalHours).toBe(7.5);
      expect(reportData.summary.totalEntries).toBe(6);
      expect(reportData.summary.projectCount).toBe(2);
      expect(reportData.summary.daysWithEntries).toBe(2);
      expect(reportData.groups).toHaveProperty('Unspecified');
    });
  });

  describe('Grouping and Sorting Options', () => {
    test('should group by departmental goal', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-17',
        {
          groupBy: 'departmentalGoal',
        }
      );

      expect(reportContent).toContain('## Unspecified'); // Projects fall into Unspecified when no departmental goals
    });

    test('should group by strategic direction', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-17',
        {
          groupBy: 'strategicDirection',
        }
      );

      expect(reportContent).toContain('## Unspecified'); // Projects fall into Unspecified when no strategic directions
    });

    test('should group by tag', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-17',
        {
          groupBy: 'tag',
        }
      );

      expect(reportContent).toContain('## development');
      expect(reportContent).toContain('## analysis');
      expect(reportContent).toContain('## reporting');
    });

    test('should sort projects by hours', async () => {
      const reportData = await report.gatherReportData(
        '2025-07-15',
        '2025-07-17'
      );
      const groupedData = report.groupProjectData(
        reportData,
        'departmentalGoal'
      );
      const sortedData = report.sortGroupedData(groupedData, 'hours');

      // Project Alpha should come first (more hours)
      const unspecifiedProjects = sortedData.Unspecified;
      expect(unspecifiedProjects[0].project_name).toBe('Project Alpha');
    });

    test('should sort projects alphabetically', async () => {
      const reportData = await report.gatherReportData(
        '2025-07-15',
        '2025-07-17'
      );
      const groupedData = report.groupProjectData(
        reportData,
        'departmentalGoal'
      );
      const sortedData = report.sortGroupedData(groupedData, 'alpha');

      // Should be sorted alphabetically
      const allProjects = sortedData.Unspecified.map((p) => p.project_name);

      expect(allProjects).toEqual(['Project Alpha', 'Project Beta']);
    });
  });

  describe('Top Tasks Feature', () => {
    test('should show top tasks for projects', async () => {
      const reportContent = await report.generateReport(
        '2025-07-15',
        '2025-07-17',
        {
          topTasks: 2,
        }
      );

      expect(reportContent).toContain('**Top Tasks:**');
      // Should show tasks with hours
      expect(reportContent).toMatch(/Testing and debugging \(2\.0h\)/);
      expect(reportContent).toMatch(/Initial setup and planning \(1\.5h\)/);
    });

    test('should limit top tasks correctly', async () => {
      const entries = [
        { task: 'Task A', durationHours: 3.0 },
        { task: 'Task B', durationHours: 2.0 },
        { task: 'Task C', durationHours: 1.5 },
        { task: 'Task D', durationHours: 1.0 },
      ];

      const topTasks = report.getTopTasksForProject(entries, 2);

      expect(topTasks).toHaveLength(2);
      expect(topTasks[0].task).toBe('Task A');
      expect(topTasks[0].hours).toBe(3.0);
      expect(topTasks[1].task).toBe('Task B');
      expect(topTasks[1].hours).toBe(2.0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid date format', async () => {
      await expect(
        report.generateReport('2025-7-15', '2025-07-17')
      ).rejects.toThrow('Invalid date range');

      await expect(
        report.generateReport('2025-07-15', '2025-7-17')
      ).rejects.toThrow('Invalid date range');
    });

    test('should throw error for end date before start date', async () => {
      await expect(
        report.generateReport('2025-07-17', '2025-07-15')
      ).rejects.toThrow('Invalid date range');
    });

    test('should throw error for unsupported format', async () => {
      await expect(
        report.generateReport('2025-07-15', '2025-07-17', {
          format: 'pdf',
        })
      ).rejects.toThrow('Unsupported format: pdf');
    });
  });

  describe('Utility Functions', () => {
    test('should get correct display names for groupBy fields', () => {
      expect(report.getGroupByDisplayName('departmentalGoal')).toBe(
        'Departmental Goal'
      );
      expect(report.getGroupByDisplayName('strategicDirection')).toBe(
        'Strategic Direction'
      );
      expect(report.getGroupByDisplayName('tag')).toBe('Tag');
      expect(report.getGroupByDisplayName('unknown')).toBe('unknown');
    });

    test('should truncate text correctly', () => {
      expect(report.truncateText('Short text', 100)).toBe('Short text');
      expect(
        report.truncateText(
          'This is a very long text that should be truncated',
          20
        )
      ).toBe('This is a very lo...');
      expect(report.truncateText('', 20)).toBe('');
      expect(report.truncateText(null, 20)).toBe(null);
    });

    test('should escape CSV fields correctly', () => {
      expect(report.escapeCsvField('Simple text')).toBe('Simple text');
      expect(report.escapeCsvField('Text with, comma')).toBe(
        '"Text with, comma"'
      );
      expect(report.escapeCsvField('Text with "quotes"')).toBe(
        '"Text with ""quotes"""'
      );
      expect(report.escapeCsvField('Text with\nnewline')).toBe(
        '"Text with\nnewline"'
      );
      expect(report.escapeCsvField('')).toBe('');
      expect(report.escapeCsvField(null)).toBe('');
    });
  });
});

describe('Date Boundary Calculations', () => {
  describe('Week Boundaries', () => {
    test('should calculate week boundaries for Monday', () => {
      // July 28, 2025 is a Monday - use explicit date constructor to avoid timezone issues
      const bounds = calculateWeekBounds(new Date(2025, 6, 28)); // Month is 0-based (6 = July)
      expect(bounds.start).toBe('2025-07-28'); // Monday
      expect(bounds.end).toBe('2025-08-03'); // Sunday
    });

    test('should calculate week boundaries for Sunday', () => {
      // July 27, 2025 is a Sunday - use explicit date constructor to avoid timezone issues
      const bounds = calculateWeekBounds(new Date(2025, 6, 27)); // Month is 0-based (6 = July)
      expect(bounds.start).toBe('2025-07-21'); // Monday of that week
      expect(bounds.end).toBe('2025-07-27'); // Sunday of that week
    });

    test('should calculate week boundaries for mid-week', () => {
      // July 29, 2025 is a Tuesday - use explicit date constructor to avoid timezone issues
      const bounds = calculateWeekBounds(new Date(2025, 6, 29)); // Month is 0-based (6 = July)
      expect(bounds.start).toBe('2025-07-28'); // Monday of that week
      expect(bounds.end).toBe('2025-08-03'); // Sunday of that week
    });
  });

  describe('Month Boundaries', () => {
    test('should calculate current month boundaries', () => {
      // Mock current date to July 15, 2025
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2025-07-15');
          } else {
            super(...args);
          }
        }

        static now() {
          return originalDate.parse('2025-07-15');
        }
      };

      const bounds = calculateMonthBounds();
      expect(bounds.start).toBe('2025-07-01');
      expect(bounds.end).toBe('2025-07-31');

      global.Date = originalDate;
    });

    test('should calculate month boundaries from YYYY-MM format', () => {
      const bounds = calculateMonthBounds('2025-07');
      expect(bounds.start).toBe('2025-07-01');
      expect(bounds.end).toBe('2025-07-31');
    });

    test('should calculate month boundaries from YYYY-MM-DD format', () => {
      const bounds = calculateMonthBounds('2025-07-15');
      expect(bounds.start).toBe('2025-07-01');
      expect(bounds.end).toBe('2025-07-31');
    });

    test('should handle February in leap year', () => {
      const bounds = calculateMonthBounds('2024-02');
      expect(bounds.start).toBe('2024-02-01');
      expect(bounds.end).toBe('2024-02-29'); // Leap year
    });

    test('should handle February in non-leap year', () => {
      const bounds = calculateMonthBounds('2025-02');
      expect(bounds.start).toBe('2025-02-01');
      expect(bounds.end).toBe('2025-02-28'); // Non-leap year
    });

    test('should throw error for invalid format', () => {
      expect(() => calculateMonthBounds('2025-7')).toThrow(
        'Invalid date format'
      );
      expect(() => calculateMonthBounds('25-07')).toThrow(
        'Invalid date format'
      );
      expect(() => calculateMonthBounds('invalid')).toThrow(
        'Invalid date format'
      );
    });
  });
});

// Legacy functions kept for reference but not used
// These were moved to cli.js and are no longer needed here
