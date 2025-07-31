/**
 * @fileoverview Tests for time log parsing edge cases
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const TimeDataParser = require('../scripts/computeTimeData');

describe('Time Log Parsing Edge Cases', () => {
  let parser;
  let tempFile;

  beforeEach(() => {
    parser = new TimeDataParser();
    // Create a temporary file for testing
    tempFile = path.join(os.tmpdir(), `test-log-${Date.now()}.md`);
  });

  afterEach(() => {
    // Clean up temporary file after each test
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  test('should parse time entry with trailing spaces after tags', async () => {
    const testContent = `# Time Log 2025-2026

## July 2025

### 2025-07-31
- **10:35-11:00**: converted current working hours files to the new format and tested [[Temporal Mark]] [testing, development] 
- **11:00-12:00**: another test entry [[Test Project]] [test]`;

    // Write test content to temp file
    fs.writeFileSync(tempFile, testContent, 'utf8');

    // Parse the file
    const entries = parser.parseTimeLogFile(tempFile);

    // Should find 2 entries
    expect(entries).toHaveLength(2);

    // First entry should be properly parsed despite trailing space after tags
    const firstEntry = entries[0];
    expect(firstEntry.startTime).toBe('10:35');
    expect(firstEntry.endTime).toBe('11:00');
    expect(firstEntry.task).toBe(
      'converted current working hours files to the new format and tested'
    );
    expect(firstEntry.project).toBe('Temporal Mark');
    expect(firstEntry.tags).toEqual(['testing', 'development']);

    // Second entry should be parsed normally
    const secondEntry = entries[1];
    expect(secondEntry.startTime).toBe('11:00');
    expect(secondEntry.endTime).toBe('12:00');
    expect(secondEntry.task).toBe('another test entry');
    expect(secondEntry.project).toBe('Test Project');
    expect(secondEntry.tags).toEqual(['test']);
  });
});
