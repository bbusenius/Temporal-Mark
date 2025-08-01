# Temporal Mark User Guide

A comprehensive guide to using the Temporal Mark time tracking system effectively.

## Table of Contents

1. [Getting Started](#getting-started)
   - [Setting Up with Obsidian](#setting-up-with-obsidian)
   - [Setting Up with Vim](#setting-up-with-vim)
2. [Basic Usage](#basic-usage)
3. [Interactive vs Non-Interactive Mode](#interactive-vs-non-interactive-mode)
4. [Manual Editing](#manual-editing)
5. [Best Practices](#best-practices)
6. [Advanced Features](#advanced-features)
7. [Project Management](#project-management)
8. [Reporting](#reporting)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### First Time Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Create your first time entry**:

   ```bash
   npm run tm -- add
   ```

   This will launch the interactive mode and guide you through creating your first entry. **Note**: If this is your first time using Temporal Mark, the `add` command will automatically create the appropriate time-log file (e.g., `time-logs/time-log-2025-2026.md`) based on the current fiscal year.

3. **View your entry**:
   ```bash
   npm run tm -- daily $(date +%Y-%m-%d)
   ```

### Understanding the File Structure

- `projects/` - Project definition files with metadata
- `time-logs/` - Time log markdown files organized by fiscal year (automatically created when you add your first entry)
- `db/` - SQLite database for fast queries and reporting
- `logs/` - System error and activity logs
- `reports/` - Generated reports (created when you generate reports)

**Time-log File Creation**: The system automatically creates time-log files named by fiscal year (e.g., `time-log-2025-2026.md`) when you add your first entry for that year. You don't need to manually create these files.

### Setting Up with Obsidian

Temporal Mark works exceptionally well with Obsidian, providing a visual and interactive way to manage your time tracking data.

#### Initial Obsidian Setup

1. **Open Temporal Mark as a Vault**:
   - In Obsidian, click "Open folder as vault"
   - Select your Temporal Mark project directory
   - Obsidian will recognize all your Markdown files

2. **Essential Settings Configuration**:
   - Go to Settings → Files & Links
   - Enable **"Use [[Wikilinks]]"** - This matches Temporal Mark's project reference format
   - Set **"New link format"** to "Shortest path when possible"
   - Enable **"Automatically update internal links"** for easy project renaming

3. **Recommended Core Plugins**:
   - **File Explorer**: Navigate time-logs and projects easily
   - **Search**: Find entries across all time logs
   - **Graph View**: Visualize project relationships
   - **Quick Switcher**: Jump between files quickly
   - **Daily Notes**: Integrate with your daily workflow (optional)

#### Useful Community Plugins

Install these community plugins for enhanced time tracking:

1. **Calendar Plugin**:
   - Provides a calendar view of your daily time logs
   - Quick navigation to specific dates
   - Visual overview of logged vs non-logged days

2. **Templater Plugin**:
   - Create templates for new time entries
   - Auto-generate date headers and time formats
   - Streamline repetitive entry creation

3. **Tag Wrangler**:
   - Visual tag management
   - Rename tags across all files
   - See tag usage statistics

4. **Advanced Tables**:
   - Better editing for any tables in project files
   - Useful for project planning and status tracking

#### Obsidian Workflow Integration

**Daily Time Tracking Workflow**:

1. **Morning Setup**:
   - Use Quick Switcher (`Ctrl+O`) to open today's time log
   - If it doesn't exist, create it using the time log template
   - Plan your day by reviewing project files

2. **Throughout the Day**:
   - Add entries directly in Obsidian using your template
   - Use `[[` to reference projects - Obsidian will autocomplete
   - Add tags using `#` or the bracket format `[tag1, tag2]`

3. **End of Day**:
   - Review your time log for gaps or errors
   - Use Graph View to see project connections
   - Update project files with progress notes

#### Creating Obsidian Templates

**Time Entry Template** (save as `templates/time-entry.md`):

```markdown
### {{date:YYYY-MM-DD}}

- **<% tp.system.prompt("Start time (HH:MM)") %>-<% tp.system.prompt("End time (HH:MM)") %>**: <% tp.system.prompt("Task description") %> [[<% tp.system.prompt("Project name") %>]] [<% tp.system.prompt("Tags (comma-separated)") %>]
```

**Daily Time Log Template** (save as `templates/daily-log.md`):

```markdown
# Time Log {{date:YYYY-YYYY}}

## {{date:MMMM YYYY}}

### {{date:YYYY-MM-DD}}

- **09:00-**: Morning startup and planning [[]] []
- **-**: [[]] []
- **-**: [[]] []

#### Daily Summary

- Total logged: X hours
- ## Key accomplishments:
- ## Tomorrow's priorities:
```

**New Project Template** (save as `templates/new-project.md`):

```markdown
---
projectName: '{{title}}'
status: 'Active'
startDate: '{{date:YYYY-MM-DD}}'
departmentalGoals: ['']
strategicDirections: ['']
tags: ['']
summary: ''
---

# {{title}}

## Project Overview

## Goals & Objectives

- [ ]
- [ ]
- [ ]

## Timeline

- **Start Date**: {{date:YYYY-MM-DD}}
- **Target Completion**:
- **Key Milestones**:
  - [ ]
  - [ ]

## Resources

- **Team Members**:
- **Budget**:
- **Tools/Technologies**:

## Notes

Created: {{date:YYYY-MM-DD}}
```

#### Obsidian-Specific Features

**Using Graph View for Time Tracking**:

- **Project Relationships**: See how projects connect through shared tags
- **Time Flow**: Visualize your work patterns over time
- **Collaboration Networks**: Identify projects that often appear together

**Search Strategies**:

```
# Find all development work
tag:#development OR [development]

# Find specific project entries
[[Website Redesign]]

# Find time entries for a specific date range
path:"time-logs" 2025-07-29

# Find entries with specific tags
[frontend] AND [bug-fix]

# Find long entries (over 3 hours)
/\*\*\d{2}:\d{2}-\d{2}:\d{2}\*\*/ AND (13:00 OR 14:00 OR 15:00)
```

**Custom CSS for Time Tracking** (add to `snippets/time-tracking.css`):

```css
/* Highlight time entries */
.markdown-rendered strong:has-text('**') {
  background-color: var(--color-accent-1);
  padding: 2px 4px;
  border-radius: 3px;
}

/* Style project links */
.internal-link[data-href*='project'] {
  color: var(--color-blue);
  font-weight: 600;
}

/* Style time log headers */
.markdown-rendered h3:has-text('2025-') {
  border-left: 4px solid var(--color-accent);
  padding-left: 10px;
  background-color: var(--background-secondary);
}
```

#### Obsidian Hotkeys for Time Tracking

Set up these custom hotkeys in Settings → Hotkeys:

- **Ctrl+T**: Insert time entry template
- **Ctrl+Shift+T**: Open today's time log
- **Ctrl+P**: Quick switcher to projects folder
- **Ctrl+Alt+G**: Open graph view focused on current file

#### Mobile Usage with Obsidian

**Obsidian Mobile Setup**:

1. **Sync your vault** using Obsidian Sync or a cloud service
2. **Quick entry workflow**: Use voice-to-text for rapid task descriptions
3. **Template access**: Set up easily accessible templates for mobile entry
4. **Offline capability**: Continue tracking even without internet

**Mobile Quick Entry Template**:

```markdown
- **{{time}}**: {{task-description}} [[{{project}}]] [{{tags}}]
```

#### Integrating with Temporal Mark CLI

**Best of Both Worlds Workflow**:

1. **Use Obsidian for**:
   - Visual project management and planning
   - Daily note-taking and detailed entry creation
   - Reviewing and editing existing entries
   - Graph analysis and relationship discovery

2. **Use CLI for**:
   - Automated validation (`npm run tm -- wiki --validate-all`)
   - Generating reports (`npm run tm -- report 2025-2026`)
   - Tag standardization (`npm run tm -- tags --standardize-all`)
   - Data integrity checks (`npm run tm -- daily 2025-07-29`)

**Recommended Workflow**:

```bash
# Morning: Plan in Obsidian, validate with CLI
obsidian .  # Open vault
npm run tm -- daily $(date +%Y-%m-%d)  # Check yesterday's entries

# During day: Track in Obsidian
# (Use Obsidian for all entry creation and editing)

# Evening: Validate and generate insights with CLI
npm run tm -- wiki --validate-all
npm run tm -- tags --stats
npm run tm -- daily $(date +%Y-%m-%d)
```

#### Troubleshooting Obsidian Integration

**Common Issues**:

1. **Wiki-links not working**: Check that Wikilinks are enabled in settings
2. **Templates not appearing**: Verify Templater plugin is installed and configured
3. **Graph view cluttered**: Use filters to show only time-logs or projects
4. **Search not finding entries**: Check that you're using the correct search syntax

**Performance with Large Vaults**:

- **Exclude database folder**: Add `db/` to excluded files in settings
- **Index optimization**: Let Obsidian fully index before heavy usage
- **Plugin limits**: Disable unused plugins if vault becomes slow

This Obsidian integration makes Temporal Mark incredibly powerful for visual learners and those who prefer rich text editing environments while maintaining all the benefits of the CLI tools for automation and validation.

### Setting Up with Vim

For users who prefer a lightweight, keyboard-driven approach, Temporal Mark provides excellent Vim integration for wiki-link navigation without the overhead of visual rendering.

#### Vim Setup

1. **Install the configuration**:

   ```bash
   # Source the Temporal Mark vim config in your ~/.vimrc
   source ~/Documents/Business/UChicago/Code/Temporal-Mark/vimwiki-config.vim
   ```

2. **Or copy directly to ~/.vimrc**:
   ```vim
   " Add the contents of vimwiki-config.vim to your ~/.vimrc
   ```

#### Key Features

**Smart Wiki Link Navigation**:

- **Enter**: Follow `[[Project Name]]` links in the same window
- **s+Enter**: Follow links in a split screen window
- **Smart file matching**: Tries exact match first, then lowercase-with-hyphens
- **Auto-creation**: Creates new project files if they don't exist

**Cross-Directory Links**:

- Links from `time-logs/` automatically look in `projects/` directory
- Handles inconsistent naming (spaces vs hyphens, capitalization)
- Works seamlessly with existing file structure

#### Vim Workflow

**Daily Time Tracking**:

1. **Open today's time log**:

   ```bash
   vim time-logs/time-log-2025-2026.md
   ```

2. **Navigate to project files**:
   - Position cursor on any `[[Project Name]]` link
   - Press **Enter** to open in same window
   - Press **s+Enter** to open in split screen

3. **Work with split views**:
   - Edit time log on left, project details on right
   - Use standard Vim window commands (`Ctrl+w` navigation)

**Example Usage**:

```markdown
### 2025-07-30

- **09:00-10:30**: Working on [[Website Redesign 2025-2026]] [development]
- **10:45-12:00**: Planning [[Mobile App]] [design, research]
```

**Link Resolution Examples**:

- `[[Website Redesign 2025-2026]]` → `projects/Website Redesign 2025-2026.md` (exact match)
- `[[Mobile App]]` → `projects/mobile-app.md` (lowercase with hyphens)
- `[[New Project]]` → Creates `projects/New Project.md` (new file)

#### Benefits of Vim Integration

- **No visual rendering**: See raw markdown exactly as written
- **Lightweight**: No plugin dependencies beyond the simple config
- **Fast navigation**: Instant link following with keyboard shortcuts
- **Split screen editing**: Work on time logs and projects simultaneously
- **Cross-platform**: Works on any system with Vim
- **Terminal-friendly**: Perfect for remote work and SSH sessions

This Vim setup provides a powerful, distraction-free environment for time tracking while maintaining full compatibility with all Temporal Mark CLI tools and file formats.

## Basic Usage

### Real-Time Time Tracking (Start/Finish)

For active time tracking, Temporal Mark offers `start` and `finish` commands that let you begin tracking immediately and complete entries when done.

#### Interactive Time Tracking

The `start` command supports both interactive and non-interactive modes, with the interactive mode providing comprehensive prompts and suggestions:

```bash
# Interactive mode - provides prompts with project selection and tag suggestions
npm run tm -- start

# Or use the --interactive flag explicitly
npm run tm -- start --interactive
```

**Interactive Mode Features:**

- **Task Description**: Formal prompt with validation requiring non-empty input
- **Project Selection**: Database-driven list showing existing projects with hours logged and descriptions, plus option to create new projects
- **Advanced Tag System**: Checkbox-style selection from existing tags, plus option to add custom tags
- **Time Input**: Smart time entry with format help text "Start time (defaults to now or HH:MM):"
- **Optional Notes**: Additional context for the time entry

#### Non-Interactive Time Tracking

For automation and scripting, use the non-interactive mode with command-line flags:

```bash
# Start tracking a task
npm run tm -- start --task "Working on database optimization"

# Start with project and tags
npm run tm -- start --task "Code review session" --project "Mobile App" --tags "review,quality"

# Start with custom start time and notes
npm run tm -- start --task "Meeting with client" --start "14:00" --notes "Initial project discussion"

# Start with all options
npm run tm -- start --task "Bug fixing" --project "Website" --tags "bug,frontend" --start "09:30" --notes "Fixing responsive design issues"

# Force non-interactive mode (bypass interactive prompts)
npm run tm -- start --no-interactive --task "Quick task" --project "Website"
```

**Entry Format**: Active entries use the `[ACTIVE]` marker:

```markdown
- **09:30-[ACTIVE]**: Bug fixing [[Website]] [bug, frontend] - Fixing responsive design issues
```

#### Finishing Time Tracking

```bash
# Finish current active entry
npm run tm -- finish

# Finish with custom end time
npm run tm -- finish --end "17:30"

# Finish with additional notes
npm run tm -- finish --notes "Completed all critical fixes"

# Finish with both custom time and notes
npm run tm -- finish --end "16:45" --notes "Ready for testing"
```

**Completed Entry**: After finishing, the `[ACTIVE]` marker is replaced with the actual end time:

```markdown
- **09:30-16:45**: Bug fixing [[Website]] [bug, frontend] - Fixing responsive design issues Ready for testing
```

#### Start/Finish Workflow Rules

- **Single Active Entry**: Only one entry can be active at a time
- **Must Finish First**: You must finish the current entry before starting a new one
- **Time Validation**: End time must be after start time
- **Automatic Time**: If no time specified, uses current time

#### Example Workflow

```bash
# Start your work day
npm run tm -- start --task "Daily standup meeting" --project "Team Management" --tags "meetings"

# Finish the meeting
npm run tm -- finish --end "09:30" --notes "Discussed sprint progress"

# Start next task
npm run tm -- start --task "Implementing user authentication" --project "Web App" --tags "backend,security"

# Finish with current time
npm run tm -- finish --notes "Authentication system completed and tested"
```

### Adding Time Entries

#### Interactive Mode (Recommended)

```bash
npm run tm -- add
```

The interactive mode provides comprehensive prompts with validation and intelligent suggestions:

**Interactive Mode Features:**

- **Date Input**: Defaults to current date with format validation (YYYY-MM-DD)
- **Time Inputs**: Start and end time with format validation (HH:MM)
- **Task Description**: Formal prompt with validation requiring non-empty input
- **Project Selection**: Database-driven list showing existing projects, plus option to create new projects
- **Advanced Tag Selection**:
  - Checkbox-style interface showing all existing tags from the database
  - Multi-select capability for choosing multiple existing tags
  - Option to add custom tags via separate prompt
  - Automatic tag normalization and validation
- **Optional Notes**: Additional context for the time entry

**Tag Selection Details:**
The tag system provides a sophisticated interface:

1. **Existing Tags**: Displayed as checkboxes, sourced from all project metadata
2. **Custom Tags**: Select "Add custom tags" option to enter new tags
3. **Tag Processing**: All tags are automatically normalized (lowercase, hyphens for spaces)
4. **Validation**: Invalid tags are filtered out with helpful error messages

#### Non-Interactive Mode (For automation/scripting)

```bash
npm run tm -- add \
  --date "2025-07-29" \
  --start "09:00" \
  --end "10:30" \
  --task "Updated user documentation" \
  --project "Temporal Mark" \
  --tags "documentation,writing" \
  --notes "Added comprehensive user guide with examples"
```

### Viewing Your Data

#### Daily View

```bash
npm run tm -- daily 2025-07-29
```

Shows all entries for a specific date, including gaps between logged time.

#### Project Summary

```bash
npm run tm -- project "Website Redesign"
```

Shows total hours, recent entries, and project metadata.

#### Tag Summary

```bash
npm run tm -- tag "documentation"
```

Shows all entries tagged with a specific tag across all projects.

## Interactive vs Non-Interactive Mode

Both `add` and `start` commands now provide consistent interactive experiences with comprehensive prompts and intelligent suggestions.

### When to Use Interactive Mode

- **Learning the system**: Provides validation and suggestions
- **Complex entries**: When you need to review project options with hours and descriptions
- **Tag management**: Advanced checkbox selection from existing tags plus custom tag input
- **Daily logging**: Conversational interface with formal prompts and validation
- **Project discovery**: Database-driven project selection showing activity levels
- **Quality assurance**: Built-in validation prevents common errors

### Interactive Mode Features (Both Commands)

**Consistent User Experience:**

- **Formal prompts**: Professional messaging with clear validation requirements
- **Database integration**: Project lists with hours logged and descriptions
- **Advanced tag system**: Checkbox selection from existing tags + custom input capability
- **Smart defaults**: Current time for start times, current date for dates
- **Input validation**: Real-time format checking and error prevention
- **Project auto-creation**: Automatic project file creation for new projects

### When to Use Non-Interactive Mode

- **Automation**: Scripts, cron jobs, or API integrations
- **Batch processing**: Multiple entries from external sources
- **Speed**: When you know exact values and want quick entry
- **Integration**: With other tools and systems
- **CI/CD pipelines**: Automated time logging from development workflows

### Batch Processing from JSON

Create a JSON file with multiple entries:

```json
[
  {
    "date": "2025-07-29",
    "startTime": "09:00",
    "endTime": "10:30",
    "task": "Morning standup and planning",
    "project": "Team Meetings",
    "tags": ["meeting", "planning"],
    "notes": "Discussed sprint goals"
  },
  {
    "date": "2025-07-29",
    "startTime": "10:30",
    "endTime": "12:00",
    "task": "Implemented user authentication",
    "project": "Website Redesign",
    "tags": ["development", "backend", "security"],
    "notes": "Added JWT token validation"
  }
]
```

Then import:

```bash
npm run tm -- add --file entries.json
```

## Manual Editing

One of Temporal Mark's key strengths is that all data is stored in **plain Markdown files** that you can edit directly with any text editor, including Vim, Obsidian, VS Code, or any other Markdown-compatible editor.

### Understanding the File Format

#### Time Log Files (`time-logs/time-log-YYYY-YYYY.md`)

Time logs follow a specific but readable format:

```markdown
# Time Log 2025-2026

## July 2025

### 2025-07-29

- **09:00-10:30**: Updated user documentation [[Temporal Mark]] [documentation, writing]
  - Notes: Added comprehensive section on manual editing
- **10:30-12:00**: Team standup meeting [[Team Meetings]] [meeting, planning]
- **13:00-17:00**: Backend development work [[Website Redesign]] [development, backend, api]
  - Notes: Implemented JWT authentication and user sessions

### 2025-07-30

- **09:00-10:00**: Email and administrative tasks [[Non-Project]] [administrative, email]
- **10:00-12:00**: Database optimization [[Website Redesign]] [development, database, performance]
```

**Format Rules:**

- **Date headers**: Use `### YYYY-MM-DD` format
- **Time entries**: `- **HH:MM-HH:MM**: Task description [[Project Name]] [tag1, tag2, tag3]`
- **Notes**: Indented with ` - Notes:` (two spaces, dash, space)
- **Projects**: Always wrapped in `[[double brackets]]`
- **Tags**: Always in `[square brackets]`, comma-separated, lowercase with hyphens

#### Project Files (`projects/project-name.md`)

Project files have YAML frontmatter followed by Markdown content:

```markdown
---
projectName: 'Website Redesign 2025-2026'
status: 'Active'
startDate: '2025-07-01'
departmentalGoals: ['User Experience', 'Digital Services']
strategicDirections: ['Technology Innovation', 'Service Excellence']
tags: ['web-development', 'ui-design', 'user-experience']
summary: 'Complete redesign focusing on mobile responsiveness and accessibility'
---

# Website Redesign 2025-2026

## Project Overview

This project aims to modernize our web presence...

## Current Status

- [x] Requirements gathering
- [x] Initial mockups
- [ ] Development phase
- [ ] Testing and launch
```

### When to Edit Manually

#### Ideal Scenarios for Manual Editing

1. **Bulk corrections**: When you need to fix multiple entries at once
2. **Complex time adjustments**: Splitting one entry into multiple entries
3. **Adding detailed notes**: After-the-fact annotation of your work
4. **Time log corrections**: Fixing dates, times, or project references
5. **Working offline**: When you don't have access to the CLI
6. **Integration with other tools**: Obsidian, Vim, or other Markdown editors

#### Using Obsidian

Temporal Mark works excellently with Obsidian:

1. **Open the project folder** in Obsidian as a vault
2. **Navigate time logs** using Obsidian's file explorer
3. **Use wiki-links**: `[[Project Name]]` links work natively
4. **Search and filter**: Use Obsidian's powerful search across all files
5. **Graph view**: Visualize connections between projects and time entries
6. **Daily notes**: You can integrate with Obsidian's daily notes feature

**Obsidian Setup Tips:**

- Enable "Link to existing files" for project references
- Use the Graph view to see project relationships
- Set up templates for consistent time entry formatting
- Use Obsidian's search to find entries by project or tag

#### Using Vim/Neovim

For Vim users, Temporal Mark files work great with:

1. **Markdown plugins**: For syntax highlighting and folding
2. **FZF integration**: Quick file and content searching
3. **Abbreviations**: Set up abbreviations for common project names
4. **Templates**: Use snippets for time entry formatting

**Vim Configuration Example:**

```vim
" Time entry abbreviations
iabbrev tmark - **<C-R>=strftime("%H:%M")<CR>-**:
iabbrev today ### <C-R>=strftime("%Y-%m-%d")<CR>

" Quick project references
iabbrev tmproj [[Temporal Mark]]
iabbrev webproj [[Website Redesign]]
```

### Manual Editing Guidelines

#### Safe Editing Practices

1. **Always use the correct format**: Follow the established patterns exactly
2. **Validate after editing**: Run `npm run tm -- wiki --validate-all` after manual changes
3. **Check for overlaps**: Use `npm run tm -- daily YYYY-MM-DD` to verify entries
4. **Backup before major changes**: The system keeps backups, but be cautious
5. **Test with small changes first**: Make sure you understand the format

#### Common Manual Editing Tasks

**Splitting a Long Entry:**

```markdown
# Before (single 4-hour entry)

- **09:00-13:00**: Various development tasks [[Website Redesign]] [development]

# After (split into specific tasks)

- **09:00-10:30**: Database schema updates [[Website Redesign]] [development, database]
- **10:30-12:00**: API endpoint implementation [[Website Redesign]] [development, backend]
- **13:00-13:30**: Code review and testing [[Website Redesign]] [development, testing]
```

**Adding Detailed Notes:**

```markdown
- **14:00-17:00**: Client meeting and requirements gathering [[Website Redesign]] [meeting, requirements]
  - Notes: Discussed mobile-first approach, accessibility requirements (WCAG 2.1 AA), and integration with existing CMS. Client emphasized importance of page load speed and SEO optimization. Next steps: create wireframes and technical architecture document.
```

**Fixing Project References:**

```markdown
# Before (inconsistent project names)

- **09:00-10:00**: Morning standup [[Team Meeting]] [meeting]
- **10:00-11:00**: Planning session [[team meetings]] [meeting]
- **11:00-12:00**: Retrospective [[Team-Meetings]] [meeting]

# After (consistent project name)

- **09:00-10:00**: Morning standup [[Team Meetings]] [meeting]
- **10:00-11:00**: Planning session [[Team Meetings]] [meeting]
- **11:00-12:00**: Retrospective [[Team Meetings]] [meeting]
```

**Batch Tag Updates:**

```markdown
# Use find/replace in your editor to update tags across multiple entries

# Before: [web-dev, front-end]

# After: [web-development, frontend]
```

### Maintaining Data Integrity

#### After Manual Editing

1. **Re-index the database**:

   ```bash
   # This rebuilds the SQLite database from your markdown files
   npm run tm -- index
   ```

2. **Validate wiki-links**:

   ```bash
   npm run tm -- wiki --validate-all
   ```

3. **Standardize tags**:

   ```bash
   npm run tm -- tags --standardize-all
   ```

4. **Check for overlaps**:
   ```bash
   npm run tm -- daily 2025-07-29  # Check specific dates you edited
   ```

#### Integration with External Tools

**Git Integration:**

```bash
# Track changes to your time logs
git add time-logs/
git commit -m "Updated time entries for July 2025"

# See what you changed
git diff HEAD~1 time-logs/
```

**Automated Backups:**

```bash
# The system creates backups automatically, but you can also:
cp -r time-logs/ time-logs-backup-$(date +%Y%m%d)
```

### Best Practices for Manual Editing

1. **Be consistent**: Follow the established format patterns exactly
2. **Use proper tools**: Choose editors with good Markdown support
3. **Validate frequently**: Check your work with CLI commands
4. **Start small**: Make minor edits before attempting major restructuring
5. **Keep backups**: Especially before bulk changes
6. **Document your changes**: Use git or manual notes to track what you modified

### Troubleshooting Manual Edits

**Common Issues:**

1. **Malformed time entries**: Missing asterisks, wrong bracket types

   ```bash
   npm run tm -- validate --file time-logs/time-log-2025-2026.md
   ```

2. **Invalid project references**: Typos in project names

   ```bash
   npm run tm -- wiki --validate-all
   ```

3. **Time overlaps**: Accidentally created overlapping entries

   ```bash
   npm run tm -- daily YYYY-MM-DD
   ```

4. **Database sync issues**: Manual changes not reflected in reports
   ```bash
   # Force database rebuild
   rm db/markdownDB.sqlite
   npm run tm -- daily $(date +%Y-%m-%d)
   ```

Manual editing gives you complete control over your time tracking data while maintaining the benefits of structured data and automated reporting. The key is understanding the format and validating your changes with the CLI tools.

## Best Practices

### Time Entry Guidelines

1. **Log time consistently**: Try to log at least twice daily
2. **Be specific in task descriptions**: "Fixed login bug" vs "Bug fix"
3. **Use consistent project names**: The system helps standardize these
4. **Tag appropriately**: Use 2-5 tags per entry for good categorization
5. **Include meaningful notes**: Future you will thank present you

### Project Organization

1. **Create projects proactively**: Don't let the system auto-create everything
2. **Use descriptive project names**: Include year for multi-year projects
3. **Set proper metadata**: Fill in departmental goals and strategic directions
4. **Review project summaries regularly**: Use `npm run tm -- project "Project Name"`

### Tag Strategy

1. **Use lowercase, hyphenated tags**: The system normalizes these automatically
2. **Be consistent**: "web-development" not "webdev" or "web_development"
3. **Create hierarchies**: "development", "development-frontend", "development-backend"
4. **Review tag usage**: Use `npm run tm -- tags --stats` to see all tags

### Time Logging Patterns

#### Start of Day

```bash
npm run tm -- add
# Log your first task of the day
```

#### End of Day

```bash
npm run tm -- daily $(date +%Y-%m-%d)
# Review your day, check for gaps
```

#### Weekly Review

```bash
# Generate a report for the current fiscal year
npm run tm -- report 2025-2026 --group-by departmentalGoal
```

## Advanced Features

### Wiki-Link Management

Projects are referenced using `[[Project Name]]` syntax in task descriptions and notes. The system:

- **Validates links**: Warns about non-existent projects
- **Suggests corrections**: "webste" → "website-redesign-2025-2026"
- **Auto-creates projects**: Missing projects are created automatically
- **Provides bulk operations**: Validate and fix links across all time logs

#### Checking Wiki-Links

```bash
# Validate all time logs
npm run tm -- wiki --validate-all

# Fix suggestions in a specific file
npm run tm -- wiki --fix time-logs/time-log-2025-2026.md
```

### Tag Standardization

The system enforces consistent tag formatting:

- **Automatic normalization**: "UI Design" → "ui-design"
- **Validation**: Ensures tags meet length and character requirements
- **Bulk operations**: Standardize tags across all files

#### Tag Management

```bash
# See tag statistics
npm run tm -- tags --stats

# Standardize all tags
npm run tm -- tags --standardize-all

# Validate a specific tag
npm run tm -- tags --validate "web-development"
```

### Archive Management

Old time logs are automatically archived to save space:

```bash
# Auto-archive files older than 2 years
npm run tm -- archive --auto

# Archive a specific fiscal year
npm run tm -- archive --year 2023-2024

# List archived files
npm run tm -- archive --list

# Restore from archive
npm run tm -- archive --restore time-log-2023-2024.md
```

### Input Validation

The system provides comprehensive validation:

```bash
# Validate a date
npm run tm -- validate --date "2025-07-29"

# Validate a time entry (JSON format)
npm run tm -- validate --entry '{"date":"2025-07-29","startTime":"09:00","endTime":"10:00","task":"Test","project":"Demo"}'

# Validate entries from a file
npm run tm -- validate --file entries.json
```

### Database Re-indexing

Re-index the database to sync with your Markdown files:

```bash
# Re-index all data (clears and rebuilds database)
npm run tm -- index
```

**When to use**:

- After bulk manual edits to time logs or projects
- When reports show outdated or missing information
- After importing historical data
- When you encounter database sync issues

**What it does**:

- Clears all existing database data
- Re-indexes all project files and time logs
- Shows progress and final counts
- Handles errors gracefully

## Project Management

### Creating Projects

Projects are markdown files with YAML frontmatter:

```markdown
---
projectName: 'Website Redesign 2025-2026'
status: 'Active'
startDate: '2025-07-01'
departmentalGoals: ['User Experience', 'Digital Services']
strategicDirections: ['Technology Innovation', 'Service Excellence']
tags: ['web-development', 'ui-design', 'user-experience']
summary: 'Complete redesign of the main website focusing on mobile responsiveness and accessibility'
---

# Website Redesign 2025-2026

## Project Overview

This project aims to modernize our web presence with a focus on user experience and accessibility.

## Milestones

- [ ] User research and requirements gathering
- [ ] Design mockups and prototypes
- [ ] Development and testing
- [ ] Launch and evaluation

## Resources

- Design team: 2 people
- Development team: 3 people
- Budget: $50,000
```

### Project Conventions

#### Special Projects

**non-project.md**: For administrative time, meetings, and non-project work

```markdown
---
projectName: 'Non-Project'
status: 'Ongoing'
departmentalGoals: ['Operations']
strategicDirections: ['Operational Excellence']
tags: ['administrative', 'overhead']
summary: 'Administrative tasks, meetings, and overhead work'
---
```

**unproductive.md**: For breaks, interruptions, and non-work time

```markdown
---
projectName: 'Unproductive'
status: 'Ongoing'
departmentalGoals: ['Personal']
strategicDirections: ['Work-Life Balance']
tags: ['break', 'personal']
summary: 'Breaks, personal time, and unproductive periods'
---
```

## Reporting

Temporal Mark provides comprehensive reporting capabilities for both long-term fiscal year analysis and short-term date range tracking.

### Date Range Reports (NEW)

Generate reports for specific time periods - perfect for weekly reviews, monthly summaries, or custom date ranges.

#### Basic Date Range Commands

```bash
# Custom date range (any start and end date)
npm run tm -- range 2025-07-01 2025-07-31

# Current week (Monday to Sunday)
npm run tm -- weekly

# Specific week containing the given date
npm run tm -- weekly 2025-07-29

# Current month
npm run tm -- monthly

# Specific month (YYYY-MM format)
npm run tm -- monthly 2025-07

# Specific month from a date (extracts month automatically)
npm run tm -- monthly 2025-07-15
```

#### Advanced Date Range Options

All date range commands support the same options as fiscal year reports:

```bash
# Group by strategic direction with CSV output
npm run tm -- range 2025-07-01 2025-07-31 --group-by strategicDirection --format csv

# Weekly report grouped by tags, sorted by hours
npm run tm -- weekly --group-by tag --sort hours --format markdown

# Monthly report with more top tasks shown
npm run tm -- monthly 2025-07 --top-tasks 5 --save

# Custom range with JSON output
npm run tm -- range 2025-07-15 2025-07-17 --format json --group-by departmentalGoal
```

#### Date Range Report Features

- **Flexible time periods**: Any date range from single days to multiple months
- **Week boundaries**: Weeks run Monday to Sunday (ISO 8601 standard)
- **Month boundaries**: Automatic first-to-last day calculations with leap year support
- **Same grouping options**: departmentalGoal, strategicDirection, tag
- **Multiple formats**: markdown, csv, json
- **Top tasks**: Shows most time-consuming tasks per project
- **Gap analysis**: Identifies non-working periods within range

#### Use Cases for Date Range Reports

- **Weekly reviews**: `npm run tm -- weekly` for sprint retrospectives
- **Monthly summaries**: `npm run tm -- monthly` for progress reports
- **Project milestones**: Custom ranges for specific project phases
- **Time audits**: Analyze specific problem periods
- **Client billing**: Generate reports for billing periods

### Fiscal Year Reports

Generate comprehensive annual reports for analysis:

```bash
# Basic report (Markdown format, grouped by departmental goal)
npm run tm -- report 2025-2026

# CSV format, grouped by strategic direction
npm run tm -- report 2025-2026 --format csv --group-by strategicDirection

# JSON format with sorting and saving
npm run tm -- report 2025-2026 --format json --sort hours --save
```

### Report Options (All Report Types)

- **Group by**: `departmentalGoal`, `strategicDirection`, `tag`
- **Format**: `markdown`, `csv`, `json`
- **Sort**: `date`, `alpha`, `hours`
- **Top tasks**: `--top-tasks 5` (shows top N tasks per project)
- **Save**: `--save` flag saves report to `reports/` directory

### Understanding Reports

All reports (fiscal year and date range) include:

- **Summary statistics**: Total hours, project count, date range
- **Project breakdowns**: Hours per project with top tasks
- **Metadata analysis**: Departmental goals and strategic directions
- **Time distribution**: Shows how time is allocated across categories
- **Top tasks per project**: Most time-consuming activities

#### Sample Report Output (Markdown)

```markdown
# Time Tracking Report: 2025-07-15 to 2025-07-17

## Summary

**Date Range:** 2025-07-15 to 2025-07-17  
**Total Hours:** 10.5  
**Total Entries:** 8  
**Projects:** 2  
**Days with Entries:** 3  
**Grouped By:** Departmental Goal

## Technology

_Total: 6.0 hours_

### Project Alpha

**Hours:** 6.0 | **Entries:** 5 | **Status:** Active

First test project for range reporting.

**Top Tasks:**

- Testing and debugging (2.0h)
- Initial setup and planning (1.5h)
- Database design (1.0h)

## Marketing

_Total: 3.5 hours_

### Project Beta

**Hours:** 3.5 | **Entries:** 3 | **Status:** Active

Second test project for range reporting.

**Top Tasks:**

- UI mockups (1.5h)
- Report generation (1.0h)
- Data analysis (1.0h)
```

## Database Management

Temporal Mark uses an SQLite database (`db/markdownDB.sqlite`) to index your Markdown files for fast querying and reporting. The database automatically stays in sync with your files, but sometimes manual intervention is needed.

### When to Re-index

You should re-index the database when:

- **Daily/project views show incorrect data** - Database is out of sync with files
- **Commands report "no such table" errors** - Database is missing or corrupted
- **After bulk manual edits** - Made many changes directly in Markdown files
- **After importing old time logs** - Added historical data from other sources
- **Reports show outdated information** - Recent entries not appearing in summaries

### How to Re-index

#### Method 1: Manual Re-indexing Command (Recommended)

```bash
# Use the dedicated index command for clean re-indexing
npm run tm -- index
```

This command:

- Clears all existing database data
- Re-indexes all projects and time logs from Markdown files
- Shows detailed progress and counts
- Handles errors gracefully

#### Method 2: Automatic Re-indexing (Alternative)

```bash
# Delete database to force complete rebuild
rm db/markdownDB.sqlite

# Run any command that uses the database - it will rebuild automatically
npm run tm -- daily $(date +%Y-%m-%d)
```

#### Method 3: Trigger via Any Database Command

```bash
# Any of these commands will re-index if database is missing/corrupted
npm run tm -- daily 2025-07-30
npm run tm -- project "Temporal Mark"
npm run tm -- tag development
npm run tm -- report 2025-2026
```

### Database Contents

The SQLite database contains indexed versions of:

- **Time entries** - All `- **HH:MM-HH:MM**: Task...` lines from time logs
- **Projects** - Metadata from all `.md` files in `projects/` directory
- **Relationships** - Links between entries and projects via `[[Project Name]]` syntax

### Database Location

- **File**: `db/markdownDB.sqlite`
- **Auto-created**: Database recreates itself when missing
- **Safe to delete**: Always safe to delete - will rebuild from Markdown files
- **Size**: Typically 10-50KB depending on data volume

### Troubleshooting Database Issues

#### Problem: "no such table" errors

```bash
# Solution: Force database rebuild
rm db/markdownDB.sqlite
npm run tm -- daily $(date +%Y-%m-%d)
```

#### Problem: Daily view shows wrong/missing entries

```bash
# Check if database exists and when it was last updated
ls -la db/markdownDB.sqlite

# If old or missing, rebuild
rm db/markdownDB.sqlite
npm run tm -- daily $(date +%Y-%m-%d)
```

#### Problem: [ACTIVE] entries causing issues

```bash
# [ACTIVE] entries are automatically skipped in reports
# If causing database errors, finish the active entry first
npm run tm -- finish --notes "Finished for database sync"

# Then re-index
rm db/markdownDB.sqlite
npm run tm -- daily $(date +%Y-%m-%d)
```

#### Problem: Project metadata not updating

```bash
# Re-index to pick up project file changes
npm run tm -- index
npm run tm -- project "Your Project Name"
```

### Database Maintenance

#### Regular Maintenance (Optional)

```bash
# Monthly: Clean rebuild to optimize database
rm db/markdownDB.sqlite
npm run tm -- report $(date +%Y)-$(date -d "1 year" +%Y)
```

#### Backup Database (Optional)

```bash
# Backup current database before major changes
cp db/markdownDB.sqlite db/markdownDB.backup.$(date +%Y%m%d).sqlite

# Restore from backup if needed
cp db/markdownDB.backup.20250730.sqlite db/markdownDB.sqlite
```

**Important**: The database is always regenerated from your Markdown files. Your actual data is stored in the `.md` files, so the database can always be safely deleted and rebuilt.

## Troubleshooting

### Common Issues

#### Time Overlap Errors

```
Error: Time overlap detected: 09:30-10:30 conflicts with existing entry 09:00-10:00
```

**Solution**: Check your existing entries for the date and adjust times accordingly.

#### Invalid Project References

```
Warning: Project "Webste Redesign" not found. Did you mean "Website Redesign"?
```

**Solution**: Use the wiki-link validator to fix references:

```bash
npm run tm -- wiki --fix time-logs/time-log-2025-2026.md
```

#### Database Issues

**Solution**: Re-index the data:

```bash
# This rebuilds the database from markdown files
npm run tm -- index
```

#### Tag Standardization Issues

```
Warning: Tag "UI Design" will be normalized to "ui-design"
```

**Solution**: Use the tag standardizer:

```bash
npm run tm -- tags --standardize-all
```

### Getting Help

1. **Check validation**: Use validation commands to identify issues
2. **Review logs**: Check `logs/errors.log` for detailed error information
3. **Use help commands**: `npm run tm -- --help` for command reference
4. **Check examples**: This guide contains working examples for all features

### Performance Tips

1. **Archive old data**: Use archive management for files older than 2 years
2. **Clean up logs**: Logs rotate automatically but you can clean them manually
3. **Validate regularly**: Run validation to catch issues early
4. **Use batch operations**: For multiple entries, use JSON batch import

## Example Workflows

### Daily Logging Workflow

```bash
# Morning: Start with a planning entry
npm run tm -- add

# Mid-day: Check your progress
npm run tm -- daily $(date +%Y-%m-%d)

# Evening: Log final tasks and review
npm run tm -- add
npm run tm -- daily $(date +%Y-%m-%d)
```

### Weekly Review Workflow

```bash
# Generate current fiscal year report
npm run tm -- report 2025-2026 --save

# Check project summaries for major projects
npm run tm -- project "Website Redesign"
npm run tm -- project "Staff Training"

# Review tag usage
npm run tm -- tags --stats
```

### Monthly Maintenance Workflow

```bash
# Validate all wiki-links
npm run tm -- wiki --validate-all

# Standardize tags
npm run tm -- tags --standardize-all

# Check archive candidates
npm run tm -- archive --stats

# Clean up if needed
npm run tm -- archive --auto
```

## REST API Integration

Temporal Mark includes a comprehensive REST API server for integration with web applications, mobile apps, and external systems.

### Starting the API Server

```bash
# Start the API server (runs on http://localhost:3000)
npm run api

# Development mode with auto-restart on file changes
npm run dev

# Custom configuration
node scripts/startServer.js --port=8080 --host=0.0.0.0
```

### API Endpoints Reference

#### POST /api/start - Start Time Tracking

Start tracking time for a new task:

```bash
curl -X POST http://localhost:3000/api/start \
  -H "Content-Type: application/json" \
  -d '{
    "task": "API development and testing",
    "project": "Temporal Mark",
    "tags": "development,api,integration",
    "notes": "Starting API endpoint implementation",
    "start": "09:00"
  }'
```

**Response Example:**

```json
{
  "success": true,
  "message": "Started tracking: API development and testing",
  "entry": "- **09:00-[ACTIVE]**: API development and testing [[Temporal Mark]] [development, api, integration] - Starting API endpoint implementation",
  "filePath": "time-logs/time-log-2025-2026.md"
}
```

#### POST /api/finish - Finish Time Tracking

Finish the current active time entry:

```bash
curl -X POST http://localhost:3000/api/finish \
  -H "Content-Type: application/json" \
  -d '{
    "end": "10:30",
    "notes": "Completed REST endpoints with comprehensive validation"
  }'
```

**Response Example:**

```json
{
  "success": true,
  "message": "Finished tracking: API development and testing",
  "entry": "- **09:00-10:30**: API development and testing [[Temporal Mark]] [development, api, integration] - Starting API endpoint implementation Completed REST endpoints with comprehensive validation",
  "duration": "1 hour 30 minutes",
  "filePath": "time-logs/time-log-2025-2026.md"
}
```

#### POST /api/add - Create Time Entry

Add new time entries programmatically:

```bash
curl -X POST http://localhost:3000/api/add \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-07-30",
    "startTime": "09:00",
    "endTime": "10:30",
    "task": "API development and testing",
    "project": "Temporal Mark",
    "tags": ["development", "api", "integration"],
    "notes": "Implemented REST endpoints with comprehensive validation"
  }'
```

**Response Example:**

```json
{
  "message": "Time entry created successfully",
  "entry": {
    "date": "2025-07-30",
    "startTime": "09:00",
    "endTime": "10:30",
    "task": "API development and testing",
    "project": "Temporal Mark",
    "tags": ["development", "api", "integration"],
    "duration": 1.5
  },
  "validation": {
    "isValid": true,
    "warnings": []
  }
}
```

#### GET /api/daily/:date - Daily Summary

Get comprehensive daily time tracking data:

```bash
curl http://localhost:3000/api/daily/2025-07-30
```

**Response includes:**

- All time entries for the date
- Time gaps between entries
- Total logged and unlogged hours
- Daily productivity summary

#### GET /api/project/:name - Project Summary

Get detailed project analysis with recent entries:

```bash
curl "http://localhost:3000/api/project/Temporal%20Mark?limit=5"
```

**Query Parameters:**

- `limit` - Number of recent entries to return (default: 10)
- `offset` - Skip entries for pagination (default: 0)

#### GET /api/tag/:tag - Tag Summary

Analyze time spent on specific tags:

```bash
curl "http://localhost:3000/api/tag/development?limit=10"
```

**Response includes:**

- Total hours logged with the tag
- Projects using the tag
- Recent entries with the tag
- Usage statistics

#### GET /api/report/:fiscalYear - Generate Reports

Create comprehensive fiscal year reports:

```bash
curl "http://localhost:3000/api/report/2025-2026?groupBy=tag&sort=hours&topTasks=3"
```

**Query Parameters:**

- `groupBy` - Group by: `departmentalGoal`, `strategicDirection`, `tag`
- `sort` - Sort by: `date`, `alpha`, `hours`
- `topTasks` - Number of top tasks to show per project (default: 3)

### API Integration Examples

#### Web Application Integration

```javascript
// Add time entry from web form
async function addTimeEntry(formData) {
  const response = await fetch('/api/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: formData.date,
      startTime: formData.startTime,
      endTime: formData.endTime,
      task: formData.task,
      project: formData.project,
      tags: formData.tags.split(',').map((t) => t.trim()),
      notes: formData.notes,
    }),
  });

  return response.json();
}

// Get daily dashboard data
async function getDailyDashboard(date) {
  const response = await fetch(`/api/daily/${date}`);
  const data = await response.json();

  return {
    entries: data.entries,
    totalHours: data.summary.totalLoggedHours,
    gaps: data.summary.gaps,
  };
}
```

#### Mobile App Integration

```javascript
// React Native example
import AsyncStorage from '@react-native-async-storage/async-storage';

class TemporalMarkAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async addEntry(entry) {
    try {
      const response = await fetch(`${this.baseURL}/api/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to add entry:', error);
      throw error;
    }
  }

  async syncOfflineEntries() {
    const offlineEntries = await AsyncStorage.getItem('offlineEntries');
    if (offlineEntries) {
      const entries = JSON.parse(offlineEntries);
      for (const entry of entries) {
        await this.addEntry(entry);
      }
      await AsyncStorage.removeItem('offlineEntries');
    }
  }
}
```

### API Security and Configuration

#### Rate Limiting

- **Default**: 100 requests per 15 minutes per IP address
- **Headers**: Rate limit status included in response headers
- **Customizable**: Modify limits in `scripts/apiServer.js`

#### CORS Configuration

```javascript
// Enable specific origins
const corsOptions = {
  origin: ['http://localhost:3000', 'https://myapp.com'],
  credentials: true,
};
```

#### Environment Variables

```bash
# .env file configuration
PORT=3000
HOST=localhost
ALLOWED_ORIGINS=http://localhost:3000,https://myapp.com
NODE_ENV=production
```

## AI Integration (MCP)

Temporal Mark includes full Model Context Protocol (MCP) integration, enabling AI assistants to interact directly with your time tracking data through standardized tools.

### MCP Integration Architecture

The system provides comprehensive MCP integration:

- **MCP Integration Class** (`scripts/mcpIntegration.js`) with fully implemented tool definitions
- **JSON Schema Validation** for all MCP tool inputs and outputs
- **Structured Error Handling** compatible with MCP response formats
- **Resource-Based Data Access** patterns for AI discovery

### Available MCP Tools

The MCP integration layer provides 8 tools for AI systems:

1. **temporal_mark_add_entry** - Create new time entries with validation
2. **temporal_mark_start_tracking** - Start tracking time for a new task
3. **temporal_mark_finish_tracking** - Finish the current active time entry
4. **temporal_mark_get_daily_summary** - Retrieve daily summaries and gap analysis
5. **temporal_mark_get_project_summary** - Analyze project data and recent entries
6. **temporal_mark_get_tag_summary** - Get tag-based insights and statistics
7. **temporal_mark_generate_report** - Create fiscal year reports with grouping
8. **temporal_mark_validate_entry** - Validate entries without saving them

#### Real-Time Tracking Tools

**Start Tracking:**

```javascript
await mcp.executeTool('temporal_mark_start_tracking', {
  task: 'Implementing user authentication',
  project: 'Web Application',
  tags: 'backend,security',
  notes: 'Working on JWT implementation',
});
```

**Finish Tracking:**

```javascript
await mcp.executeTool('temporal_mark_finish_tracking', {
  end: '16:30',
  notes: 'Authentication system completed and tested',
});
```

### Planned MCP Resources (Future Implementation)

- **temporal://projects** - Complete project catalog with metadata
- **temporal://time-logs/current** - Current fiscal year time data

### Current AI Integration Options

**Available Today:**

#### REST API Integration

```javascript
// Web applications and external systems can integrate via REST API
const response = await fetch('http://localhost:3000/api/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: '2025-07-30',
    startTime: '14:00',
    endTime: '15:30',
    task: 'AI integration planning',
    project: 'Temporal Mark',
    tags: ['planning', 'ai'],
  }),
});
```

#### CLI Automation

```bash
# Scripts and automation systems can use CLI with flags
npm run tm -- add \
  --date "2025-07-30" \
  --start "14:00" \
  --end "15:30" \
  --task "Automated time entry" \
  --project "Temporal Mark" \
  --tags "automation,testing"
```

#### JSON Batch Processing

```javascript
// Bulk operations via JSON file processing
const entries = [
  {
    date: '2025-07-30',
    startTime: '09:00',
    endTime: '10:30',
    task: 'Morning planning session',
    project: 'Temporal Mark',
    tags: ['planning', 'meeting'],
  },
];

// Save to file and process
fs.writeFileSync('batch-entries.json', JSON.stringify(entries));
// Then: npm run tm -- add --file batch-entries.json
```

### Future MCP Server Implementation

To complete MCP integration, a future implementation would need:

1. **MCP Server Setup** - Proper MCP protocol server implementation
2. **Tool Registration** - Register the 6 defined tools with MCP runtime
3. **Resource Endpoints** - Implement the 2 planned MCP resources
4. **Authentication** - Add security for AI assistant access
5. **Real-time Updates** - WebSocket or polling for live data

### Integration Benefits

**Current Capabilities:**

- **REST API** for web and mobile applications
- **CLI automation** for scripts and workflows
- **JSON processing** for bulk operations
- **Manual editing** compatibility with Obsidian/Vim

**Future MCP Capabilities:**

- **Direct AI assistant integration** via MCP protocol
- **Automated workflow triggers** based on time tracking events
- **Intelligent suggestions** from AI analysis of patterns
- **Voice-activated time tracking** through AI assistants

This user guide provides comprehensive coverage of the Temporal Mark system including CLI, API, and AI integration capabilities. For specific command syntax, use `npm run tm -- --help` or `npm run tm -- <command> --help` for detailed help on any command.
