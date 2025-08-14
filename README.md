# Temporal Mark

A Markdown-based time tracking system for logging and analyzing work hours across projects, designed for individual use but universally accessible.

## Overview

Temporal Mark combines the simplicity of Markdown with the power of automated analysis. It stores time logs in human-readable Markdown files while providing a CLI interface for data entry and sophisticated reporting capabilities.

### Key Features

- **Markdown-based storage**: One file per fiscal year with simple, readable format
- **Project metadata**: YAML frontmatter with departmental goals and strategic directions
- **CLI interface**: Interactive prompts with non-interactive flags for automation
- **Automated analysis**: Duration calculations, gap detection, and overlap validation
- **Flexible reporting**: Group by projects, tags, or strategic goals with multiple output formats
- **Auto-reindexing**: Automatically detects file changes and keeps database in sync
- **Obsidian/Vim compatible**: Manual editing supported alongside CLI automation

📖 **For detailed usage instructions, see the [User Guide](docs/user-guide.md)**

## Quick Start

```bash
# Install dependencies
npm install

# Test the CLI structure
npm run tm -- --help

# Run automated tests
npm test                  # All tests (124 tests - all passing)

# Test the data layer (manual testing utility)
node test/manual-test-data-layer.js

# Run linting and formatting
npm run lint              # Check code style
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Prettier
```

## Documentation

- **[User Guide](docs/user-guide.md)** - Comprehensive guide covering all features and workflows
- **[MCP Setup Guide](docs/mcp-setup.md)** - AI assistant integration setup for Claude Code, Windsurf, etc.
- **[Scalability Planning](docs/scalability.md)** - Future multi-user architecture and implementation roadmap

## Project Structure

```
temporal-mark/
├── projects/                    # Project metadata files (YAML frontmatter)
│   ├── website-redesign-2025-2026.md
│   ├── non-project.md          # Convention for administrative tasks
│   └── unproductive.md         # Convention for breaks/non-work time
├── time-logs/                  # Time tracking files (one per fiscal year)
│   ├── time-log-2025-2026.md   # Current fiscal year
│   └── archive/                # Archived fiscal years (2+ years old)
├── scripts/                    # Core application modules
│   ├── cli.js                  # Main CLI entry point
│   ├── addEntry.js             # Entry creation with validation
│   ├── markdownDB.js           # SQLite database interface
│   ├── computeTimeData.js      # Time parsing and calculation utilities
│   ├── projectParser.js        # Project metadata parser
│   ├── dataIndexer.js          # Data indexing and querying engine
│   ├── wikiLinkValidator.js    # Wiki-link validation and auto-creation
│   ├── tagStandardizer.js      # Tag normalization and validation
│   ├── inputValidator.js       # Comprehensive input validation
│   ├── archiveManager.js       # Archive management and cleanup
│   ├── errorLogger.js          # Error logging and activity tracking
│   ├── reportFiscalYear.js     # Report generation
│   ├── apiServer.js            # REST API server for web integration
│   ├── startServer.js          # API server launcher script
│   ├── mcpIntegration.js       # Model Context Protocol integration layer
│   └── mcpServer.js            # MCP server for AI assistant integration
├── test/                       # Testing utilities and documentation
│   ├── manual-test-data-layer.js  # Manual testing script for data layer
│   └── phase4-manual-testing.md   # Comprehensive testing guide
├── db/                         # SQLite database files
│   └── markdownDB.sqlite       # Indexed data for fast querying
├── logs/                       # System logs with automatic rotation
│   ├── activity.log            # All system operations with context
│   └── errors.log              # Error and exception tracking
├── reports/                    # Generated reports (saved with --save flag)
└── package.json               # Dependencies and npm scripts
```

## Data Formats

### Time Log Entry Format

```markdown
### 2025-07-18

- **09:00-11:30**: Designed homepage [[Website Redesign 2025-2026]] [design, ui]
  - Notes: Focused on responsive layout for mobile devices.
```

### Project File Format

