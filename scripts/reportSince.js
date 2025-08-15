/**
 * @fileoverview Report generator for work done since the last occurrence of a specified string
 * Provides functionality to find work done since the most recent occurrence of any text string
 * in task descriptions, with output grouped by project and sorted by total hours.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const path = require('path');
const DataIndexer = require('./dataIndexer');
const ProjectParser = require('./projectParser');
const chalk = require('chalk');

class SinceReport {
  constructor() {
    this.indexer = null;
    this.projectParser = new ProjectParser();
  }

  /**
   * Initialize the report generator
   */
  async initialize() {
    this.indexer = new DataIndexer();
    await this.indexer.initialize();
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.indexer) {
      await this.indexer.close();
    }
  }

  /**
   * Find the most recent occurrence of a string in task descriptions
   * @param {string} searchString - String to search for in task descriptions
   * @returns {Object|null} Most recent entry containing the string, or null if not found
   */
  async findLastOccurrence(searchString) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT date, start_time as startTime, end_time as endTime, task, project, tags, notes
        FROM time_entries 
        WHERE LOWER(task) LIKE LOWER(?)
        ORDER BY date DESC, start_time DESC
        LIMIT 1
      `;

      this.indexer.db.db.get(query, [`%${searchString}%`], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  /**
   * Get all entries since a specific date and time
   * @param {string} sinceDate - Date in YYYY-MM-DD format
   * @param {string} sinceTime - Time in HH:MM format
   * @returns {Array} Array of time entries since the specified date/time
   */
  async getEntriesSince(sinceDate, sinceTime) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT date, start_time as startTime, end_time as endTime, task, project, tags, notes, duration_hours as durationHours
        FROM time_entries 
        WHERE (date > ? OR (date = ? AND start_time > ?))
        ORDER BY date ASC, start_time ASC
      `;

      this.indexer.db.db.all(
        query,
        [sinceDate, sinceDate, sinceTime],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Group entries by project and calculate totals
   * @param {Array} entries - Array of time entries
   * @returns {Object} Object with project summaries and totals
   */
  async groupEntriesByProject(entries) {
    const projectGroups = {};
    let totalHours = 0;

    // Load project metadata
    const projectsDir = path.join(this.indexer.rootDir, 'projects');
    let allProjects = [];

    try {
      const result = this.projectParser.parseAllProjectFiles(projectsDir);
      allProjects = result.projects;
    } catch (error) {
      console.warn('Warning: Could not load project metadata:', error.message);
    }

    for (const entry of entries) {
      if (!projectGroups[entry.project]) {
        // Find project metadata
        const projectMetadata = this.projectParser.findProjectByName(
          allProjects,
          entry.project
        );

        projectGroups[entry.project] = {
          project: entry.project,
          totalHours: 0,
          entryCount: 0,
          entries: [],
          metadata: projectMetadata
            ? {
                departmentalGoal: projectMetadata.departmentalGoals,
                strategicDirection: projectMetadata.strategicDirections,
                tags: projectMetadata.tags,
                status: projectMetadata.status,
                summary: projectMetadata.summary,
              }
            : {
                departmentalGoal: ['General'],
                strategicDirection: ['General'],
                tags: [],
                status: 'Unknown',
                summary: 'No project file found',
              },
        };
      }

      projectGroups[entry.project].totalHours += entry.durationHours;
      projectGroups[entry.project].entryCount += 1;
      projectGroups[entry.project].entries.push(entry);
      totalHours += entry.durationHours;
    }

    // Sort projects by total hours (descending)
    const sortedProjects = Object.values(projectGroups).sort(
      (a, b) => b.totalHours - a.totalHours
    );

    return {
      projects: sortedProjects,
      totalHours,
      totalEntries: entries.length,
      dateRange:
        entries.length > 0
          ? {
              start: entries[0].date,
              end: entries[entries.length - 1].date,
            }
          : null,
    };
  }

  /**
   * Generate a comprehensive report of work done since the last occurrence of a string
   * @param {string} searchString - String to search for
   * @param {Object} options - Report options
   * @param {string} options.format - Output format ('markdown'|'csv'|'json')
   * @param {string} options.suppressProjects - Comma-separated list of projects to suppress
   * @returns {string} Formatted report
   */
  async generateReport(searchString, options = {}) {
    const { format = 'markdown', suppressProjects = '' } = options;

    // Find the last occurrence of the search string
    const lastOccurrence = await this.findLastOccurrence(searchString);

    if (!lastOccurrence) {
      throw new Error(`No entries found containing "${searchString}"`);
    }

    // Get all entries since that occurrence
    const entriesSince = await this.getEntriesSince(
      lastOccurrence.date,
      lastOccurrence.endTime
    );

    if (entriesSince.length === 0) {
      const report = {
        searchString,
        lastOccurrence: {
          date: lastOccurrence.date,
          time: `${lastOccurrence.startTime}-${lastOccurrence.endTime}`,
          task: lastOccurrence.task,
          project: lastOccurrence.project,
        },
        summary: {
          totalHours: 0,
          totalEntries: 0,
          projects: 0,
        },
        projects: [],
        dateRange: null,
      };

      return this.formatReport(report, format);
    }

    // Group by project and calculate totals
    const groupedData = await this.groupEntriesByProject(entriesSince);

    // Apply project suppression
    const suppressedProjects = this.parseSuppressedProjects(suppressProjects);
    const filteredData = this.applySuppression(groupedData, suppressedProjects);

    const report = {
      searchString,
      lastOccurrence: {
        date: lastOccurrence.date,
        time: `${lastOccurrence.startTime}-${lastOccurrence.endTime}`,
        task: lastOccurrence.task,
        project: lastOccurrence.project,
      },
      summary: {
        totalHours: filteredData.totalHours,
        totalEntries: filteredData.totalEntries,
        projects: filteredData.projects.length,
      },
      projects: filteredData.projects,
      dateRange: filteredData.dateRange,
    };

    return this.formatReport(report, format);
  }

  /**
   * Parse the comma-separated list of projects to suppress
   * @param {string} suppressProjects - Comma-separated project names
   * @returns {Set} Set of project names to suppress
   */
  parseSuppressedProjects(suppressProjects) {
    const suppressedSet = new Set(['Unproductive']); // Always suppress Unproductive

    if (suppressProjects) {
      const projects = suppressProjects
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      projects.forEach((project) => suppressedSet.add(project));
    }

    return suppressedSet;
  }

  /**
   * Apply suppression filtering to grouped project data
   * @param {Object} groupedData - Data grouped by project
   * @param {Set} suppressedProjects - Set of project names to suppress
   * @returns {Object} Filtered data with suppressed projects removed
   */
  applySuppression(groupedData, suppressedProjects) {
    const filteredProjects = groupedData.projects.filter(
      (project) => !suppressedProjects.has(project.project)
    );

    // Recalculate totals for filtered data
    const totalHours = filteredProjects.reduce(
      (sum, project) => sum + project.totalHours,
      0
    );
    const totalEntries = filteredProjects.reduce(
      (sum, project) => sum + project.entryCount,
      0
    );

    return {
      projects: filteredProjects,
      totalHours,
      totalEntries,
      dateRange: groupedData.dateRange,
    };
  }

  /**
   * Format the report in the specified format
   * @param {Object} report - Report data
   * @param {string} format - Output format
   * @returns {string} Formatted report
   */
  formatReport(report, format) {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'csv':
        return this.formatAsCSV(report);
      case 'markdown':
      default:
        return this.formatAsMarkdown(report);
    }
  }

  /**
   * Format report as Markdown
   * @param {Object} report - Report data
   * @returns {string} Markdown formatted report
   */
  formatAsMarkdown(report) {
    const lines = [];

    lines.push(`# Work Since Last "${report.searchString}"`);
    lines.push('');

    // Last occurrence info
    lines.push('## Last Occurrence');
    lines.push(`- **Date**: ${report.lastOccurrence.date}`);
    lines.push(`- **Time**: ${report.lastOccurrence.time}`);
    lines.push(`- **Task**: ${report.lastOccurrence.task}`);
    lines.push(`- **Project**: ${report.lastOccurrence.project}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(`- **Total Hours**: ${report.summary.totalHours}h`);
    lines.push(`- **Total Entries**: ${report.summary.totalEntries}`);
    lines.push(`- **Projects**: ${report.summary.projects}`);

    if (report.dateRange) {
      lines.push(
        `- **Date Range**: ${report.dateRange.start} to ${report.dateRange.end}`
      );
    }
    lines.push('');

    if (report.projects.length === 0) {
      lines.push('No work found since the last occurrence.');
      return lines.join('\n');
    }

    // Projects breakdown
    lines.push('## Projects');
    lines.push('');

    for (const project of report.projects) {
      lines.push(`### ${project.project} (${project.totalHours}h)`);
      lines.push('');

      // Project metadata
      if (project.metadata) {
        lines.push('**Project Details:**');
        lines.push(
          `- Departmental Goals: ${project.metadata.departmentalGoal.join(', ')}`
        );
        lines.push(
          `- Strategic Directions: ${project.metadata.strategicDirection.join(', ')}`
        );
        if (project.metadata.tags.length > 0) {
          lines.push(`- Tags: ${project.metadata.tags.join(', ')}`);
        }
        lines.push('');
      }

      lines.push(
        `**Summary**: ${project.entryCount} entries, ${project.totalHours}h total`
      );
      lines.push('');

      // All tasks
      lines.push('**Tasks:**');
      for (const entry of project.entries) {
        const tags = entry.tags ? ` [${entry.tags}]` : '';
        lines.push(
          `- **${entry.date} ${entry.startTime}-${entry.endTime}** (${entry.durationHours}h): ${entry.task}${tags}`
        );
        if (entry.notes) {
          lines.push(`  - *Notes*: ${entry.notes}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format report as CSV
   * @param {Object} report - Report data
   * @returns {string} CSV formatted report
   */
  formatAsCSV(report) {
    const lines = [];

    // Header
    lines.push('Project,Date,StartTime,EndTime,Duration,Task,Tags,Notes');

    // Data rows
    for (const project of report.projects) {
      for (const entry of project.entries) {
        const row = [
          `"${entry.project}"`,
          entry.date,
          entry.startTime,
          entry.endTime,
          entry.durationHours,
          `"${entry.task.replace(/"/g, '""')}"`, // Escape quotes
          `"${entry.tags || ''}"`,
          `"${(entry.notes || '').replace(/"/g, '""')}"`,
        ];
        lines.push(row.join(','));
      }
    }

    return lines.join('\n');
  }
}

module.exports = SinceReport;
