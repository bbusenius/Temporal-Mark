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

  test('should parse task descriptions containing dashes correctly', async () => {
    const testContent = `# Time Log 2025-2026

## October 2025

### 2025-10-21
- **08:30-10:30**: email, merged PR for alert on loop pages and deployed, updates to the staff directory, emailed EE, read about Anthropic skills [[Non-Project]]
- **14:30-15:45**: Fixed CSS positioning issue for availability status display in VuFind - status was displaying out of flow in list views due to absolute positioning. Updated phoenix theme record.less to use absolute positioning for search results but static positioning for list views. [[VuFind]] [css, bug-fix]`;

    // Write test content to temp file
    fs.writeFileSync(tempFile, testContent, 'utf8');

    // Parse the file
    const entries = parser.parseTimeLogFile(tempFile);

    // Should find 2 entries
    expect(entries).toHaveLength(2);

    // First entry should be parsed correctly
    const firstEntry = entries[0];
    expect(firstEntry.startTime).toBe('08:30');
    expect(firstEntry.endTime).toBe('10:30');
    expect(firstEntry.task).toBe(
      'email, merged PR for alert on loop pages and deployed, updates to the staff directory, emailed EE, read about Anthropic skills'
    );
    expect(firstEntry.project).toBe('Non-Project');
    expect(firstEntry.tags).toEqual([]);

    // Second entry with dash in task description should be parsed correctly
    // This is the problematic case - the dash between "VuFind" and "status"
    // should NOT cause the regex to misparse project and tags
    const secondEntry = entries[1];
    expect(secondEntry.startTime).toBe('14:30');
    expect(secondEntry.endTime).toBe('15:45');
    expect(secondEntry.task).toBe(
      'Fixed CSS positioning issue for availability status display in VuFind - status was displaying out of flow in list views due to absolute positioning. Updated phoenix theme record.less to use absolute positioning for search results but static positioning for list views.'
    );
    expect(secondEntry.project).toBe('VuFind');
    expect(secondEntry.tags).toEqual(['css', 'bug-fix']);
  });

  test('should parse task descriptions with square brackets correctly', async () => {
    const testContent = `# Time Log 2025-2026

## October 2025

### 2025-10-22
- **09:00-10:00**: Fixed issue [JIRA-123] in authentication module [[Security Project]] [bug-fix, auth]
- **10:00-11:00**: Array[0] was returning null in parser [[Temporal Mark]] [bug-fix]
- **11:00-12:00**: Updated [[Component]] reference in documentation [[Documentation]] [docs]
- **12:00-13:00**: Reviewed code [PR #456] and merged changes [[Code Review]] [review]`;

    // Write test content to temp file
    fs.writeFileSync(tempFile, testContent, 'utf8');

    // Parse the file
    const entries = parser.parseTimeLogFile(tempFile);

    // Should find 4 entries
    expect(entries).toHaveLength(4);

    // First entry: square bracket in task description [JIRA-123]
    const firstEntry = entries[0];
    expect(firstEntry.startTime).toBe('09:00');
    expect(firstEntry.endTime).toBe('10:00');
    expect(firstEntry.task).toBe(
      'Fixed issue [JIRA-123] in authentication module'
    );
    expect(firstEntry.project).toBe('Security Project');
    expect(firstEntry.tags).toEqual(['bug-fix', 'auth']);

    // Second entry: Array[0] notation in task
    const secondEntry = entries[1];
    expect(secondEntry.startTime).toBe('10:00');
    expect(secondEntry.endTime).toBe('11:00');
    expect(secondEntry.task).toBe('Array[0] was returning null in parser');
    expect(secondEntry.project).toBe('Temporal Mark');
    expect(secondEntry.tags).toEqual(['bug-fix']);

    // Third entry: double square brackets [[Component]] in task
    const thirdEntry = entries[2];
    expect(thirdEntry.startTime).toBe('11:00');
    expect(thirdEntry.endTime).toBe('12:00');
    expect(thirdEntry.task).toBe(
      'Updated [[Component]] reference in documentation'
    );
    expect(thirdEntry.project).toBe('Documentation');
    expect(thirdEntry.tags).toEqual(['docs']);

    // Fourth entry: square brackets [PR #456] in task
    const fourthEntry = entries[3];
    expect(fourthEntry.startTime).toBe('12:00');
    expect(fourthEntry.endTime).toBe('13:00');
    expect(fourthEntry.task).toBe('Reviewed code [PR #456] and merged changes');
    expect(fourthEntry.project).toBe('Code Review');
    expect(fourthEntry.tags).toEqual(['review']);
  });
});