```markdown
---
project: Website Redesign 2025-2026
departmentalGoal: [Marketing, Technology]
strategicDirection: [CustomerEngagement, DigitalTransformation]
tags: [design, ui, web]
status: Active
startDate: 2025-07-01
---

## Summary

Redesign the company website to improve user experience and align with modern design standards.
```

## Wiki-Link Support

Projects are referenced using wiki-link syntax (`[[Project Name]]`) for Vim and Obsidian integration. The system provides wiki-link support:

### Features

- **Automatic validation**: Checks that all wiki-links point to existing project files
- **Auto-creation**: Creates project files automatically when referencing new projects
- **Smart suggestions**: Provides suggestions for misspelled or similar project names
- **Bulk validation**: Validates all wiki-links across all time log files
- **Interactive fixing**: Guides users through fixing invalid wiki-links

### Project File Auto-Creation

When you reference a project that doesn't exist (e.g., `[[New Project]]`), the system will:

1. Create a project file at `projects/New Project.md`
2. Generate default YAML frontmatter with basic metadata
3. Add the project to the cache for future validation

### Wiki-Link Commands

```bash
# List all available projects
npm run tm -- wiki --list-projects

# Validate wiki-links in a specific file
npm run tm -- wiki --validate time-logs/time-log-2025-2026.md

# Validate all wiki-links in all time logs
npm run tm -- wiki --validate-all

# Create a new project file
npm run tm -- wiki --create "My New Project"

# Get suggestions for similar project names
npm run tm -- wiki --suggestions "webste"

# Auto-fix wiki-links with suggestions
npm run tm -- wiki --fix time-logs/time-log-2025-2026.md
```

## Tag Standardization

The system enforces consistent tag formatting across all files to ensure data integrity and improve searchability.

### Tag Standards

- **Lowercase only**: All tags are converted to lowercase
- **No spaces**: Spaces are replaced with hyphens (`-`)
- **Alphanumeric + hyphens**: Only letters, numbers, and hyphens allowed
- **Length limits**: 2-30 characters
- **No leading/trailing hyphens**: Clean formatting

### Examples

```
"UI Design" → "ui-design"
"Bug Fix!" → "bug-fix"
"RESEARCH" → "research"
"web-dev" → "web-dev" (already valid)
```

### Automatic Standardization

- **Entry validation**: Tags are automatically normalized when adding entries
- **Bulk processing**: Standardize existing files with CLI commands
- **Validation warnings**: Shows original → normalized transformations
- **Error handling**: Invalid tags are logged with specific reasons

### Tag Commands

```bash
# Get comprehensive tag statistics
npm run tm -- tags --stats

# Generate migration report before standardization
npm run tm -- tags --report

# Standardize tags in specific file types
npm run tm -- tags --standardize-projects
npm run tm -- tags --standardize-timelogs

# Standardize all tags in all files
npm run tm -- tags --standardize-all

# Validate individual tags
npm run tm -- tags --validate "my-tag"
npm run tm -- tags --normalize "My Complex Tag Name!"
```

## Comprehensive Input Validation

The system provides extensive input validation with detailed error messages and helpful suggestions to ensure data quality and consistency.

### Validation Features

- **Field validation**: Required fields, format checking, length limits
- **Data type validation**: Dates, times, fiscal years, project names
- **Logical validation**: Time ranges, overlaps, future dates
- **Content validation**: Wiki-links, tags, special characters
- **Interactive feedback**: Clear error messages with suggestions
- **Batch validation**: Validate multiple entries from JSON files

### Validation Categories

#### **Errors** (❌) - Must be fixed

- Invalid formats (dates, times, fiscal years)
- Missing required fields
- Time overlaps with existing entries
- Invalid time ranges (end before start)
- Field length violations

#### **Warnings** (⚠️) - Should be reviewed

- Future dates or unusual hours
- Very short/long durations
- Missing project files (auto-created)
- Non-standard tags (auto-normalized)
- Adjacent time entries

#### **Info** (ℹ️) - Informational

- Wiki-link detection in text
- Tag normalization applied
- Project file creation

### Validation Commands

