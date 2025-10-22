/**
 * @fileoverview MCP (Model Context Protocol) integration layer
 * Provides MCP-compatible interfaces for Temporal Mark functionality
 * enabling AI tools and systems to interact with time tracking data
 * @version 1.0.0
 */

const DataIndexer = require('./dataIndexer');
const AddEntry = require('./addEntry');
const TimeTracker = require('./timeTracker');
const InputValidator = require('./inputValidator');
const WikiLinkValidator = require('./wikiLinkValidator');
const errorLogger = require('./errorLogger');

/**
 * MCP Integration Layer for Temporal Mark
 * Provides standardized interfaces for AI/MCP systems to interact
 * with time tracking functionality in a structured way
 */
class MCPIntegration {
  /**
   * Initialize MCP integration layer
   * @param {Object} options - Configuration options
   * @param {boolean} options.enableLogging - Enable detailed logging (default: true)
   * @param {string} options.logLevel - Log level: 'error', 'warn', 'info', 'debug' (default: 'info')
   */
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'info',
      ...options,
    };

    this.dataIndexer = new DataIndexer();
    this.timeTracker = new TimeTracker({ silent: true });
    this.validator = new InputValidator();
    this.wikiValidator = new WikiLinkValidator();
    this.errorLogger = errorLogger;
    this.isInitialized = false;
  }

  /**
   * Initialize the MCP integration layer
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.dataIndexer.initialize();
      this.isInitialized = true;

      if (this.options.enableLogging) {
        this.errorLogger.logActivity('MCP Integration layer initialized');
      }
    } catch (error) {
      this.errorLogger.logError('Failed to initialize MCP integration', error);
      throw error;
    }
  }

  /**
   * Check for file changes and reindex if needed for long-running MCP server
   * @async
   * @returns {Promise<boolean>} True if reindexing occurred
   */
  async ensureFreshData() {
    try {
      const dbTimestamp = await this.dataIndexer.getLastIndexTime();
      const filesTimestamp = await this.dataIndexer.getNewestFileTime();

      if (!dbTimestamp || filesTimestamp > dbTimestamp) {
        console.error('📁 Files changed, re-indexing for MCP operation...');
        await this.dataIndexer.indexAllData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking file changes:', error.message);
      // If we can't check, force reindex to be safe
      await this.dataIndexer.indexAllData();
      return true;
    }
  }

  /**
   * Get MCP capability definitions
   * Returns the available MCP tools/functions that can be called
   * @returns {Object} MCP capability definitions
   */
  getCapabilities() {
    return {
      version: '1.0.0',
      tools: [
        {
          name: 'temporal_mark_add_entry',
          description: 'Add a new time tracking entry',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Date in YYYY-MM-DD format',
              },
              startTime: {
                type: 'string',
                pattern: '^\\d{2}:\\d{2}$',
                description: 'Start time in HH:MM format',
              },
              endTime: {
                type: 'string',
                pattern: '^\\d{2}:\\d{2}$',
                description: 'End time in HH:MM format',
              },
              task: {
                type: 'string',
                minLength: 5,
                maxLength: 500,
                description: 'Task description',
              },
              project: {
                type: 'string',
                minLength: 1,
                maxLength: 100,
                description: 'Project name',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of tags for categorization',
              },
              notes: {
                type: 'string',
                maxLength: 1000,
                description: 'Optional additional notes',
              },
            },
            required: ['date', 'startTime', 'endTime', 'task', 'project'],
          },
        },
        {
          name: 'temporal_mark_start_tracking',
          description: 'Start tracking time for a new task',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                minLength: 5,
                maxLength: 500,
                description: 'Task description (required)',
              },
              project: {
                type: 'string',
                minLength: 1,
                maxLength: 100,
                description: 'Project name',
              },
              tags: {
                type: 'string',
                description: 'Comma-separated tags',
              },
              notes: {
                type: 'string',
                maxLength: 1000,
                description: 'Additional notes',
              },
              date: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Date in YYYY-MM-DD format (defaults to today)',
              },
              start: {
                type: 'string',
                pattern: '^\\d{2}:\\d{2}$',
                description:
                  'Start time in HH:MM format (defaults to current time)',
              },
            },
            required: ['task'],
          },
        },
        {
          name: 'temporal_mark_finish_tracking',
          description: 'Finish the current active time entry',
          inputSchema: {
            type: 'object',
            properties: {
              end: {
                type: 'string',
                pattern: '^\\d{2}:\\d{2}$',
                description:
                  'End time in HH:MM format (defaults to current time)',
              },
              notes: {
                type: 'string',
                maxLength: 1000,
                description: 'Additional notes to append',
              },
            },
            required: [],
          },
        },
        {
          name: 'temporal_mark_get_daily_summary',
          description: 'Get daily time tracking summary for a specific date',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Date in YYYY-MM-DD format',
              },
            },
            required: ['date'],
          },
        },
        {
          name: 'temporal_mark_get_project_summary',
          description: 'Get summary of time spent on a specific project',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                minLength: 1,
                description: 'Name of the project',
              },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
                description: 'Max entries to return',
              },
            },
            required: ['projectName'],
          },
        },
        {
          name: 'temporal_mark_get_tag_summary',
          description:
            'Get summary of time spent on entries with a specific tag',
          inputSchema: {
            type: 'object',
            properties: {
              tag: { type: 'string', minLength: 2, description: 'Tag name' },
              limit: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 10,
                description: 'Max entries to return',
              },
            },
            required: ['tag'],
          },
        },
        {
          name: 'temporal_mark_generate_report',
          description:
            'Generate fiscal year report with various grouping and formatting options',
          inputSchema: {
            type: 'object',
            properties: {
              fiscalYear: {
                type: 'string',
                pattern: '^\\d{4}-\\d{4}$',
                description: 'Fiscal year in YYYY-YYYY format',
              },
              groupBy: {
                type: 'string',
                enum: ['departmentalGoal', 'strategicDirection', 'tag'],
                default: 'departmentalGoal',
                description: 'How to group the report data',
              },
              sort: {
                type: 'string',
                enum: ['date', 'alpha', 'hours'],
                default: 'hours',
                description: 'How to sort the report',
              },
              topTasks: {
                type: 'integer',
                minimum: 1,
                maximum: 10,
                default: 3,
                description: 'Number of top tasks to show per project',
              },
              suppressProjects: {
                type: 'string',
                description:
                  'Comma-separated list of project names to suppress from report (Unproductive always suppressed)',
              },
              summarize: {
                type: 'boolean',
                default: false,
                description:
                  'Whether to provide an AI-generated summary of work accomplished by project instead of the full report',
              },
            },
            required: ['fiscalYear'],
          },
        },
        {
          name: 'temporal_mark_generate_since_report',
          description:
            'Generate report of work done since the last occurrence of specified text in task descriptions',
          inputSchema: {
            type: 'object',
            properties: {
              searchString: {
                type: 'string',
                minLength: 1,
                description:
                  'Text to search for in task descriptions (e.g., "standup meeting", "lunch", "break")',
              },
              suppressProjects: {
                type: 'string',
                description:
                  'Comma-separated list of project names to suppress from report (Unproductive always suppressed)',
              },
              summarize: {
                type: 'boolean',
                default: false,
                description:
                  'When true, AI should provide a concise summary instead of full task details',
              },
            },
            required: ['searchString'],
          },
        },
        {
          name: 'temporal_mark_validate_entry',
          description: 'Validate a time entry without saving it',
          inputSchema: {
            type: 'object',
            properties: {
              date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
              startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
              task: { type: 'string', minLength: 1 },
              project: { type: 'string', minLength: 1 },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['date', 'startTime', 'endTime', 'task', 'project'],
          },
        },
        {
          name: 'temporal_mark_generate_date_range_report',
          description:
            'Generate custom date range report with various grouping and formatting options',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Start date in YYYY-MM-DD format',
              },
              endDate: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'End date in YYYY-MM-DD format',
              },
              groupBy: {
                type: 'string',
                enum: ['departmentalGoal', 'strategicDirection', 'tag'],
                default: 'departmentalGoal',
                description: 'How to group the report data',
              },
              sort: {
                type: 'string',
                enum: ['date', 'alpha', 'hours'],
                default: 'date',
                description: 'How to sort projects within each group',
              },
              topTasks: {
                type: 'integer',
                minimum: 0,
                maximum: 10,
                default: 3,
                description: 'Number of top tasks to show per project',
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        {
          name: 'temporal_mark_generate_weekly_report',
          description:
            'Generate weekly report for current week or week containing a specific date',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description:
                  'Date to determine week (optional, defaults to current week)',
              },
              groupBy: {
                type: 'string',
                enum: ['departmentalGoal', 'strategicDirection', 'tag'],
                default: 'departmentalGoal',
                description: 'How to group the report data',
              },
              sort: {
                type: 'string',
                enum: ['date', 'alpha', 'hours'],
                default: 'date',
                description: 'How to sort projects within each group',
              },
              topTasks: {
                type: 'integer',
                minimum: 0,
                maximum: 10,
                default: 3,
                description: 'Number of top tasks to show per project',
              },
            },
            required: [],
          },
        },
        {
          name: 'temporal_mark_generate_monthly_report',
          description:
            'Generate monthly report for current month or specific month',
          inputSchema: {
            type: 'object',
            properties: {
              month: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}(-\\d{2})?$',
                description:
                  'Month in YYYY-MM or YYYY-MM-DD format (optional, defaults to current month)',
              },
              groupBy: {
                type: 'string',
                enum: ['departmentalGoal', 'strategicDirection', 'tag'],
                default: 'departmentalGoal',
                description: 'How to group the report data',
              },
              sort: {
                type: 'string',
                enum: ['date', 'alpha', 'hours'],
                default: 'date',
                description: 'How to sort projects within each group',
              },
              topTasks: {
                type: 'integer',
                minimum: 0,
                maximum: 10,
                default: 3,
                description: 'Number of top tasks to show per project',
              },
            },
            required: [],
          },
        },
        {
          name: 'temporal_mark_create_project',
          description: 'Create a new project with metadata',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                minLength: 1,
                maxLength: 100,
                description: 'Name of the project to create',
              },
              departmentalGoal: {
                type: 'array',
                items: { type: 'string' },
                default: ['General'],
                description: 'Array of departmental goals',
              },
              strategicDirection: {
                type: 'array',
                items: { type: 'string' },
                default: ['General'],
                description: 'Array of strategic directions',
              },
              status: {
                type: 'string',
                enum: ['Active', 'Completed', 'On Hold', 'Cancelled'],
                default: 'Active',
                description: 'Project status',
              },
              startDate: {
                type: 'string',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: 'Project start date (defaults to today)',
              },
              summary: {
                type: 'string',
                maxLength: 500,
                description: 'Project summary/description',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of project tags',
              },
            },
            required: ['projectName'],
          },
        },
      ],
      resources: [
        {
          uri: 'temporal://projects',
          name: 'Project List',
          description: 'List of all active projects with metadata',
          mimeType: 'application/json',
        },
        {
          uri: 'temporal://time-logs/current',
          name: 'Current Time Log',
          description: 'Current fiscal year time log entries',
          mimeType: 'application/json',
        },
      ],
    };
  }

  /**
   * Execute an MCP tool call
   * @async
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} arguments - Tool arguments
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, args) {
    await this.initialize();

    try {
      switch (toolName) {
        case 'temporal_mark_add_entry':
          return this.addEntry(args);

        case 'temporal_mark_start_tracking':
          return this.startTracking(args);

        case 'temporal_mark_finish_tracking':
          return this.finishTracking(args);

        case 'temporal_mark_get_daily_summary':
          return this.getDailySummary(args);

        case 'temporal_mark_get_project_summary':
          return this.getProjectSummary(args);

        case 'temporal_mark_get_tag_summary':
          return this.getTagSummary(args);

        case 'temporal_mark_generate_report':
          return this.generateReport(args);

        case 'temporal_mark_generate_since_report':
          return this.generateSinceReport(args);

        case 'temporal_mark_validate_entry':
          return this.validateEntry(args);

        case 'temporal_mark_generate_date_range_report':
          return this.generateDateRangeReport(args);

        case 'temporal_mark_generate_weekly_report':
          return this.generateWeeklyReport(args);

        case 'temporal_mark_generate_monthly_report':
          return this.generateMonthlyReport(args);

        case 'temporal_mark_create_project':
          return this.createProject(args);

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.errorLogger.logError(`MCP tool execution error: ${toolName}`, error);
      return {
        success: false,
        error: error.message,
        toolName,
        arguments: args,
      };
    }
  }

  /**
   * Add a time entry via MCP interface
   * @async
   * @param {Object} args - Entry arguments
   * @returns {Promise<Object>} Entry creation result
   */
  async addEntry(args) {
    const {
      date,
      startTime,
      endTime,
      task,
      project,
      tags = [],
      notes = '',
    } = args;

    // Validate input
    const validation = await this.validateEntry(args);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Validation failed',
        validation,
        mcpCompatible: true,
      };
    }

    try {
      // Ensure we have fresh data before proceeding
      await this.ensureFreshData();

      // Create AddEntry instance with fresh database state
      const addEntry = new AddEntry();
      await addEntry.initialize();

      // Create entry object
      const entry = {
        date,
        startTime,
        endTime,
        task,
        project,
        tags: Array.isArray(tags) ? tags : this.parseTagsField(tags),
        notes: notes || null,
      };

      // Validate the entry with fresh data
      const existingEntries =
        await addEntry.dataIndexer.db.getTimeEntriesForDate(date);
      const validationResults = await addEntry.inputValidator.validateTimeEntry(
        entry,
        existingEntries
      );

      // For MCP, we accept warnings automatically but still fail on errors
      if (!validationResults.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validationResults.errors.join(', ')}`,
          validation: validationResults,
          mcpCompatible: true,
        };
      }

      // Standardize tags and process entry
      entry.tags = addEntry.tagStandardizer.normalizeTags(entry.tags || []);
      const durationHours = addEntry.timeParser.calculateDuration(
        startTime,
        endTime
      );

      // Save the entry directly
      const result = await addEntry.saveEntry({
        ...entry,
        durationHours,
      });

      return {
        success: true,
        message: 'Time entry added successfully',
        entry: {
          date,
          startTime,
          endTime,
          task,
          project,
          tags: entry.tags,
          notes,
          duration: this.calculateDuration(startTime, endTime),
        },
        validation,
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        validation: validation || null,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Start time tracking via MCP interface
   * @async
   * @param {Object} args - Start tracking arguments
   * @param {string} args.task - Task description (required)
   * @param {string} [args.project] - Project name
   * @param {string} [args.tags] - Comma-separated tags
   * @param {string} [args.notes] - Additional notes
   * @param {string} [args.date] - Date (YYYY-MM-DD format)
   * @param {string} [args.start] - Start time (HH:MM format)
   * @returns {Promise<Object>} Start tracking result
   */
  async startTracking(args) {
    const { task, project, tags, notes, date, start } = args;

    try {
      // Ensure we have fresh data before proceeding
      await this.ensureFreshData();

      // Validate required field
      if (!task || typeof task !== 'string' || task.trim() === '') {
        return {
          success: false,
          error: 'Task description is required and must be a non-empty string',
          validation: {
            isValid: false,
            errors: ['Task description is required'],
            warnings: [],
          },
        };
      }

      // Start tracking using TimeTracker
      const result = await this.timeTracker.startEntry({
        task,
        project,
        tags,
        notes,
        date,
        start,
      });

      if (this.options.enableLogging) {
        console.log(`MCP: Started tracking "${task}"`);
      }

      return {
        success: true,
        message: result.message,
        entry: result.entry,
        filePath: result.filePath,
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_start_tracking',
          action: 'start_time_entry',
        },
      };
    } catch (error) {
      this.errorLogger.logError('MCP start tracking error', error);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_start_tracking',
          action: 'start_time_entry',
          error_type: this.classifyError(error.message),
        },
      };
    }
  }

  /**
   * Finish time tracking via MCP interface
   * @async
   * @param {Object} args - Finish tracking arguments
   * @param {string} [args.end] - End time (HH:MM format)
   * @param {string} [args.notes] - Additional notes to append
   * @returns {Promise<Object>} Finish tracking result
   */
  async finishTracking(args) {
    const { end, notes } = args;

    try {
      // Ensure we have fresh data before proceeding
      await this.ensureFreshData();

      // Finish tracking using TimeTracker
      const result = await this.timeTracker.finishEntry({
        end,
        notes,
      });

      if (this.options.enableLogging) {
        console.log(`MCP: Finished tracking with duration: ${result.duration}`);
      }

      return {
        success: true,
        message: result.message,
        entry: result.entry,
        duration: result.duration,
        filePath: result.filePath,
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_finish_tracking',
          action: 'finish_time_entry',
        },
      };
    } catch (error) {
      this.errorLogger.logError('MCP finish tracking error', error);

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_finish_tracking',
          action: 'finish_time_entry',
          error_type: this.classifyError(error.message),
        },
      };
    }
  }

  /**
   * Classify error types for better MCP error handling
   * @private
   * @param {string} errorMessage - Error message to classify
   * @returns {string} Error classification
   */
  classifyError(errorMessage) {
    if (errorMessage.includes('already exists')) return 'conflict';
    if (errorMessage.includes('No active entry')) return 'not_found';
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('must be after')
    )
      return 'validation';
    if (errorMessage.includes('required')) return 'missing_field';
    return 'unknown';
  }

  /**
   * Get daily summary via MCP interface
   * @async
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Daily summary result
   */
  async getDailySummary(args) {
    const { date } = args;

    try {
      await this.ensureFreshData();
      const summary = await this.dataIndexer.getDailySummary(date);

      return {
        success: true,
        data: {
          date,
          totalEntries: summary.entries.length,
          totalLoggedHours: summary.totalLoggedHours,
          totalGapHours: summary.totalGapHours,
          entries: summary.entries.map((entry) => ({
            startTime: entry.start_time,
            endTime: entry.end_time,
            task: entry.task,
            project: entry.project,
            tags: this.parseTagsField(entry.tags),
            duration: entry.duration_hours,
          })),
          gaps: summary.gaps,
        },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Get project summary via MCP interface
   * @async
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Project summary result
   */
  async getProjectSummary(args) {
    const { projectName, limit = 10 } = args;

    try {
      await this.ensureFreshData();
      const summary = await this.dataIndexer.getProjectSummary(projectName);

      if (!summary.project) {
        return {
          success: false,
          error: `Project "${projectName}" not found`,
          mcpCompatible: true,
        };
      }

      return {
        success: true,
        data: {
          project: {
            name: summary.project.project_name,
            status: summary.project.status,
            startDate: summary.project.start_date,
            departmentalGoals: this.parseJsonField(
              summary.project.departmental_goals,
              'departmentalGoals'
            ),
            strategicDirections: this.parseJsonField(
              summary.project.strategic_directions,
              'strategicDirections'
            ),
            tags: this.parseJsonField(summary.project.tags, 'tags'),
            summary: summary.project.summary,
          },
          totalHours: summary.totalHours,
          entryCount: summary.entryCount,
          recentEntries: summary.entries.slice(0, limit).map((entry) => ({
            date: entry.date,
            startTime: entry.start_time,
            endTime: entry.end_time,
            task: entry.task,
            duration: entry.duration_hours,
            tags: this.parseTagsField(entry.tags),
          })),
        },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Get tag summary via MCP interface
   * @async
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Tag summary result
   */
  async getTagSummary(args) {
    const { tag, limit = 10 } = args;

    try {
      await this.ensureFreshData();
      const summary = await this.dataIndexer.getTagSummary(tag);

      return {
        success: true,
        data: {
          tag,
          totalHours: summary.totalHours,
          entryCount: summary.entryCount,
          projectsUsed: summary.projectsUsed,
          recentEntries: summary.entries.slice(0, limit).map((entry) => ({
            date: entry.date,
            startTime: entry.start_time,
            endTime: entry.end_time,
            task: entry.task,
            project: entry.project,
            duration: entry.duration_hours,
          })),
        },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Generate report via MCP interface
   * @async
   * @param {Object} args - Report arguments
   * @returns {Promise<Object>} Report generation result
   */
  async generateReport(args) {
    const {
      fiscalYear,
      groupBy = 'departmentalGoal',
      sort = 'hours',
      topTasks = 3,
      suppressProjects = '',
      summarize = false,
    } = args;

    try {
      const ReportGenerator = require('./reportFiscalYear');
      const reportGen = new ReportGenerator();

      // Choose format and topTasks based on summarize option
      const format = summarize ? 'json' : 'markdown';
      const actualTopTasks = summarize ? 0 : 0; // Always show all tasks for fiscal reports

      const report = await reportGen.generateReport(fiscalYear, {
        groupBy,
        format,
        sort,
        topTasks: actualTopTasks,
        suppressProjects,
        summarize,
      });

      const response = {
        success: true,
        data: {
          fiscalYear,
          generatedAt: new Date().toISOString(),
          groupBy,
          sort,
          topTasks: actualTopTasks,
          summarize,
          reportType: format,
        },
        mcpCompatible: true,
      };

      if (summarize) {
        // Parse JSON report and structure data for AI summarization
        const reportData = JSON.parse(report);
        response.data.summary = reportData.summary;
        response.data.groups = reportData.groups;
        response.data.aiInstructions =
          `Create a fiscal year summary report with this EXACT structure:\n\n` +
          Object.keys(reportData.groups)
            .map((groupName) => {
              const group = reportData.groups[groupName];
              return (
                `## Departmental Goal: ${groupName}\n\n` +
                group.projects
                  .map(
                    (project) =>
                      `### ${project.name} (${project.hours}h)\n[Write a thoughtful paragraph summarizing the key accomplishments and work completed for this project]\n`
                  )
                  .join('\n')
              );
            })
            .join('\n') +
          `\n\nIMPORTANT: Use the exact project names and hours shown above. Do not change names or combine projects. ` +
          `For each project, write a well-crafted paragraph that synthesizes the work done into a coherent summary focusing on outcomes and achievements.`;
      } else {
        response.data.report = report;
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Generate since report via MCP interface
   * @async
   * @param {Object} args - Report parameters
   * @returns {Promise<Object>} Report result
   */
  async generateSinceReport(args) {
    const { searchString, suppressProjects = '', summarize = false } = args;

    try {
      const SinceReport = require('./reportSince');
      const reportGen = new SinceReport();

      // Use the MCP integration's dataIndexer if available
      if (this.dataIndexer && this.dataIndexer.db) {
        reportGen.indexer = this.dataIndexer;
      } else {
        await reportGen.initialize();
      }

      const report = await reportGen.generateReport(searchString, {
        format: 'json',
        suppressProjects,
      });

      // Only close if we initialized our own indexer
      if (!this.dataIndexer || !this.dataIndexer.db) {
        await reportGen.close();
      }

      const reportData = JSON.parse(report);

      const response = {
        success: true,
        data: {
          searchString,
          generatedAt: new Date().toISOString(),
          suppressProjects,
          summarize,
          lastOccurrence: reportData.lastOccurrence,
          summary: reportData.summary,
          projects: reportData.projects,
          dateRange: reportData.dateRange,
        },
        mcpCompatible: true,
      };

      // Add instruction for AI summarization if requested
      if (summarize) {
        response.data.aiInstructions =
          'Please provide a concise summary organized by project. Each project should be listed as its own section ' +
          'with the project name as the header followed by hours in parentheses. Do NOT group projects under ' +
          'arbitrary categories - treat each project as a first-class citizen. Do not skip projects. All projects mentioned ' +
          'should appear in the report at least once. For each project, synthesize the ' +
          'individual tasks into key accomplishments or themes and write a thoughtfully about ' +
          'the work completed. Do not summarize task by task, instead focus on all of the work accomplished and summarize ' +
          'the main activities. Focus on what was actually achieved or completed, not just ' +
          'activities performed. Tasks can have tags like this: [[]]. Tasks tagged as "important" should not be ignored and ' +
          'must be mentioned. Do not write in the second person. Do not make value judgements about the work done unless ' +
          'the original task description contains value judgements. Keep your opinion out of it. Just report the facts.';
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Validate entry via MCP interface
   * @async
   * @param {Object} args - Entry to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateEntry(args) {
    const { date, startTime, endTime, task, project, tags = [] } = args;

    try {
      // Ensure we have fresh data before validation
      await this.ensureFreshData();

      // Validate date
      const dateValidation = this.validator.validateDate(date);

      // Validate time range
      const timeValidation = this.validator.validateTimeRange(
        startTime,
        endTime
      );

      // Validate task
      const taskValidation = this.validator.validateTask(task);

      // Check for overlaps (requires database lookup)
      const existingEntries = await this.dataIndexer.getDailyEntries(date);
      const overlapValidation = this.validator.validateTimeOverlap(
        date,
        startTime,
        endTime,
        existingEntries
      );

      const allErrors = [
        ...dateValidation.errors,
        ...timeValidation.errors,
        ...taskValidation.errors,
        ...overlapValidation.errors,
      ];

      const allWarnings = [
        ...dateValidation.warnings,
        ...timeValidation.warnings,
        ...taskValidation.warnings,
        ...overlapValidation.warnings,
      ];

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        validation: {
          date: dateValidation,
          timeRange: timeValidation,
          task: taskValidation,
          overlap: overlapValidation,
        },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{ message: error.message, type: 'system' }],
        warnings: [],
        mcpCompatible: true,
      };
    }
  }

  /**
   * Get MCP resource content
   * @async
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async getResource(uri) {
    await this.initialize();

    switch (uri) {
      case 'temporal://projects':
        return this.getProjectsResource();

      case 'temporal://time-logs/current':
        return this.getCurrentTimeLogResource();

      default:
        throw new Error(`Unknown resource URI: ${uri}`);
    }
  }

  /**
   * Get projects resource
   * @async
   * @returns {Promise<Object>} Projects resource data
   */
  async getProjectsResource() {
    try {
      await this.ensureFreshData();
      const projects = await this.dataIndexer.getAllProjectSummaries();

      return {
        uri: 'temporal://projects',
        mimeType: 'application/json',
        content: JSON.stringify(
          {
            projects: projects.map((p) => ({
              name: p.project_name,
              status: p.status,
              startDate: p.start_date,
              totalHours: p.totalHours,
              entryCount: p.entryCount,
              departmentalGoals: this.parseJsonField(
                p.departmental_goals,
                'departmentalGoals'
              ),
              strategicDirections: this.parseJsonField(
                p.strategic_directions,
                'strategicDirections'
              ),
            })),
            totalProjects: projects.length,
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        ),
      };
    } catch (error) {
      throw new Error(`Failed to get projects resource: ${error.message}`);
    }
  }

  /**
   * Get current time log resource
   * @async
   * @returns {Promise<Object>} Current time log resource data
   */
  async getCurrentTimeLogResource() {
    try {
      // Get current fiscal year (this is a simplified approach)
      const currentYear = new Date().getFullYear();
      const fiscalYear = `${currentYear}-${currentYear + 1}`;

      const report = await this.generateReport({ fiscalYear });

      return {
        uri: 'temporal://time-logs/current',
        mimeType: 'application/json',
        content: JSON.stringify(
          {
            fiscalYear,
            summary: report.data?.report || {},
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        ),
      };
    } catch (error) {
      throw new Error(
        `Failed to get current time log resource: ${error.message}`
      );
    }
  }

  /**
   * Calculate duration between two times
   * @private
   * @param {string} startTime - Start time in HH:MM format
   * @param {string} endTime - End time in HH:MM format
   * @returns {number} Duration in hours
   */
  calculateDuration(startTime, endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let duration = endMinutes - startMinutes;
    if (duration < 0) {
      duration += 24 * 60; // Handle overnight entries
    }

    return duration / 60; // Convert to hours
  }

  /**
   * Generate date range report via MCP interface
   * @async
   * @param {Object} args - Report arguments
   * @returns {Promise<Object>} Date range report result
   */
  async generateDateRangeReport(args) {
    const {
      startDate,
      endDate,
      groupBy = 'departmentalGoal',
      sort = 'date',
      topTasks = 3,
    } = args;

    try {
      const DateRangeReport = require('./reportDateRange');
      const reportGen = new DateRangeReport();

      const report = await reportGen.generateReport(startDate, endDate, {
        groupBy,
        format: 'json',
        sort,
        topTasks,
      });

      return {
        success: true,
        reportType: 'dateRange',
        startDate,
        endDate,
        report: JSON.parse(report),
        options: { groupBy, sort, topTasks },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reportType: 'dateRange',
        startDate,
        endDate,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Generate weekly report via MCP interface
   * @async
   * @param {Object} args - Report arguments
   * @returns {Promise<Object>} Weekly report result
   */
  async generateWeeklyReport(args) {
    const {
      date,
      groupBy = 'departmentalGoal',
      sort = 'date',
      topTasks = 3,
    } = args;

    try {
      // Calculate week bounds
      const targetDate = date ? new Date(date) : new Date();
      const bounds = this.calculateWeekBounds(targetDate);

      const DateRangeReport = require('./reportDateRange');
      const reportGen = new DateRangeReport();

      const report = await reportGen.generateReport(bounds.start, bounds.end, {
        groupBy,
        format: 'json',
        sort,
        topTasks,
      });

      return {
        success: true,
        reportType: 'weekly',
        weekOf: bounds.start,
        targetDate: date || new Date().toISOString().split('T')[0],
        startDate: bounds.start,
        endDate: bounds.end,
        report: JSON.parse(report),
        options: { groupBy, sort, topTasks },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reportType: 'weekly',
        targetDate: date,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Generate monthly report via MCP interface
   * @async
   * @param {Object} args - Report arguments
   * @returns {Promise<Object>} Monthly report result
   */
  async generateMonthlyReport(args) {
    const {
      month,
      groupBy = 'departmentalGoal',
      sort = 'date',
      topTasks = 3,
    } = args;

    try {
      // Calculate month bounds
      const bounds = this.calculateMonthBounds(month);

      const DateRangeReport = require('./reportDateRange');
      const reportGen = new DateRangeReport();

      const report = await reportGen.generateReport(bounds.start, bounds.end, {
        groupBy,
        format: 'json',
        sort,
        topTasks,
      });

      return {
        success: true,
        reportType: 'monthly',
        month: bounds.start.substring(0, 7), // YYYY-MM format
        targetMonth: month,
        startDate: bounds.start,
        endDate: bounds.end,
        report: JSON.parse(report),
        options: { groupBy, sort, topTasks },
        mcpCompatible: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        reportType: 'monthly',
        targetMonth: month,
        mcpCompatible: true,
      };
    }
  }

  /**
   * Calculate week boundaries (Monday to Sunday) for a given date
   * @param {Date} date - Target date
   * @returns {Object} Object with start and end date strings
   * @private
   */
  calculateWeekBounds(date) {
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
   * @private
   */
  calculateMonthBounds(date) {
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
      throw new Error(
        `Invalid date format: ${date}. Use YYYY-MM-DD or YYYY-MM`
      );
    }

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  }

  /**
   * Safely parse JSON field with error handling
   * @private
   * @param {string} jsonString - JSON string to parse
   * @param {string} fieldName - Field name for error reporting
   * @returns {Array} Parsed array or empty array on error
   */
  parseJsonField(jsonString, fieldName) {
    if (
      !jsonString ||
      typeof jsonString !== 'string' ||
      jsonString.trim() === ''
    ) {
      return [];
    }

    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error(
        `Error parsing JSON field '${fieldName}': ${error.message}`
      );
      console.error(`Raw value: "${jsonString}" (type: ${typeof jsonString})`);
      return [];
    }
  }

  /**
   * Safely parse tags field (comma-separated string) with error handling
   * @private
   * @param {string} tagsString - Comma-separated tags string
   * @returns {Array} Array of tag strings or empty array on error
   */
  parseTagsField(tagsString) {
    if (
      !tagsString ||
      typeof tagsString !== 'string' ||
      tagsString.trim() === ''
    ) {
      return [];
    }

    try {
      return tagsString
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    } catch (error) {
      console.error(`Error parsing tags field: ${error.message}`);
      console.error(`Raw value: "${tagsString}" (type: ${typeof tagsString})`);
      return [];
    }
  }

  /**
   * Create a new project via MCP interface
   * @async
   * @param {Object} args - Project creation arguments
   * @param {string} args.projectName - Name of the project to create (required)
   * @param {Array<string>} [args.departmentalGoal] - Array of departmental goals
   * @param {Array<string>} [args.strategicDirection] - Array of strategic directions
   * @param {string} [args.status] - Project status
   * @param {string} [args.startDate] - Project start date (YYYY-MM-DD format)
   * @param {string} [args.summary] - Project summary/description
   * @param {Array<string>} [args.tags] - Array of project tags
   * @returns {Promise<Object>} Project creation result
   */
  async createProject(args) {
    const {
      projectName,
      departmentalGoal = ['General'],
      strategicDirection = ['General'],
      status = 'Active',
      startDate,
      summary,
      tags = [],
    } = args;

    try {
      // Ensure we have fresh data before proceeding
      await this.ensureFreshData();

      // Validate required field
      if (
        !projectName ||
        typeof projectName !== 'string' ||
        projectName.trim() === ''
      ) {
        return {
          success: false,
          error: 'Project name is required and must be a non-empty string',
          validation: {
            isValid: false,
            errors: ['Project name is required'],
            warnings: [],
          },
          mcpCompatible: true,
        };
      }

      // Prepare metadata with defaults
      const currentDate = new Date().toISOString().split('T')[0];
      const metadata = {
        departmentalGoal: Array.isArray(departmentalGoal)
          ? departmentalGoal
          : ['General'],
        strategicDirection: Array.isArray(strategicDirection)
          ? strategicDirection
          : ['General'],
        status: ['Active', 'Completed', 'On Hold', 'Cancelled'].includes(status)
          ? status
          : 'Active',
        startDate: startDate || currentDate,
        tags: Array.isArray(tags) ? tags : [],
        summary: summary || `Project created via MCP: ${projectName}`,
      };

      // Validate startDate format if provided
      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return {
          success: false,
          error: 'Start date must be in YYYY-MM-DD format',
          validation: {
            isValid: false,
            errors: ['Invalid startDate format'],
            warnings: [],
          },
          mcpCompatible: true,
        };
      }

      // Create the project using WikiLinkValidator
      const result = await this.wikiValidator.createProjectForWikiLink(
        projectName,
        metadata
      );

      if (this.options.enableLogging) {
        console.log(`MCP: Created project "${projectName}"`);
      }

      return {
        success: true,
        message: `Project "${projectName}" created successfully`,
        project: {
          name: projectName,
          ...metadata,
          filePath: result.filePath,
        },
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_create_project',
          action: 'create_project',
        },
        mcpCompatible: true,
      };
    } catch (error) {
      this.errorLogger.logError('MCP create project error', error);

      // Handle specific error types
      let errorMessage = error.message;
      let errorType = 'unknown';

      if (error.message.includes('already exists')) {
        errorType = 'conflict';
        errorMessage = `Project "${projectName}" already exists`;
      } else if (
        error.message.includes('Invalid') ||
        error.message.includes('must be')
      ) {
        errorType = 'validation';
      }

      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        mcp_context: {
          tool: 'temporal_mark_create_project',
          action: 'create_project',
          error_type: errorType,
        },
        mcpCompatible: true,
      };
    }
  }

  /**
   * Clean up resources
   * @async
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.dataIndexer) {
      await this.dataIndexer.close();
    }
    this.isInitialized = false;
  }
}

module.exports = MCPIntegration;
