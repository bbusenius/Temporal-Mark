/**
 * @fileoverview Tests for month header logic issues in TimeTracker
 * These tests specifically target the timezone and month header generation bugs
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const TimeTracker = require('../scripts/timeTracker');

describe('TimeTracker Month Header Logic', () => {
  let timeTracker;
  let testDir;
  let testFilePath;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(__dirname, 'temp_month_header_test');
    if (!fsSync.existsSync(testDir)) {
      await fs.mkdir(testDir, { recursive: true });
    }

    // Setup TimeTracker with custom paths for testing
    timeTracker = new TimeTracker({ silent: true });

    // Override the file path resolution for testing
    testFilePath = path.join(testDir, 'time-log-2025-2026.md');
    timeTracker.getTestFilePath = () => testFilePath;
    timeTracker.getTimeLogsDir = () => testDir;
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      if (fsSync.existsSync(testDir)) {
        await fs.rmdir(testDir, { recursive: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Date Parsing and Month Header Generation', () => {
    test('should generate correct month for August 1st (timezone issue)', async () => {
      // This test should FAIL with current code due to timezone parsing bug
      const date = '2025-08-01';

      await timeTracker.startEntry({
        task: 'Test task',
        date,
        start: '09:00',
      });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Should contain "August 2025" not "July 2025"
      expect(content).toContain('## August 2025');
      expect(content).not.toContain('## July 2025');
    });

    test('should generate correct month for December 31st', async () => {
      const date = '2025-12-31';

      await timeTracker.startEntry({
        task: 'Test task',
        date,
        start: '09:00',
      });

      const content = await fs.readFile(testFilePath, 'utf8');

      expect(content).toContain('## December 2025');
      expect(content).not.toContain('## November 2025');
    });

    test('should generate correct month for January 1st', async () => {
      const date = '2026-01-01';

      await timeTracker.startEntry({
        task: 'Test task',
        date,
        start: '09:00',
      });

      const content = await fs.readFile(testFilePath, 'utf8');

      expect(content).toContain('## January 2026');
      expect(content).not.toContain('## December 2025');
    });

    test('should handle various timezone-sensitive dates correctly', async () => {
      const testDates = [
        { date: '2025-08-01', expectedMonth: 'August 2025' },
        { date: '2025-09-01', expectedMonth: 'September 2025' },
        { date: '2025-10-01', expectedMonth: 'October 2025' },
        { date: '2025-11-01', expectedMonth: 'November 2025' },
        { date: '2025-12-01', expectedMonth: 'December 2025' },
        { date: '2026-01-01', expectedMonth: 'January 2026' },
      ];

      for (const testCase of testDates) {
        // Clean file for each test
        if (fsSync.existsSync(testFilePath)) {
          await fs.unlink(testFilePath);
        }

        await timeTracker.startEntry({
          task: `Test task for ${testCase.date}`,
          date: testCase.date,
          start: '09:00',
        });

        const content = await fs.readFile(testFilePath, 'utf8');

        expect(content).toContain(`## ${testCase.expectedMonth}`);

        await timeTracker.finishEntry({ end: '10:00' });
      }
    });
  });

  describe('Month Header Logic - Only Add When Needed', () => {
    test('should only add month header once for same month', async () => {
      // Add first entry in August
      await timeTracker.startEntry({
        task: 'First August task',
        date: '2025-08-01',
        start: '09:00',
      });
      await timeTracker.finishEntry({ end: '10:00' });

      // Add second entry in same month
      await timeTracker.startEntry({
        task: 'Second August task',
        date: '2025-08-15',
        start: '11:00',
      });
      await timeTracker.finishEntry({ end: '12:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Should only have one August header
      const augustHeaders = (content.match(/## August 2025/g) || []).length;
      expect(augustHeaders).toBe(1);
    });

    test('should add new month header when entering new month', async () => {
      // Add entry in August
      await timeTracker.startEntry({
        task: 'August task',
        date: '2025-08-01',
        start: '09:00',
      });
      await timeTracker.finishEntry({ end: '10:00' });

      // Add entry in September
      await timeTracker.startEntry({
        task: 'September task',
        date: '2025-09-01',
        start: '09:00',
      });
      await timeTracker.finishEntry({ end: '10:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Should have both month headers
      expect(content).toContain('## August 2025');
      expect(content).toContain('## September 2025');

      // Should have exactly one of each
      const augustHeaders = (content.match(/## August 2025/g) || []).length;
      const septemberHeaders = (content.match(/## September 2025/g) || [])
        .length;
      expect(augustHeaders).toBe(1);
      expect(septemberHeaders).toBe(1);
    });

    test('should not add duplicate month header when date already exists', async () => {
      // Manually create file with existing August entry
      const existingContent = `# Time Log 2025-2026

## August 2025

### 2025-08-01
- **08:00-09:00**: Existing task [[Project]] [tag]
`;
      await fs.writeFile(testFilePath, existingContent, 'utf8');

      // Add new entry for same date
      await timeTracker.startEntry({
        task: 'New task same date',
        date: '2025-08-01',
        start: '10:00',
      });
      await timeTracker.finishEntry({ end: '11:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Should still only have one August header
      const augustHeaders = (content.match(/## August 2025/g) || []).length;
      expect(augustHeaders).toBe(1);
    });

    test('should not add month header when date section exists but no month header needed', async () => {
      // This test should FAIL with current code - it adds month headers unnecessarily

      // Manually create file with existing August entry but no month header
      const existingContent = `# Time Log 2025-2026

### 2025-08-01
- **08:00-09:00**: Existing task [[Project]] [tag]
`;
      await fs.writeFile(testFilePath, existingContent, 'utf8');

      // Add new entry for different date in same month
      await timeTracker.startEntry({
        task: 'New task different date',
        date: '2025-08-15',
        start: '10:00',
      });
      await timeTracker.finishEntry({ end: '11:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Current code will incorrectly add a month header
      // After fix, this should pass - no month header should be added
      // since we already have an August entry
      const augustHeaders = (content.match(/## August 2025/g) || []).length;
      expect(augustHeaders).toBe(0); // Should not add month header unnecessarily
    });
  });

  describe('Month Header Format Consistency', () => {
    test('should use consistent month header format', async () => {
      const testCases = [
        { date: '2025-08-01', expected: '## August 2025' },
        { date: '2025-12-01', expected: '## December 2025' },
        { date: '2026-01-01', expected: '## January 2026' },
        { date: '2026-02-01', expected: '## February 2026' },
      ];

      for (const testCase of testCases) {
        // Clean file for each test
        if (fsSync.existsSync(testFilePath)) {
          await fs.unlink(testFilePath);
        }

        await timeTracker.startEntry({
          task: 'Test task',
          date: testCase.date,
          start: '09:00',
        });

        const content = await fs.readFile(testFilePath, 'utf8');
        expect(content).toContain(testCase.expected);

        await timeTracker.finishEntry({ end: '10:00' });
      }
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle leap year February correctly', async () => {
      const date = '2024-02-29'; // Leap year

      await timeTracker.startEntry({
        task: 'Leap year test',
        date,
        start: '09:00',
      });

      const content = await fs.readFile(testFilePath, 'utf8');
      expect(content).toContain('## February 2024');
    });

    test('should handle month transitions correctly', async () => {
      // Add entry at end of month
      await timeTracker.startEntry({
        task: 'End of July',
        date: '2025-07-31',
        start: '09:00',
      });
      await timeTracker.finishEntry({ end: '10:00' });

      // Add entry at start of next month
      await timeTracker.startEntry({
        task: 'Start of August',
        date: '2025-08-01',
        start: '09:00',
      });
      await timeTracker.finishEntry({ end: '10:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      expect(content).toContain('## July 2025');
      expect(content).toContain('## August 2025');

      // Verify order (July should come before August)
      const julyIndex = content.indexOf('## July 2025');
      const augustIndex = content.indexOf('## August 2025');
      expect(julyIndex).toBeLessThan(augustIndex);
    });
  });

  describe('Existing File Scenarios', () => {
    test('should handle file with mixed month header formats', async () => {
      // Create file with inconsistent existing headers
      const existingContent = `# Time Log 2025-2026

## July

### 2025-07-15
- **08:00-09:00**: Old July task [[Project]] [tag]

## August 2025

### 2025-08-10
- **08:00-09:00**: Old August task [[Project]] [tag]
`;
      await fs.writeFile(testFilePath, existingContent, 'utf8');

      // Add new entry for September
      await timeTracker.startEntry({
        task: 'New September task',
        date: '2025-09-01',
        start: '10:00',
      });
      await timeTracker.finishEntry({ end: '11:00' });

      const content = await fs.readFile(testFilePath, 'utf8');

      // Should preserve existing headers and add new one
      expect(content).toContain('## July');
      expect(content).toContain('## August 2025');
      expect(content).toContain('## September 2025');
    });
  });
});