```bash
# Validate individual components
npm run tm -- validate --date "2025-13-45"      # Invalid date
npm run tm -- validate --time "25:70"           # Invalid time
npm run tm -- validate --fiscal-year "2025-2024" # Invalid fiscal year

# Validate complete entry (JSON format)
npm run tm -- validate --entry '{"date":"2025-07-29","startTime":"09:00","endTime":"08:00","task":"Test","project":"Demo"}'

# Batch validate from file
npm run tm -- validate --file batch-entries.json

# Example JSON file format:
[
  {
    "date": "2025-07-29",
    "startTime": "09:00",
    "endTime": "10:30",
    "task": "Design work on [[New Feature]]",
    "project": "Website Redesign 2025-2026",
    "tags": ["Design", "UI/UX"],
    "notes": "Focused on mobile responsiveness"
  }
]
```

### Automatic Validation

All entries are automatically validated during creation with:

- Real-time format checking
- Overlap detection against existing entries
- Interactive confirmation for warnings
- Automatic tag normalization
- Project file creation for new projects

## Error Logging & Activity Tracking

The system maintains comprehensive logs of all operations for debugging and audit purposes.

### Log Types

- **Activity Log** (`logs/activity.log`): Records all system operations with detailed context
- **Error Log** (`logs/errors.log`): Records errors and exceptions with stack traces

### Logged Activities

- Entry validation results with detailed error/warning information
- Wiki-link cache loading and project creation
- Tag standardization operations
- Archive operations and file movements
- Database operations and indexing
- Project file creation and updates

### Log Rotation

- Automatic cleanup of old log entries
- Configurable retention periods
- Size-based rotation to prevent disk space issues

### Example Activity Log Entry

```json
{
  "timestamp": "2025-07-29T21:04:09.380Z",
  "event": "VALIDATION_WARNINGS",
  "details": {
    "warningCount": 2,
    "warnings": [
      {
        "field": "project",
        "type": "notFound",
        "message": "Project file does not exist",
        "severity": "warning",
        "value": "New Project",
        "suggestion": "Project file will be created automatically"
      }
    ],
    "operation": "ADD_ENTRY_VALIDATION"
  }
}
```

## Archive Management

The system includes robust archive management to handle old time logs while preserving historical data.

### Automatic Archiving

- **Cutoff Rule**: Files older than 2 years are automatically archived
- **Safe Operation**: Original files moved to `time-logs/archive/` directory
- **Preservation**: No data is ever deleted, only moved
- **Backup Cleanup**: Removes temporary backup files (ending in `_backup_`) older than 90 days

### Archive Features

- **Fiscal Year Detection**: Automatically determines fiscal year from filename
- **Selective Archiving**: Archive specific years or use automatic rules
- **File Restoration**: Restore archived files back to active directory
- **Archive Statistics**: View storage usage and file counts
- **Backup Management**: Clean up temporary backup files safely

### Archive Commands

```bash
# Auto-archive files older than 2 years
npm run tm -- archive --auto

# Archive a specific fiscal year
npm run tm -- archive --year 2020-2021

# List all archived files with metadata
npm run tm -- archive --list

# View archive statistics (file count, sizes, dates)
npm run tm -- archive --stats

# Restore a specific file from archive
npm run tm -- archive --restore time-log-2020-2021.md

# Clean up old backup files (90+ days old)
npm run tm -- archive --cleanup
```

### Safety Features

- **No Data Loss**: Archive operations never delete original data
- **Backup Files**: Temporary backups created during operations
- **Selective Cleanup**: Only removes files with `_backup_` in filename
- **Age Verification**: Multiple date checks before archiving
- **Detailed Logging**: All archive operations logged with full context

## CLI Commands

For complete command documentation and workflows, see the **[User Guide](docs/user-guide.md)**.

