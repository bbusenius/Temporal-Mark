const fs = require('fs');
const path = require('path');
const DataIndexer = require('../scripts/dataIndexer');

function createTestLogger() {
  return {
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('MCP-safe logging', () => {
  const testDir = path.join(__dirname, 'fixtures/mcp-stdio-logging');
  const testDbPath = path.join(testDir, 'markdownDB.sqlite');
  const testProjectsDir = path.join(testDir, 'projects');
  const testTimeLogsDir = path.join(testDir, 'time-logs');

  let dataIndexer;
  let consoleLogSpy;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    fs.mkdirSync(testProjectsDir, { recursive: true });
    fs.mkdirSync(testTimeLogsDir, { recursive: true });

    fs.writeFileSync(
      path.join(testProjectsDir, 'test-project.md'),
      `---
project: Test Project
departmentalGoal: [Technology]
strategicDirection: [Innovation]
tags: [testing]
status: Active
startDate: 2025-07-01
---
## Summary
Test project.
`
    );

    fs.writeFileSync(
      path.join(testTimeLogsDir, 'time-log-2025-2026.md'),
      `# Time Log 2025-2026

### 2025-07-30
- **09:00-10:00**: Test task [[Test Project]] [testing]
`
    );

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (dataIndexer) {
      await dataIndexer.close();
      dataIndexer = null;
    }

    consoleLogSpy.mockRestore();

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('routes index progress through the injected logger', async () => {
    const logger = createTestLogger();
    dataIndexer = new DataIndexer(testDir, testDbPath, { logger });

    await dataIndexer.initialize({ skipAutoReindex: true });
    await dataIndexer.indexAllData();

    expect(logger.log).toHaveBeenCalledWith('Starting data indexing...');
    expect(logger.log).toHaveBeenCalledWith(
      'Clearing existing database data...'
    );
    expect(logger.log).toHaveBeenCalledWith('Indexing projects...');
    expect(logger.log).toHaveBeenCalledWith('Indexing time logs...');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });
});
