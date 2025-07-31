/**
 * @fileoverview Data indexing and database management system
 * Coordinates indexing of projects and time logs into SQLite database
 * and provides comprehensive data retrieval and summary operations.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const path = require('path');
const fs = require('fs');
const MarkdownDB = require('./markdownDB');
const TimeDataParser = require('./computeTimeData');
const ProjectParser = require('./projectParser');

/**
 * Manages data indexing and provides unified access to project and time log data
 * Coordinates between file parsing, database operations, and data retrieval
 *
 * @class DataIndexer
 */
class DataIndexer {
  /**
   * Initialize the DataIndexer with directory paths and component instances
   * @constructor
   * @param {string} [rootDir] - Root project directory (default: parent directory)
   */
  constructor(rootDir = path.join(__dirname, '..')) {
    this.rootDir = rootDir;
    this.projectsDir = path.join(rootDir, 'projects');
    this.timeLogsDir = path.join(rootDir, 'time-logs');

    this.db = new MarkdownDB();
    this.timeParser = new TimeDataParser();
    this.projectParser = new ProjectParser();
  }

  /**
   * Initialize the database connection and prepare for indexing operations
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.db.init();

    // Check if database is empty and auto-index if needed
    try {
      const timeEntryCount = await this.db.getTimeEntryCount();
      if (timeEntryCount === 0) {
        console.log('Database is empty. Auto-indexing from Markdown files...');
        await this.indexAllData();
      }
    } catch (error) {
      // If error checking count, database might be corrupted - try to index anyway
      console.log('Database check failed. Attempting to index data...');
      await this.indexAllData();
    }
  }

  /**
   * Index all data including projects and time logs
   * Performs comprehensive indexing of all markdown files into the database
   *
   * @async
   * @returns {Promise<Object>} Indexing results with counts and error details
   * @throws {Error} When fatal indexing errors occur
   */
  async indexAllData() {
    console.log('Starting data indexing...');

    const results = {
      projects: { indexed: 0, errors: [] },
      timeEntries: { indexed: 0, errors: [] },
    };

    try {
      // Index projects first
      const projectResults = await this.indexProjects();
      results.projects = projectResults;

      // Index time logs
      const timeLogResults = await this.indexTimeLogs();
      results.timeEntries = timeLogResults;

      console.log(
        `Indexing complete. Projects: ${results.projects.indexed}, Time entries: ${results.timeEntries.indexed}`
      );

      if (
        results.projects.errors.length > 0 ||
        results.timeEntries.errors.length > 0
      ) {
        console.log('Errors encountered during indexing:');
        [...results.projects.errors, ...results.timeEntries.errors].forEach(
          (error) => {
            console.error(`- ${error}`);
          }
        );
      }
    } catch (error) {
      console.error('Fatal error during indexing:', error.message);
      throw error;
    }

    return results;
  }

  /**
   * Index all project files from the projects directory
   * Parses project markdown files and stores them in the database
   *
   * @async
   * @returns {Promise<Object>} Project indexing results with counts and errors
   */
  async indexProjects() {
    console.log('Indexing projects...');

    const results = { indexed: 0, errors: [] };

    try {
      const { projects, errors } = this.projectParser.parseAllProjectFiles(
        this.projectsDir
      );

      // Add parsing errors to results
      errors.forEach((error) => {
        results.errors.push(
          `Project parsing error in ${error.file}: ${error.error}`
        );
      });

      // Ensure database is fully ready before processing projects
      await new Promise((resolve) => {
        setTimeout(() => resolve(), 100);
      });

      // Insert valid projects into database (sequentially to avoid connection issues)
      for (const project of projects) {
        try {
          await this.db.insertProject(project);
          results.indexed++;
          console.log(`✓ Indexed project: ${project.projectName}`);
          // Small delay to ensure database stability
          await new Promise((resolve) => {
            setTimeout(() => resolve(), 10);
          });
        } catch (error) {
          results.errors.push(
            `Database error for project ${project.projectName}: ${error.message}`
          );
          console.error(
            `✗ Failed to index ${project.projectName}: ${error.message}`
          );
        }
      }
    } catch (error) {
      results.errors.push(
        `Failed to read projects directory: ${error.message}`
      );
    }

    return results;
  }