```bash
# Interactive time entry (comprehensive prompts with suggestions)
npm run tm -- add

# Non-interactive time entry (for automation)
npm run tm -- add --date 2025-07-18 --start 09:00 --end 11:30 --task "Design work" --project "Website Redesign 2025-2026"

# Interactive real-time time tracking (with project selection and tag suggestions)
npm run tm -- start
npm run tm -- finish --notes "Completed responsive layout"

# Non-interactive real-time time tracking
npm run tm -- start --task "Working on homepage design" --project "Website Redesign 2025-2026" --tags "design,ui"
npm run tm -- finish --notes "Completed responsive layout"

# Start with custom date/time
npm run tm -- start --task "Bug investigation" --project "Website Redesign 2025-2026" --date 2025-07-30 --start 14:30

# Daily view with gaps
npm run tm -- daily 2025-07-18

# Project summary
npm run tm -- project "Website Redesign 2025-2026"

# Tag summary
npm run tm -- tag design

# Fiscal year report
npm run tm -- report 2025-2026 --group-by strategicDirection --format markdown

# Date range reports (NEW)
npm run tm -- range 2025-07-01 2025-07-31          # Custom date range
npm run tm -- weekly                                # Current week (Mon-Sun)
npm run tm -- weekly 2025-07-29                     # Specific week containing this date
npm run tm -- monthly                               # Current month
npm run tm -- monthly 2025-07                       # Specific month (YYYY-MM format)

# Archive management
npm run tm -- archive --auto                    # Auto-archive old files (2+ years)
npm run tm -- archive --year 2020-2021          # Archive specific fiscal year
npm run tm -- archive --list                    # List archived files
npm run tm -- archive --stats                   # Archive statistics
npm run tm -- archive --restore time-log-2020-2021.md  # Restore from archive
npm run tm -- archive --cleanup                 # Clean up old backup files

# Wiki-link management
npm run tm -- wiki --list-projects              # List all projects
npm run tm -- wiki --validate-all               # Validate all wiki-links
npm run tm -- wiki --create "New Project"       # Create project file
npm run tm -- wiki --suggestions "proj"         # Get project suggestions

# Tag standardization
npm run tm -- tags --stats                      # Show tag usage statistics
npm run tm -- tags --standardize-all            # Standardize all tags
npm run tm -- tags --validate "my-tag"          # Validate a specific tag
npm run tm -- tags --normalize "My Tag!"        # Show normalized version
npm run tm -- tags --report                     # Generate migration report

# Date range reporting (NEW)
npm run tm -- range 2025-07-01 2025-07-31      # Custom date range report
npm run tm -- weekly                            # Current week (Monday-Sunday)
npm run tm -- weekly 2025-07-29                 # Week containing specific date
npm run tm -- monthly                           # Current month
npm run tm -- monthly 2025-07                   # Specific month (YYYY-MM)
npm run tm -- monthly 2025-07-15                # Month from specific date

# Advanced date range options
npm run tm -- range 2025-07-01 2025-07-31 --group-by strategicDirection --format csv
npm run tm -- weekly --group-by tag --sort hours --save
npm run tm -- monthly 2025-07 --top-tasks 5 --format json

# Database management
npm run tm -- index                            # Re-index database from Markdown files

# Input validation
npm run tm -- validate --date "2025-07-29"     # Validate date format
npm run tm -- validate --time "14:30"          # Validate time format
npm run tm -- validate --fiscal-year "2025-2026" # Validate fiscal year
npm run tm -- validate --file entries.json     # Validate batch entries
```

## REST API Server

Temporal Mark includes a full REST API server for integration with web applications, mobile apps, and external systems.

### Starting the API Server

```bash
# Start the API server (default: http://localhost:3000)
npm run api

# Development mode with auto-restart
npm run dev

# Custom port and host
node scripts/startServer.js --port=8080 --host=0.0.0.0
```

### API Endpoints

#### POST /api/start - Start Time Tracking

```bash
curl -X POST http://localhost:3000/api/start \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Working on homepage design",
    "project": "Website Redesign 2025-2026",
    "tags": "design,ui",
    "notes": "Starting responsive layout work"
  }'
```

#### POST /api/finish - Finish Time Tracking

```bash
curl -X POST http://localhost:3000/api/finish \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Completed responsive layout for mobile devices"
  }'
```

#### POST /api/add - Create Time Entry

