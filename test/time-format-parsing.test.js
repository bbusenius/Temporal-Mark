/**
 * @fileoverview Tests for time format parsing and validation
 * Ensures only properly zero-padded time formats are accepted,
 * with warnings for non-zero-padded entries that need fixing
 */

const fs = require('fs');
const path = require('path');
const TimeDataParser = require('../scripts/computeTimeData');

describe('Time Format Parsing and Validation', () => {
  let parser;

  beforeEach(() => {
    parser = new TimeDataParser();
  });

  describe('Strict zero-padding requirement', () => {
    test('should parse properly zero-padded time entries', () => {
      const line = '- **09:00-09:35**: test task [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('09:00'); // start time
      expect(match[2]).toBe('09:35'); // end time
      expect(match[3]).toBe('test task'); // task
      expect(match[4]).toBe('Test Project'); // project
      expect(match[5]).toBe('test'); // tags
    });

    test('should NOT parse time entries with inconsistent zero-padding (start padded, end not)', () => {
      const line = '- **09:00-9:35**: test task [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeFalsy(); // Should not match strict regex
    });

    test('should NOT parse time entries with inconsistent zero-padding (both not padded)', () => {
      const line = '- **9:00-9:35**: test task [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeFalsy(); // Should not match strict regex
    });

    test('should NOT parse time entries with mixed zero-padding (start not padded, end padded)', () => {
      const line = '- **9:00-09:35**: test task [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeFalsy(); // Should not match strict regex
    });

    test('should NOT parse time entries with afternoon times and mixed padding', () => {
      const line = '- **14:30-5:00**: test task [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeFalsy(); // Should not match strict regex
    });

    test('should NOT handle active entries with mixed padding', () => {
      const line =
        '- **9:45-[ACTIVE]**: currently working [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeFalsy(); // Should not match strict regex
    });

    test('should handle active entries with proper padding', () => {
      const line =
        '- **09:45-[ACTIVE]**: currently working [[Test Project]] [test]';
      const match = line.match(parser.timeEntryRegex);

      expect(match).toBeTruthy();
      expect(match[1]).toBe('09:45'); // start time
      expect(match[2]).toBe('[ACTIVE]'); // end time
    });
  });

  describe('Non-zero-padded time detection and warnings', () => {
    test('should detect non-zero-padded start time', () => {
      const line = '- **9:00-09:35**: test task [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeTruthy();
      expect(warning.issues).toContain(
        'start time "9:00" should be zero-padded'
      );
      expect(warning.suggestion).toBe(
        '- **09:00-09:35**: test task [[Test Project]] [test]'
      );
    });

    test('should detect non-zero-padded end time', () => {
      const line = '- **09:00-9:35**: test task [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeTruthy();
      expect(warning.issues).toContain('end time "9:35" should be zero-padded');
      expect(warning.suggestion).toBe(
        '- **09:00-09:35**: test task [[Test Project]] [test]'
      );
    });

    test('should detect both non-zero-padded times', () => {
      const line = '- **9:00-9:35**: test task [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeTruthy();
      expect(warning.issues).toHaveLength(2);
      expect(warning.issues).toContain(
        'start time "9:00" should be zero-padded'
      );
      expect(warning.issues).toContain('end time "9:35" should be zero-padded');
      expect(warning.suggestion).toBe(
        '- **09:00-09:35**: test task [[Test Project]] [test]'
      );
    });

    test('should not warn for properly zero-padded times', () => {
      const line = '- **09:00-09:35**: test task [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeNull();
    });

    test('should not warn for active entries with proper padding', () => {
      const line =
        '- **09:45-[ACTIVE]**: currently working [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeNull();
    });

    test('should warn for active entries with improper start time padding', () => {
      const line =
        '- **9:45-[ACTIVE]**: currently working [[Test Project]] [test]';
      const warning = parser.checkForNonZeroPaddedTimes(line);

      expect(warning).toBeTruthy();
      expect(warning.issues).toContain(
        'start time "9:45" should be zero-padded'
      );
    });
  });

  describe('Full time log parsing with strict validation', () => {
    test('should only parse properly formatted entries and warn about others', () => {
      const timeLogContent = `# Time Log 2025-2026

### 2025-07-31
- **09:00-9:35**: should warn about end time [[Test Project]] [testing]
- **9:35-10:35**: should warn about start time [[Other Project]] [work]
- **10:35-11:00**: properly formatted [[Test Project]] [final]
- **11:00-11:45**: also properly formatted [[Test Project]] [last]`;

      const tempFile = path.join(__dirname, 'temp-test-log.md');

      try {
        fs.writeFileSync(tempFile, timeLogContent);

        // Capture console warnings
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (message) => warnings.push(message);

        const entries = parser.parseTimeLogFile(tempFile);
        const july31Entries = entries.filter((e) => e.date === '2025-07-31');

        // Restore console.warn
        console.warn = originalWarn;

        // Should only parse the 2 properly formatted entries
        expect(july31Entries).toHaveLength(2);
        expect(july31Entries[0].startTime).toBe('10:35');
        expect(july31Entries[0].endTime).toBe('11:00');
        expect(july31Entries[1].startTime).toBe('11:00');
        expect(july31Entries[1].endTime).toBe('11:45');

        // Should have generated warnings for the 2 improperly formatted entries
        expect(warnings.length).toBeGreaterThan(0);
        expect(
          warnings.some((w) => w.includes('Non-zero-padded time format'))
        ).toBeTruthy();
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });

  describe('Edge cases and validation', () => {
    test('should reject invalid time formats', () => {
      const invalidLines = [
        '- **25:00-09:35**: invalid hour [[Test]] [test]',
        '- **09:60-10:35**: invalid minute [[Test]] [test]',
        '- **9-10:35**: missing colon [[Test]] [test]',
        '- **09:00-**: missing end time [[Test]] [test]',
      ];

      invalidLines.forEach((line) => {
        const match = line.match(parser.timeEntryRegex);
        if (match) {
          const [, startTime, endTime] = match;
          if (startTime !== '[ACTIVE]' && endTime !== '[ACTIVE]') {
            expect(
              parser.isValidTime(startTime) && parser.isValidTime(endTime)
            ).toBeFalsy();
          }
        }
      });
    });

    test('should handle edge case times correctly', () => {
      const edgeCases = [
        '- **00:00-01:00**: midnight hour [[Test]] [test]',
        '- **23:59-00:30**: overnight [[Test]] [test]',
        '- **12:00-12:30**: noon [[Test]] [test]',
      ];

      edgeCases.forEach((line) => {
        const match = line.match(parser.timeEntryRegex);
        expect(match).toBeTruthy();
      });
    });
  });

  describe('Date header parsing with trailing spaces', () => {
    test('should parse date headers with trailing spaces', () => {
      const dateHeaders = [
        '### 2025-08-16',
        '### 2025-08-16 ',
        '### 2025-08-16  ',
        '### 2025-08-16\t',
      ];

      dateHeaders.forEach((header) => {
        const match = header.match(parser.dateHeaderRegex);
        expect(match).toBeTruthy();
        expect(match[1]).toBe('2025-08-16');
      });
    });

    test('should correctly parse time log with trailing spaces in date headers', () => {
      const timeLogContent = `# Time Log 2025-2026

### 2025-08-15
- **09:00-10:15**: task on 15th [[Test Project]] [testing]

### 2025-08-16 
- **10:00-13:45**: task on 16th with trailing space [[Test Project]] [testing]

### 2025-08-17  
- **14:00-15:00**: task on 17th with multiple trailing spaces [[Test Project]] [testing]`;

      const tempFile = path.join(__dirname, 'temp-trailing-space-test.md');

      try {
        fs.writeFileSync(tempFile, timeLogContent);
        const entries = parser.parseTimeLogFile(tempFile);

        const aug15Entries = entries.filter((e) => e.date === '2025-08-15');
        const aug16Entries = entries.filter((e) => e.date === '2025-08-16');
        const aug17Entries = entries.filter((e) => e.date === '2025-08-17');

        expect(aug15Entries).toHaveLength(1);
        expect(aug16Entries).toHaveLength(1);
        expect(aug17Entries).toHaveLength(1);

        expect(aug15Entries[0].startTime).toBe('09:00');
        expect(aug16Entries[0].startTime).toBe('10:00');
        expect(aug17Entries[0].startTime).toBe('14:00');
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      }
    });
  });
});
