# MCP (Model Context Protocol) Setup Guide

This guide explains how to set up Temporal Mark as an MCP server for AI assistants like Claude Code, Windsurf, and other MCP-compatible tools.

## What is MCP?

Model Context Protocol (MCP) is a standardized way for AI assistants to interact with external tools and data sources. With MCP, you can give AI assistants direct access to your Temporal Mark time tracking data for:

- **Automated time logging**: AI can add time entries based on your work
- **Smart reporting**: Generate reports through natural language requests
- **Project insights**: Ask questions about your time allocation and productivity
- **Real-time tracking**: Start and stop time tracking through AI commands

## Prerequisites

1. **Temporal Mark installed and working**:

   ```bash
   npm install
   npm run tm -- add  # Test that basic functionality works
   ```

2. **MCP SDK dependency** (already included if you've installed Temporal Mark):
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

## Setup Instructions

### Step 1: Install Dependencies

If you haven't already, install the MCP SDK:

```bash
cd /path/to/temporal-mark
npm install
```

### Step 2: Test MCP Server

Verify the MCP server works:

```bash
# Test server startup
npm run mcp

# In another terminal, test tool listing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp
```

The server should respond with a list of available tools and then keep running.

### Step 3: Configure Your AI Assistant

#### Claude Code or Windsurf Configuration

1. **Find your Claude Code MCP configuration file**:
   - `~/.claude.json` or
   - in Windsurf, `Windsurf-Settings > Advanced Settings > Manage MCPs > View Raw Config`

2. **Add Temporal Mark server**:

   ```json
   {
     "mcpServers": {
       "temporal-mark": {
         "command": "node",
         "args": ["/absolute/path/to/your/temporal-mark/scripts/mcpServer.js"]
       }
     }
   }
   ```

3. **Restart Claude Code or refresh MCP servers** to load the new configuration.

## Available MCP Tools

Once configured, your AI assistant will have access to these Temporal Mark tools:

### Time Entry Management

- **temporal_mark_add_entry**: Create new time entries with validation
- **temporal_mark_start_tracking**: Start real-time tracking for a task
- **temporal_mark_finish_tracking**: Complete the current active time entry
- **temporal_mark_validate_entry**: Validate time entries without saving

### Project Management

- **temporal_mark_create_project**: Create new projects with metadata (departmental goals, strategic directions, tags)

### Data Analysis

- **temporal_mark_get_daily_summary**: Get daily time logs with gap analysis
- **temporal_mark_get_project_summary**: Analyze time spent on specific projects
- **temporal_mark_get_tag_summary**: Review time allocation by tags

### Reporting

- **temporal_mark_generate_report**: Create fiscal year reports with grouping
- **temporal_mark_generate_since_report**: _AI-powered reports_ for work done since last occurrence of text (e.g., "team meeting")
- **temporal_mark_generate_date_range_report**: Custom date range analysis
- **temporal_mark_generate_weekly_report**: Weekly productivity summaries
- **temporal_mark_generate_monthly_report**: Monthly time tracking reports

## Example AI Interactions

Once set up, you can interact with your AI assistant using natural language:

### Time Logging

```
"Add a time entry for today from 9:00 to 10:30 working on API development for the Website project, tagged as development and backend"
```

### Real-Time Tracking

```
"Start tracking time for database optimization work on the Mobile App project"
"Finish tracking and add a note that the optimization improved query speed by 40%"
```

### Analysis and Reporting

```
"Show me my time entries for yesterday"
"Generate a weekly report grouped by project"
"How much time have I spent on development tasks this month?"
"What are my top 3 projects by hours logged this fiscal year?"
```

### 🤖 AI-Powered Since Reports

```
"What have I accomplished since the last team meeting?"
"Give me a summary of work done since lunch"
"Show me progress since the last client meeting"
"Summarize what I've completed since yesterday's team sync"
```

**With AI summarization enabled**, these requests will return intelligent syntheses like:

- Project-organized summaries with key accomplishments
- Focus on completed deliverables rather than individual tasks
- Automatic filtering of unproductive time
- Concise, meaningful progress reports perfect for status updates

### Project Management

```
"Create a new project called 'Website Redesign 2025-2026' with departmental goals Marketing and Technology"
"Create a project for 'Database Migration' with strategic direction DigitalTransformation and tags database, migration"
```

### Project Insights

```
"Which project have I been working on most this week?"
"Show me all my meeting time from last month"
"Generate a report of my backend development work for Q1"
```

## Testing

To verify the MCP integration is working:

1. **Test the server directly**:

   ```bash
   node /absolute/path/to/temporal-mark/scripts/mcpServer.js
   ```

   Should start without errors and show "Temporal Mark MCP Server started successfully"

2. **Test in your AI assistant**: Ask it to list available tools or add a time entry

## Supported AI Assistants

### Tested Platforms

- **Claude Code**: Full support with setup instructions above
- **Windsurf**: Full support with configuration example
- **Other MCP clients**: Should work with standard MCP protocol

### Future Compatibility

The MCP server follows MCP specification v0.5.0 and should work with any compliant AI assistant or MCP client.

## Getting Help

If you encounter issues:

1. **Check basic functionality**: Ensure `npm run tm` works normally
2. **Review logs**: Check `logs/errors.log` for errors
3. **Test manually**: Use the manual testing commands above
4. **Verify paths**: Ensure absolute paths in MCP configuration
5. **Restart everything**: Sometimes a clean restart resolves connection issues

The MCP integration provides a powerful way to combine AI assistance with your time tracking workflow, enabling natural language interactions with your productivity data.