```bash
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-07-30",
    "startTime": "09:00",
    "endTime": "10:30",
    "task": "API development work",
    "project": "Temporal Mark",
    "tags": ["development", "api", "documentation"],
    "notes": "Implemented REST endpoints with validation"
  }'
```

#### GET /api/daily/:date - Daily Summary

```bash
# Get daily time entries with gaps and totals
curl http://localhost:3000/api/daily/2025-07-30
```

#### GET /api/project/:name - Project Summary

```bash
# Get project summary with recent entries
curl http://localhost:3000/api/project/Temporal%20Mark?limit=5
```

#### GET /api/tag/:tag - Tag Summary

```bash
# Get tag-based summary and entries
curl http://localhost:3000/api/tag/development?limit=10
```

#### GET /api/report/:fiscalYear - Generate Report

```bash
# Generate fiscal year report with grouping options
curl "http://localhost:3000/api/report/2025-2026?groupBy=tag&sort=hours&topTasks=3"
```

#### GET /api/range/:startDate/:endDate - Custom Date Range Report

```bash
# Generate custom date range report
curl "http://localhost:3000/api/range/2025-07-01/2025-07-31"

# With advanced options
curl "http://localhost:3000/api/range/2025-07-01/2025-07-31?groupBy=strategicDirection&sort=hours&topTasks=5"
```

#### GET /api/weekly - Current Week Report

```bash
# Generate current week report (Monday-Sunday)
curl "http://localhost:3000/api/weekly"

# With grouping options
curl "http://localhost:3000/api/weekly?groupBy=tag&sort=alpha&topTasks=2"
```

#### GET /api/weekly/:date - Weekly Report for Specific Date

```bash
# Generate weekly report containing the specified date
curl "http://localhost:3000/api/weekly/2025-07-29"
```

#### GET /api/monthly - Current Month Report

```bash
# Generate current month report
curl "http://localhost:3000/api/monthly"
```

#### GET /api/monthly/:month - Monthly Report for Specific Month

```bash
# Generate monthly report for specific month (YYYY-MM format)
curl "http://localhost:3000/api/monthly/2025-07"

# Or using a specific date (extracts the month)
curl "http://localhost:3000/api/monthly/2025-07-15"
```

### API Features

- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS support**: Configurable cross-origin access
- **Security headers**: Helmet.js protection
- **Input validation**: Comprehensive request validation
- **Error handling**: Structured error responses
- **Health checks**: `/health` endpoint for monitoring

## AI Integration (MCP)

Temporal Mark includes full Model Context Protocol (MCP) integration, enabling direct AI assistant integration with Claude Code, Windsurf, and other MCP-compatible tools.

### MCP Server Features

- **Complete MCP server implementation** (`scripts/mcpServer.js`)
- **12 MCP tools** with JSON schema validation
- **2 MCP resources** for AI data discovery
- **Plug-and-play setup** with configuration examples

### MCP Quick Start

```bash
# Test the MCP server
npm run mcp

# Add to your Claude Code configuration
{
  "mcpServers": {
    "temporal-mark": {
      "command": "node",
      "args": [
        "/absolute/path/to/temporal-mark/scripts/mcpServer.js"
      ]
    }
  }
}
```

📖 **Complete setup instructions:** [MCP Setup Guide](docs/mcp-setup.md)

### Available MCP Tools

1. **temporal_mark_add_entry** - Add new time entries with validation
2. **temporal_mark_start_tracking** - Start tracking time for a new task
3. **temporal_mark_finish_tracking** - Finish the current active time entry
4. **temporal_mark_create_project** - Create new projects with metadata
5. **temporal_mark_get_daily_summary** - Get daily summaries with gap analysis
6. **temporal_mark_get_project_summary** - Analyze project data and recent entries
7. **temporal_mark_get_tag_summary** - Get tag-based insights and statistics
8. **temporal_mark_generate_report** - Generate fiscal year reports with grouping
9. **temporal_mark_validate_entry** - Validate entries without saving
10. **temporal_mark_generate_date_range_report** - Custom date range analysis
11. **temporal_mark_generate_weekly_report** - Weekly productivity summaries
12. **temporal_mark_generate_monthly_report** - Monthly time tracking reports