  /**
   * Index all time log files from the time-logs directory
   * Parses time log markdown files and validates for overlaps
   *
   * @async
   * @returns {Promise<Object>} Time log indexing results with counts and errors
   */
  async indexTimeLogs() {
    console.log('Indexing time logs...');

    const results = { indexed: 0, errors: [] };

    try {
      const timeLogFiles = this.findTimeLogFiles();

      for (const filePath of timeLogFiles) {
        try {
          const entries = this.timeParser.parseTimeLogFile(filePath);

          // Check for overlaps in each day
          const entriesByDate = this.groupEntriesByDate(entries);
          for (const [date, dayEntries] of Object.entries(entriesByDate)) {
            const overlaps = this.timeParser.checkForOverlaps(dayEntries);
            if (overlaps.length > 0) {
              overlaps.forEach((overlap) => {
                results.errors.push(
                  `Time overlap on ${date}: ${overlap.entry1.startTime}-${overlap.entry1.endTime} (${overlap.entry1.task}) overlaps with ${overlap.entry2.startTime}-${overlap.entry2.endTime} (${overlap.entry2.task})`
                );
              });
            }
          }

          // Insert entries into database
          for (const entry of entries) {
            try {
              await this.db.insertTimeEntry(entry);
              results.indexed++;
            } catch (error) {
              results.errors.push(
                `Database error for entry on ${entry.date} at ${entry.startTime}: ${error.message}`
              );
            }
          }

          console.log(
            `✓ Indexed ${entries.length} entries from ${path.basename(filePath)}`
          );
        } catch (error) {
          results.errors.push(
            `Failed to parse time log ${filePath}: ${error.message}`
          );
        }
      }
    } catch (error) {
      results.errors.push(
        `Failed to read time logs directory: ${error.message}`
      );
    }

    return results;
  }

  /**
   * Find all time log files in the time-logs directory
   * Scans for files matching the time-log-*.md pattern
   *
   * @returns {Array<string>} Array of full file paths to time log files
   */
  findTimeLogFiles() {
    const files = [];

    if (fs.existsSync(this.timeLogsDir)) {
      const dirContents = fs.readdirSync(this.timeLogsDir);

      dirContents.forEach((item) => {
        const itemPath = path.join(this.timeLogsDir, item);
        const stat = fs.statSync(itemPath);

        if (
          stat.isFile() &&
          item.endsWith('.md') &&
          item.startsWith('time-log-')
        ) {
          files.push(itemPath);
        }
      });
    }

    return files;
  }

