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
            },
            required: ['fiscalYear'],
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

        case 'temporal_mark_validate_entry':
          return this.validateEntry(args);

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
      const addEntry = new AddEntry();

      // Format arguments for AddEntry class
      const entryOptions = {
        date,
        start: startTime,
        end: endTime,
        task,
        project,
        tags: Array.isArray(tags) ? tags.join(',') : tags,
        notes,
      };

      const result = await addEntry.addEntry(entryOptions);

      return {
        success: true,
        message: 'Time entry added successfully',
        entry: {
          date,
          startTime,
          endTime,
          task,
          project,
          tags: Array.isArray(tags)
            ? tags
            : tags.split(',').map((t) => t.trim()),
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
        validation,
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
            tags: entry.tags ? entry.tags.split(',') : [],
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
            departmentalGoals: summary.project.departmental_goals
              ? JSON.parse(summary.project.departmental_goals)
              : [],
            strategicDirections: summary.project.strategic_directions
              ? JSON.parse(summary.project.strategic_directions)
              : [],
            tags: summary.project.tags ? JSON.parse(summary.project.tags) : [],
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
            tags: entry.tags ? entry.tags.split(',') : [],
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
    } = args;

    try {
      const ReportGenerator = require('./reportFiscalYear');
      const reportGen = new ReportGenerator();

      const report = await reportGen.generateReport(fiscalYear, {
        groupBy,
        format: 'json',
        sort,
        topTasks,
      });

      return {
        success: true,
        data: {
          fiscalYear,
          generatedAt: new Date().toISOString(),
          groupBy,
          sort,
          topTasks,
          report,
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
   * Validate entry via MCP interface
   * @async
   * @param {Object} args - Entry to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateEntry(args) {
    const { date, startTime, endTime, task, project, tags = [] } = args;

    try {
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
              departmentalGoals: p.departmental_goals
                ? JSON.parse(p.departmental_goals)
                : [],
              strategicDirections: p.strategic_directions
                ? JSON.parse(p.strategic_directions)
                : [],
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