### MCP Resources

- **temporal://projects** - Complete project catalog with metadata
- **temporal://time-logs/current** - Current fiscal year time log entries

### AI Assistant Capabilities

Once configured, you can interact with AI assistants using natural language:

- "Create a new project called 'Website Redesign 2025-2026' with departmental goals Marketing and Technology"
- "Start tracking time for working on database optimization for the Website project"
- "Finish the current time entry and add notes about completing the feature"
- "Add a time entry for today from 9:00 to 10:30 working on database optimization"
- "Show me my time entries for this week"
- "Generate a monthly report grouped by project"
- "How much time have I spent on development tasks?"

### Integration Options

- **MCP integration** for Claude Code, Windsurf, and other AI assistants
- **REST API endpoints** for web applications and external systems
- **CLI automation** with non-interactive flags for scripting
- **JSON batch processing** for bulk operations

## Testing

Temporal Mark includes comprehensive automated testing and manual testing utilities to ensure reliability and functionality.

### Automated Testing

Run the comprehensive test suite to validate all functionality:

```bash
# Run all tests (124 tests - all passing)
npm test

# Run tests with coverage (if configured)
npm test -- --coverage
```

### Test Coverage

The automated test suite (124 tests) covers all core functionality:

- **Time Parsing**: Converting time strings, calculating durations, handling overnight entries
- **Data Validation**: Date/time formats, fiscal years, task descriptions, field validation
- **Tag Processing**: Normalization, validation, standardization of tags
- **Business Logic**: Time overlaps, gaps, duration calculations, entry processing
- **Date Range Reporting**: Custom ranges, weekly/monthly reports, all output formats, REST API endpoints
- **Database Operations**: Race condition fixes, indexing, query optimization
- **Integration**: Complete workflow testing for time entry processing
- **Edge Cases**: Error conditions, boundary values, invalid inputs

### Manual Testing Utilities

- **`test/manual-test-data-layer.js`**: Comprehensive test of the core data layer functionality
  - Tests database initialization and data indexing
  - Validates time parsing, project parsing, and duration calculations
  - Demonstrates daily summaries, project summaries, and tag summaries
  - Useful for development debugging and validation after changes

```bash
# Run the manual data layer test
node test/manual-test-data-layer.js
```

- **[Manual Testing Guide](test/manual-test-start-finish.md)**: Step-by-step testing guide for start/finish functionality
  - Complete testing procedures for real-time time tracking
  - API endpoint testing with curl examples
  - Integration testing scenarios
  - Error handling validation

### Code Quality

Maintain code quality with linting and formatting:

```bash
# Check code style and potential issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Testing Best Practices

1. **Run tests before commits**: Always run `npm test` before committing changes
2. **All tests must pass**: 111/111 tests passing ensures system reliability
3. **Manual testing for complex workflows**: Use manual testing guides for end-to-end validation
4. **Database testing**: Delete and recreate database to test auto-indexing
5. **CLI testing**: Test commands interactively to verify user experience

## System Capabilities

- **Individual time tracking** with comprehensive CLI interface
- **AI assistant integration** via full MCP protocol implementation
- **REST API integration** for web applications and external systems
- **Obsidian/Vim integration** with manual file editing support
- **Automated validation** and data integrity features with auto-reindexing
- **Scalable architecture** ready for team and enterprise deployment

## Architecture

Temporal Mark uses a three-layer architecture:

1. **Storage Layer**: Markdown files with YAML frontmatter, indexed in SQLite
2. **Processing Layer**: Parsers and analyzers for time entries and project metadata
3. **Interface Layer**: CLI commands with interactive and programmatic interfaces

The system is designed to be:

- **Human-readable**: All data stored in standard Markdown
- **Tool-agnostic**: Compatible with Obsidian, Vim, and other text editors
- **Automation-friendly**: Non-interactive CLI flags for AI and script integration
- **Scalable**: Modular design supports future web UI and multi-user features

## Contributing

This project follows a phased development approach. See `tasks/todo.md` for current implementation status and next steps.