  /**
   * Group time entries by date for processing
   * Organizes entries into date-based collections for overlap detection
   *
   * @param {Array<Object>} entries - Array of time entry objects
   * @returns {Object<string, Array>} Object with dates as keys and entry arrays as values
   */
  groupEntriesByDate(entries) {
    const grouped = {};
    entries.forEach((entry) => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    return grouped;
  }

  /**
   * Get comprehensive daily summary for a specific date
   * Includes time entries, gaps between entries, and total hours
   *
   * @async
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Daily summary with entries, gaps, and totals
   */
  async getDailySummary(date) {
    const entries = await this.db.getTimeEntriesForDate(date);
    const gaps = this.timeParser.findGapsInDay(entries);
    const totalLoggedHours = this.timeParser.getTotalLoggedHours(entries);
    const totalGapHours = gaps.reduce(
      (total, gap) => total + gap.durationHours,
      0
    );

    return {
      date,
      entries,
      gaps,
      totalLoggedHours,
      totalGapHours,
    };
  }

  /**
   * Get comprehensive project summary with time entries
   * Includes project metadata and all associated time entries
   *
   * @async
   * @param {string} projectName - Name of the project
   * @returns {Promise<Object>} Project summary with metadata, entries, and totals
   */
  async getProjectSummary(projectName) {
    const project = await this.db.getProject(projectName);
    const entries = await this.db.getTimeEntriesForProject(projectName);
    const totalHours = this.timeParser.getTotalLoggedHours(entries);

    return {
      project,
      entries,
      totalHours,
      entryCount: entries.length,
    };
  }

  /**
   * Get comprehensive tag summary with time entries
   * Includes all entries tagged with the specified tag and usage statistics
   *
   * @async
   * @param {string} tag - Tag name to summarize
   * @returns {Promise<Object>} Tag summary with entries, totals, and project usage
   */
  async getTagSummary(tag) {
    const entries = await this.db.getTimeEntriesForTag(tag);
    const totalHours = this.timeParser.getTotalLoggedHours(entries);
    const projectsUsed = [...new Set(entries.map((entry) => entry.project))];

    return {
      tag,
      entries,
      totalHours,
      entryCount: entries.length,
      projectsUsed,
    };
  }

  /**
   * Get summaries for all projects with time entry statistics
   * Provides overview of all projects including time totals and entry counts
   *
   * @async
   * @returns {Promise<Array<Object>>} Array of project summaries with statistics
   */
  async getAllProjectSummaries() {
    const projects = await this.db.getAllProjects();
    const summaries = [];

    for (const project of projects) {
      const entries = await this.db.getTimeEntriesForProject(
        project.project_name
      );
      const totalHours = this.timeParser.getTotalLoggedHours(entries);

      summaries.push({
        ...project,
        totalHours,
        entryCount: entries.length,
      });
    }

    return summaries;
  }

  /**
   * Refresh the entire index by clearing and re-indexing all data
   * Useful for rebuilding the database after file changes
   *
   * @async
   * @returns {Promise<Object>} Fresh indexing results
   */
  async refreshIndex() {
    console.log('Refreshing index...');

    // Close and reinitialize database to clear data
    await this.db.close();
    this.db = new MarkdownDB();
    await this.db.init();

    return this.indexAllData();
  }

  /**
   * Get daily entries for API endpoint
   * Retrieves time entries for a specific date
   *
   * @async
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array<Object>>} Array of time entries for the date
   */
  async getDailyEntries(date) {
    return this.db.getTimeEntriesForDate(date);
  }

  /**
   * Get project entries with pagination for API endpoint
   * Retrieves time entries for a specific project with limit/offset support
   *
   * @async
   * @param {string} projectName - Name of the project
   * @param {Object} options - Query options
   * @param {number} [options.limit=10] - Maximum number of entries to return
   * @param {number} [options.offset=0] - Number of entries to skip
   * @returns {Promise<Array<Object>>} Array of time entries for the project
   */
  async getProjectEntries(projectName, options = {}) {
    const { limit = 10, offset = 0 } = options;

    // Use existing method and apply pagination manually for now
    const allEntries = await this.db.getTimeEntriesForProject(projectName);
    return allEntries.slice(offset, offset + limit);
  }

  /**
   * Get tag entries with pagination for API endpoint
   * Retrieves time entries for a specific tag with limit/offset support
   *
   * @async
   * @param {string} tag - Tag name
   * @param {Object} options - Query options
   * @param {number} [options.limit=10] - Maximum number of entries to return
   * @param {number} [options.offset=0] - Number of entries to skip
   * @returns {Promise<Array<Object>>} Array of time entries with the tag
   */
  async getTagEntries(tag, options = {}) {
    const { limit = 10, offset = 0 } = options;

    // Use existing method and apply pagination manually for now
    const allEntries = await this.db.getTimeEntriesForTag(tag);
    return allEntries.slice(offset, offset + limit);
  }

  /**
   * Close the database connection and clean up resources
   * Should be called when done with indexing operations
   *
   * @async
   * @returns {Promise<void>}
   */
  async close() {
    await this.db.close();
  }
}

module.exports = DataIndexer;
