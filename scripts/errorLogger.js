/**
 * @fileoverview Error logging and activity tracking system with log rotation
 * Provides structured logging for errors, warnings, and system activities
 * with automatic log rotation and cleanup functionality.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

/**
 * Centralized logging system for errors, warnings, and activity tracking
 * Provides structured logging with automatic rotation and cleanup
 *
 * @class ErrorLogger
 */
class ErrorLogger {
  /**
   * Initialize the ErrorLogger with log directory and file paths
   * @constructor
   * @param {string} [logDir] - Directory for log files (default: ../logs)
   */
  constructor(logDir = path.join(__dirname, '../logs')) {
    this.logDir = logDir;
    this.errorLogFile = path.join(logDir, 'errors.log');
    this.activityLogFile = path.join(logDir, 'activity.log');

    // Ensure logs directory exists
    this.ensureLogDirectory();
  }

  /**
   * Ensure the logs directory exists, creating it if necessary
   * @private
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log an error with full stack trace and optional context
   * Includes timestamp, error message, stack trace, and contextual information
   *
   * @param {Error} error - Error object to log
   * @param {Object} [context={}] - Additional context information
   */
  logError(error, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr =
      Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';

    const logEntry = [
      `${timestamp} - ERROR`,
      `Message: ${error.message}`,
      `Stack: ${error.stack}`,
      contextStr ? `Context: ${contextStr}` : '',
      '---',
      '',
    ]
      .filter((line) => line !== '')
      .join('\n');

    this.writeToLog(this.errorLogFile, logEntry);

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[${timestamp}] ERROR:`, error.message);
      if (Object.keys(context).length > 0) {
        console.error('Context:', context);
      }
    }
  }

  /**
   * Log a warning message with optional context
   * Records non-fatal issues that should be monitored
   *
   * @param {string} message - Warning message to log
   * @param {Object} [context={}] - Additional context information
   */
  logWarning(message, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr =
      Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';

    const logEntry = [
      `${timestamp} - WARNING`,
      `Message: ${message}`,
      contextStr ? `Context: ${contextStr}` : '',
      '---',
      '',
    ]
      .filter((line) => line !== '')
      .join('\n');

    this.writeToLog(this.errorLogFile, logEntry);
  }

  /**
   * Log activity and informational messages
   * Records system activities, operations, and significant events
   *
   * @param {string} action - Action or activity being logged
   * @param {Object} [details={}] - Detailed information about the activity
   */
  logActivity(action, details = {}) {
    const timestamp = new Date().toISOString();
    const detailsStr =
      Object.keys(details).length > 0 ? JSON.stringify(details, null, 2) : '';

    const logEntry = [
      `${timestamp} - ${action}`,
      detailsStr ? `Details: ${detailsStr}` : '',
      '',
    ]
      .filter((line) => line !== '')
      .join('\n');

    this.writeToLog(this.activityLogFile, logEntry);
  }

  /**
   * Log validation errors with specific field information
   * Specialized logging for input validation failures
   *
   * @param {string} field - Field name that failed validation
   * @param {*} value - Value that failed validation
   * @param {string} expectedFormat - Expected format or constraint
   * @param {Object} [context={}] - Additional validation context
   */
  logValidationError(field, value, expectedFormat, context = {}) {
    const error = new Error(
      `Validation failed for field '${field}': '${value}' does not match expected format '${expectedFormat}'`
    );

    this.logError(error, {
      type: 'VALIDATION_ERROR',
      field,
      value,
      expectedFormat,
      ...context,
    });
  }

  /**
   * Log database errors with query information
   * Specialized logging for database operation failures
   *
   * @param {Error} error - Database error object
   * @param {string} [query=''] - SQL query that caused the error
   * @param {Array} [params=[]] - Query parameters
   */
  logDatabaseError(error, query = '', params = []) {
    this.logError(error, {
      type: 'DATABASE_ERROR',
      query,
      params,
    });
  }

  /**
   * Log file operation errors
   * Specialized logging for file system operation failures
   *
   * @param {Error} error - File operation error
   * @param {string} operation - Type of file operation that failed
   * @param {string} filePath - Path to file involved in operation
   */
  logFileError(error, operation, filePath) {
    this.logError(error, {
      type: 'FILE_ERROR',
      operation,
      filePath,
    });
  }

  /**
   * Log parsing errors for various content types
   * Specialized logging for Markdown, YAML, JSON parsing failures
   *
   * @param {Error} error - Parsing error object
   * @param {string} parserType - Type of parser (markdown, yaml, json, etc.)
   * @param {string} content - Content that failed to parse
   * @param {string} [filePath=''] - Path to file being parsed
   */
  logParsingError(error, parserType, content, filePath = '') {
    this.logError(error, {
      type: 'PARSING_ERROR',
      parserType,
      contentLength: content ? content.length : 0,
      filePath,
    });
  }

  /**
   * Write content to log file with automatic rotation if needed
   * Rotates log files when they exceed 10MB to prevent excessive file sizes
   *
   * @private
   * @param {string} logFile - Path to log file
   * @param {string} content - Content to write to log
   */
  writeToLog(logFile, content) {
    try {
      // Check file size and rotate if needed (>10MB)
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > 10 * 1024 * 1024) {
          // 10MB
          this.rotateLog(logFile);
        }
      }

      fs.appendFileSync(logFile, content, 'utf8');
    } catch (writeError) {
      // Fallback to console if we can't write to log file
      console.error('Failed to write to log file:', writeError.message);
      console.error('Original log content:', content);
    }
  }

  /**
   * Rotate log file when it gets too large
   * Creates timestamped backup and starts fresh log file
   *
   * @private
   * @param {string} logFile - Path to log file to rotate
   */
  rotateLog(logFile) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = logFile.replace('.log', `_${timestamp}.log`);

    try {
      fs.renameSync(logFile, rotatedFile);
    } catch (rotateError) {
      console.error('Failed to rotate log file:', rotateError.message);
    }
  }

  /**
   * Get recent error log entries
   * Returns the last N lines from the error log for troubleshooting
   *
   * @param {number} [count=50] - Number of recent lines to return
   * @returns {string} Recent error log content
   */
  getRecentErrors(count = 50) {
    try {
      if (!fs.existsSync(this.errorLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.errorLogFile, 'utf8');
      const lines = content.trim().split('\n');

      // Return last N lines
      return lines.slice(-count).join('\n');
    } catch (error) {
      console.error('Failed to read error log:', error.message);
      return [];
    }
  }

  /**
   * Clean up old log entries to manage disk space
   * Removes log entries older than specified number of days
   *
   * @param {number} [daysToKeep=30] - Number of days of logs to retain
   */
  cleanupLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    [this.errorLogFile, this.activityLogFile].forEach((logFile) => {
      try {
        if (!fs.existsSync(logFile)) return;

        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.split('\n');

        const filteredLines = lines.filter((line) => {
          const match = line.match(
            /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/
          );
          if (!match) return true; // Keep non-timestamp lines

          const lineDate = new Date(match[1]);
          return lineDate >= cutoffDate;
        });

        if (filteredLines.length < lines.length) {
          fs.writeFileSync(logFile, filteredLines.join('\n'), 'utf8');
          this.logActivity('LOG_CLEANUP', {
            file: path.basename(logFile),
            originalLines: lines.length,
            remainingLines: filteredLines.length,
            daysToKeep,
          });
        }
      } catch (error) {
        console.error(`Failed to cleanup log file ${logFile}:`, error.message);
      }
    });
  }

  /**
   * Create a summary of recent errors for monitoring
   * Analyzes error log to provide statistics and recent error information
   *
   * @param {number} [hours=24] - Number of hours to analyze for recent errors
   * @returns {Object} Error summary with total count, recent errors, and summary message
   */
  getErrorSummary(hours = 24) {
    try {
      if (!fs.existsSync(this.errorLogFile)) {
        return {
          totalErrors: 0,
          recentErrors: [],
          summary: 'No errors logged',
        };
      }

      const content = fs.readFileSync(this.errorLogFile, 'utf8');
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hours);

      const errorBlocks = content
        .split('---\n')
        .filter((block) => block.trim());
      const recentErrors = [];

      errorBlocks.forEach((block) => {
        const lines = block.trim().split('\n');
        const timestampLine = lines[0];
        const match = timestampLine.match(
          /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/
        );

        if (match) {
          const errorTime = new Date(match[1]);
          if (errorTime >= cutoffTime) {
            const messageLine = lines.find((line) =>
              line.startsWith('Message:')
            );
            const message = messageLine
              ? messageLine.replace('Message: ', '')
              : 'Unknown error';

            recentErrors.push({
              timestamp: errorTime.toISOString(),
              message,
            });
          }
        }
      });

      return {
        totalErrors: errorBlocks.length,
        recentErrors,
        summary:
          recentErrors.length > 0
            ? `${recentErrors.length} errors in the last ${hours} hours`
            : `No errors in the last ${hours} hours`,
      };
    } catch (error) {
      return {
        totalErrors: 0,
        recentErrors: [],
        summary: 'Failed to read error log',
      };
    }
  }
}

// Export singleton instance
module.exports = new ErrorLogger();
