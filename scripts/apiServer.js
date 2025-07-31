/**
 * @fileoverview REST API server for Temporal Mark
 * Provides HTTP endpoints for time tracking operations
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const path = require('path'); // Unused for now

// Import Temporal Mark modules
const InputValidator = require('./inputValidator');
const DataIndexer = require('./dataIndexer');
const AddEntry = require('./addEntry');
const TimeTracker = require('./timeTracker');
const errorLogger = require('./errorLogger');

/**
 * Temporal Mark REST API Server
 * Provides HTTP endpoints for time tracking operations while maintaining
 * compatibility with the existing CLI-based system
 */
class ApiServer {
  /**
   * Initialize the API server
   * @param {Object} options - Server configuration options
   * @param {number} options.port - Port to run the server on (default: 3000)
   * @param {string} options.host - Host to bind to (default: 'localhost')
   * @param {boolean} options.enableCors - Enable CORS middleware (default: true)
   * @param {boolean} options.enableSecurity - Enable security middleware (default: true)
   */
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      host: options.host || 'localhost',
      enableCors: options.enableCors !== false,
      enableSecurity: options.enableSecurity !== false,
      ...options,
    };

    this.app = express();
    this.validator = new InputValidator();
    this.dataIndexer = new DataIndexer();
    this.errorLogger = errorLogger;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Set up Express middleware
   * @private
   */
  setupMiddleware() {
    // Security middleware
    if (this.options.enableSecurity) {
      this.app.use(helmet());
    }

    // CORS middleware
    if (this.options.enableCors) {
      this.app.use(
        cors({
          origin: process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3000',
          ],
          credentials: true,
        })
      );
    }

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.errorLogger.logActivity(
        `API Request: ${req.method} ${req.path} from ${req.ip}`
      );
      next();
    });
  }

  /**
   * Set up API routes
   * @private
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: require('../package.json').version,
      });
    });

    // API info endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'Temporal Mark API',
        version: require('../package.json').version,
        description: 'REST API for Temporal Mark time tracking system',
        endpoints: {
          'POST /api/add': 'Create a new time entry',
          'POST /api/start': 'Start tracking time for a new task',
          'POST /api/finish': 'Finish the current active time entry',
          'GET /api/daily/:date': 'Get daily time entries',
          'GET /api/project/:name': 'Get project summary',
          'GET /api/tag/:tag': 'Get tag summary',
          'GET /api/report/:fiscalYear': 'Generate fiscal year report',
          'GET /api/range/:startDate/:endDate':
            'Generate custom date range report',
          'GET /api/weekly': 'Generate current week report',
          'GET /api/weekly/:date': 'Generate weekly report for date',
          'GET /api/monthly': 'Generate current month report',
          'GET /api/monthly/:month': 'Generate monthly report (YYYY-MM format)',
        },
        documentation: '/api/docs',
      });
    });

    // Set up API routes with /api prefix
    this.setupAddRoute();
    this.setupStartRoute();
    this.setupFinishRoute();
    this.setupDailyRoute();
    this.setupProjectRoute();
    this.setupTagRoute();
    this.setupReportRoute();
    this.setupDateRangeRoutes();
  }

  /**
   * Set up POST /api/add endpoint for creating time entries
   * @private
   */
  setupAddRoute() {
    this.app.post('/api/add', async (req, res) => {
      try {
        const { date, startTime, endTime, task, project, tags, notes } =
          req.body;

        // Validate required fields
        if (!date || !startTime || !endTime || !task || !project) {
          return res.status(400).json({
            error: 'Missing required fields',
            required: ['date', 'startTime', 'endTime', 'task', 'project'],
            received: Object.keys(req.body),
          });
        }

        // Create AddEntry instance and process the entry
        const addEntry = new AddEntry();
        const result = await addEntry.addEntry({
          date,
          start: startTime, // Map API field to CLI field
          end: endTime, // Map API field to CLI field
          task,
          project,
          tags: Array.isArray(tags) ? tags.join(',') : tags || '', // Convert array to comma string
          notes: notes || '',
        });

        if (result.success) {
          res.status(201).json({
            message: 'Time entry created successfully',
            entry: result.entry,
            validation: result.validation,
          });
        } else {
          res.status(400).json({
            error: 'Failed to create time entry',
            details: result.error,
            validation: result.validation,
          });
        }
      } catch (error) {
        this.errorLogger.logError('API /add endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to process time entry',
        });
      }
    });
  }

  /**
   * Set up POST /api/start endpoint for starting time tracking
   * @private
   */
  setupStartRoute() {
    this.app.post('/api/start', async (req, res) => {
      try {
        const { task, project, tags, notes, date, start } = req.body;

        // Validate required fields
        if (!task || task.trim() === '') {
          return res.status(400).json({
            error: 'Missing required field: task',
            required: ['task'],
            received: Object.keys(req.body),
          });
        }

        // Create TimeTracker instance and start entry
        const timeTracker = new TimeTracker({ silent: true });
        const result = await timeTracker.startEntry({
          task,
          project,
          tags,
          notes,
          date,
          start,
        });

        res.status(201).json({
          message: result.message,
          entry: result.entry,
          filePath: result.filePath,
          success: true,
        });
      } catch (error) {
        this.errorLogger.logError('API /start endpoint error', error);

        // Handle known errors with appropriate status codes
        if (error.message.includes('already exists')) {
          res.status(409).json({
            error: 'Conflict',
            message: error.message,
          });
        } else if (error.message.includes('Invalid')) {
          res.status(400).json({
            error: 'Validation error',
            message: error.message,
          });
        } else {
          res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to start time tracking',
          });
        }
      }
    });
  }

  /**
   * Set up POST /api/finish endpoint for finishing time tracking
   * @private
   */
  setupFinishRoute() {
    this.app.post('/api/finish', async (req, res) => {
      try {
        const { end, notes } = req.body;

        // Create TimeTracker instance and finish entry
        const timeTracker = new TimeTracker({ silent: true });
        const result = await timeTracker.finishEntry({
          end,
          notes,
        });

        res.status(200).json({
          message: result.message,
          entry: result.entry,
          duration: result.duration,
          filePath: result.filePath,
          success: true,
        });
      } catch (error) {
        this.errorLogger.logError('API /finish endpoint error', error);

        // Handle known errors with appropriate status codes
        if (error.message.includes('No active entry found')) {
          res.status(404).json({
            error: 'No active entry',
            message: error.message,
          });
        } else if (
          error.message.includes('Invalid') ||
          error.message.includes('must be after')
        ) {
          res.status(400).json({
            error: 'Validation error',
            message: error.message,
          });
        } else {
          res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to finish time tracking',
          });
        }
      }
    });
  }

  /**
   * Set up GET /api/daily/:date endpoint for daily views
   * @private
   */
  setupDailyRoute() {
    this.app.get('/api/daily/:date', async (req, res) => {
      try {
        const { date } = req.params;

        // Initialize data indexer first
        await this.dataIndexer.initialize();

        // Validate date format
        const dateValidation = this.validator.validateDate(date);
        if (!dateValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid date format',
            expected: 'YYYY-MM-DD',
            received: date,
            validation: dateValidation,
          });
        }

        // Get daily entries from data indexer
        const entries = await this.dataIndexer.getDailyEntries(date);
        const summary = await this.dataIndexer.getDailySummary(date);

        res.json({
          date,
          entries,
          summary,
          metadata: {
            totalEntries: entries.length,
            totalHours: summary.totalLoggedHours,
            gaps: summary.gaps || [],
          },
        });
      } catch (error) {
        console.error('API /daily endpoint detailed error:', error);
        this.errorLogger.logError('API /daily endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve daily entries',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }
    });
  }

  /**
   * Set up GET /api/project/:name endpoint for project summaries
   * @private
   */
  setupProjectRoute() {
    this.app.get('/api/project/:name', async (req, res) => {
      try {
        const { name } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        // Initialize data indexer first
        await this.dataIndexer.initialize();

        // Get project data
        const projectData = await this.dataIndexer.getProjectSummary(name);
        const recentEntries = await this.dataIndexer.getProjectEntries(name, {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        });

        if (!projectData) {
          return res.status(404).json({
            error: 'Project not found',
            project: name,
            suggestion:
              'Check project name spelling or create the project first',
          });
        }

        res.json({
          project: name,
          summary: projectData,
          recentEntries,
          metadata: {
            totalEntries: recentEntries.length,
            hasMore: recentEntries.length === parseInt(limit, 10),
          },
        });
      } catch (error) {
        console.error('API /project endpoint detailed error:', error);
        this.errorLogger.logError('API /project endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve project data',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
      }
    });
  }

  /**
   * Set up GET /api/tag/:tag endpoint for tag summaries
   * @private
   */
  setupTagRoute() {
    this.app.get('/api/tag/:tag', async (req, res) => {
      try {
        const { tag } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        // Get tag data
        const tagData = await this.dataIndexer.getTagSummary(tag);
        const tagEntries = await this.dataIndexer.getTagEntries(tag, {
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        });

        res.json({
          tag,
          summary: tagData,
          entries: tagEntries,
          metadata: {
            totalEntries: tagEntries.length,
            hasMore: tagEntries.length === parseInt(limit, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /tag endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve tag data',
        });
      }
    });
  }

  /**
   * Set up GET /api/report/:fiscalYear endpoint for fiscal year reports
   * @private
   */
  setupReportRoute() {
    this.app.get('/api/report/:fiscalYear', async (req, res) => {
      try {
        const { fiscalYear } = req.params;
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'hours',
          topTasks = 3,
        } = req.query;

        // Validate fiscal year format
        const yearValidation = this.validator.validateFiscalYear(fiscalYear);
        if (!yearValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid fiscal year format',
            expected: 'YYYY-YYYY',
            received: fiscalYear,
            validation: yearValidation,
          });
        }

        // Generate report using existing reportFiscalYear module
        const ReportGenerator = require('./reportFiscalYear');
        const reportGen = new ReportGenerator();

        const report = await reportGen.generateReport(fiscalYear, {
          groupBy,
          format: 'json', // Always return JSON for API
          sort,
          topTasks: parseInt(topTasks, 10),
        });

        res.json({
          fiscalYear,
          report,
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /report endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to generate report',
        });
      }
    });
  }

  /**
   * Set up date range reporting endpoints
   * @private
   */
  setupDateRangeRoutes() {
    // GET /api/range/:startDate/:endDate - Custom date range report
    this.app.get('/api/range/:startDate/:endDate', async (req, res) => {
      try {
        const { startDate, endDate } = req.params;
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'date',
          topTasks = 3,
        } = req.query;

        // Generate report using DateRangeReport module
        const DateRangeReport = require('./reportDateRange');
        const reportGen = new DateRangeReport();

        const report = await reportGen.generateReport(startDate, endDate, {
          groupBy,
          format: 'json', // Always return JSON for API
          sort,
          topTasks: parseInt(topTasks, 10),
        });

        res.json({
          reportType: 'dateRange',
          startDate,
          endDate,
          report: JSON.parse(report),
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /range endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message.includes('No time entries found')
            ? 'No time entries found for the specified date range'
            : 'Failed to generate date range report',
        });
      }
    });

    // GET /api/weekly - Current week report
    this.app.get('/api/weekly', async (req, res) => {
      try {
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'date',
          topTasks = 3,
        } = req.query;

        // Calculate current week bounds
        const bounds = this.calculateWeekBounds(new Date());

        // Generate report using DateRangeReport module
        const DateRangeReport = require('./reportDateRange');
        const reportGen = new DateRangeReport();

        const report = await reportGen.generateReport(
          bounds.start,
          bounds.end,
          {
            groupBy,
            format: 'json',
            sort,
            topTasks: parseInt(topTasks, 10),
          }
        );

        res.json({
          reportType: 'weekly',
          weekOf: bounds.start,
          startDate: bounds.start,
          endDate: bounds.end,
          report: JSON.parse(report),
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /weekly endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message.includes('No time entries found')
            ? 'No time entries found for the current week'
            : 'Failed to generate weekly report',
        });
      }
    });

    // GET /api/weekly/:date - Weekly report for specific date
    this.app.get('/api/weekly/:date', async (req, res) => {
      try {
        const { date } = req.params;
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'date',
          topTasks = 3,
        } = req.query;

        // Validate date format
        const dateValidation = this.validator.validateDate(date);
        if (!dateValidation.isValid) {
          return res.status(400).json({
            error: 'Invalid date format',
            expected: 'YYYY-MM-DD',
            received: date,
            validation: dateValidation,
          });
        }

        // Calculate week bounds for the specified date
        const bounds = this.calculateWeekBounds(new Date(date));

        // Generate report using DateRangeReport module
        const DateRangeReport = require('./reportDateRange');
        const reportGen = new DateRangeReport();

        const report = await reportGen.generateReport(
          bounds.start,
          bounds.end,
          {
            groupBy,
            format: 'json',
            sort,
            topTasks: parseInt(topTasks, 10),
          }
        );

        res.json({
          reportType: 'weekly',
          weekOf: bounds.start,
          targetDate: date,
          startDate: bounds.start,
          endDate: bounds.end,
          report: JSON.parse(report),
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /weekly/:date endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message.includes('No time entries found')
            ? `No time entries found for week containing ${req.params.date}`
            : 'Failed to generate weekly report',
        });
      }
    });

    // GET /api/monthly - Current month report
    this.app.get('/api/monthly', async (req, res) => {
      try {
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'date',
          topTasks = 3,
        } = req.query;

        // Calculate current month bounds
        const bounds = this.calculateMonthBounds();

        // Generate report using DateRangeReport module
        const DateRangeReport = require('./reportDateRange');
        const reportGen = new DateRangeReport();

        const report = await reportGen.generateReport(
          bounds.start,
          bounds.end,
          {
            groupBy,
            format: 'json',
            sort,
            topTasks: parseInt(topTasks, 10),
          }
        );

        res.json({
          reportType: 'monthly',
          month: bounds.start.substring(0, 7), // YYYY-MM format
          startDate: bounds.start,
          endDate: bounds.end,
          report: JSON.parse(report),
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /monthly endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message.includes('No time entries found')
            ? 'No time entries found for the current month'
            : 'Failed to generate monthly report',
        });
      }
    });

    // GET /api/monthly/:month - Monthly report for specific month
    this.app.get('/api/monthly/:month', async (req, res) => {
      try {
        const { month } = req.params;
        const {
          groupBy = 'departmentalGoal',
          format: _format = 'json',
          sort = 'date',
          topTasks = 3,
        } = req.query;

        // Calculate month bounds for the specified month
        const bounds = this.calculateMonthBounds(month);

        // Generate report using DateRangeReport module
        const DateRangeReport = require('./reportDateRange');
        const reportGen = new DateRangeReport();

        const report = await reportGen.generateReport(
          bounds.start,
          bounds.end,
          {
            groupBy,
            format: 'json',
            sort,
            topTasks: parseInt(topTasks, 10),
          }
        );

        res.json({
          reportType: 'monthly',
          month: month.substring(0, 7), // YYYY-MM format
          startDate: bounds.start,
          endDate: bounds.end,
          report: JSON.parse(report),
          metadata: {
            generatedAt: new Date().toISOString(),
            groupBy,
            sort,
            topTasks: parseInt(topTasks, 10),
          },
        });
      } catch (error) {
        this.errorLogger.logError('API /monthly/:month endpoint error', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error.message.includes('No time entries found')
            ? `No time entries found for ${req.params.month}`
            : error.message.includes('Invalid date format')
              ? 'Invalid month format. Use YYYY-MM or YYYY-MM-DD'
              : 'Failed to generate monthly report',
        });
      }
    });
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
   * Set up error handling middleware
   * @private
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        suggestion: 'Check the API documentation at /api',
      });
    });

    // Global error handler
    this.app.use((error, req, res, _next) => {
      this.errorLogger.logError('Unhandled API error', error);

      res.status(500).json({
        error: 'Internal server error',
        message:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'Something went wrong',
      });
    });
  }

  /**
   * Start the API server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.options.port,
          this.options.host,
          () => {
            console.log(
              `🚀 Temporal Mark API server running on http://${this.options.host}:${this.options.port}`
            );
            console.log(
              `📖 API documentation available at http://${this.options.host}:${this.options.port}/api`
            );
            this.errorLogger.logActivity(
              `API server started on ${this.options.host}:${this.options.port}`
            );
            resolve();
          }
        );

        this.server.on('error', (error) => {
          this.errorLogger.logError('Server startup error', error);
          reject(error);
        });
      } catch (error) {
        this.errorLogger.logError('Failed to start API server', error);
        reject(error);
      }
    });
  }

  /**
   * Stop the API server gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 Temporal Mark API server stopped');
          this.errorLogger.logActivity('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = ApiServer;
