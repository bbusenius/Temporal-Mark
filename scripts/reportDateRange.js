/**
 * @fileoverview Date range reporting system
 * Generates comprehensive reports for custom date ranges, including weekly and monthly periods.
 * Reuses formatting and grouping logic from fiscal year reports for consistency.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const DataIndexer = require('./dataIndexer');
const ProjectParser = require('./projectParser');
const TimeDataParser = require('./computeTimeData');

/**
 * Generates comprehensive time tracking reports for custom date ranges
 * Supports the same grouping, formatting, and sorting options as fiscal year reports
 *
 * @class DateRangeReport
 */
class DateRangeReport {
  /**
   * Initialize the DateRangeReport with required dependencies
   * @constructor
   */
  constructor() {
    this.dataIndexer = new DataIndexer();
    this.projectParser = new ProjectParser();
    this.timeParser = new TimeDataParser();
  }

  /**
   * Initialize database connection and indexing
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.dataIndexer.initialize();
  }

  /**
   * Generate comprehensive date range report
   * @async
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @param {Object} options - Report configuration options
   * @param {string} [options.groupBy='departmentalGoal'] - Group projects by field
   * @param {string} [options.format='markdown'] - Output format (markdown|csv|json)
   * @param {string} [options.sort='date'] - Sort order (alpha|hours|date)
   * @param {number} [options.topTasks=3] - Number of top tasks to show per project
   * @returns {Promise<string>} Generated report in requested format
   * @throws {Error} When no entries found or invalid date range
   */
  async generateReport(startDate, endDate, options = {}) {
    try {
      await this.initialize();

      // Validate date range
      if (!this.isValidDateRange(startDate, endDate)) {
        throw new Error(`Invalid date range: ${startDate} to ${endDate}`);
      }

      const {
        groupBy = 'departmentalGoal',
        format = 'markdown',
        sort = 'date',
        topTasks = 3,
      } = options;

      // Get all data for the date range
      const reportData = await this.gatherReportData(startDate, endDate);

      if (reportData.totalEntries === 0) {
        throw new Error(
          `No time entries found for date range ${startDate} to ${endDate}`
        );
      }

      // Group projects according to groupBy option
      const groupedData = this.groupProjectData(reportData, groupBy);

      // Sort projects within each group
      const sortedData = this.sortGroupedData(groupedData, sort);

      // Generate report in requested format
      let output;
      switch (format.toLowerCase()) {
        case 'markdown':
          output = this.generateMarkdownReport(
            sortedData,
            reportData,
            startDate,
            endDate,
            { groupBy, topTasks }
          );
          break;
        case 'csv':
          output = this.generateCSVReport(
            sortedData,
            reportData,
            startDate,
            endDate
          );
          break;
        case 'json':
          output = this.generateJSONReport(
            sortedData,
            reportData,
            startDate,
            endDate,
            {
              groupBy,
              topTasks,
            }
          );
          break;
        default:
          throw new Error(
            `Unsupported format: ${format}. Use markdown, csv, or json.`
          );
      }

      return output;
    } catch (error) {
      throw error;
    } finally {
      await this.dataIndexer.close();
    }
  }

  /**
   * Validate that date range is properly formatted and logical
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {boolean} True if date range is valid
   */
  isValidDateRange(startDate, endDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check that dates are valid (not NaN) and start <= end
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }

    return (
      start.toISOString().split('T')[0] === startDate &&
      end.toISOString().split('T')[0] === endDate &&
      start <= end
    );
  }

  /**
   * Gather all data needed for the date range report
   * @async
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Object>} Report data with entries, projects, and totals
   */
  async gatherReportData(startDate, endDate) {
    // Get all time entries in the date range
    const allEntries = await this.dataIndexer.getEntriesInDateRange(
      startDate,
      endDate
    );

    // Get project summaries for projects that have entries in this range
    const projectsInRange = [
      ...new Set(allEntries.map((entry) => entry.project).filter(Boolean)),
    ];
    const allProjects = await this.dataIndexer.getAllProjectSummaries();
    const relevantProjects = allProjects.filter((project) =>
      projectsInRange.includes(project.project_name)
    );

    // Calculate project totals for this date range only
    const projectTotals = {};
    projectsInRange.forEach((projectName) => {
      const projectEntries = allEntries.filter(
        (entry) => entry.project === projectName
      );
      projectTotals[projectName] = {
        totalHours: this.timeParser.getTotalLoggedHours(projectEntries),
        entryCount: projectEntries.length,
        entries: projectEntries,
      };
    });

    // Calculate overall totals
    const totalHours = this.timeParser.getTotalLoggedHours(allEntries);
    const totalEntries = allEntries.length;

    // Get unique dates in range for summary
    const datesInRange = [
      ...new Set(allEntries.map((entry) => entry.date)),
    ].sort();

    return {
      allEntries,
      projects: relevantProjects,
      projectTotals,
      totalHours,
      totalEntries,
      startDate,
      endDate,
      datesInRange,
    };
  }

  /**
   * Group project data according to specified field
   * Reuses logic from fiscal year reports for consistency
   * @param {Object} reportData - Complete report data
   * @param {string} groupBy - Field to group by (departmentalGoal|strategicDirection|tag)
   * @returns {Object} Grouped project data
   */
  groupProjectData(reportData, groupBy) {
    const groups = {};

    reportData.projects.forEach((project) => {
      const projectName = project.project_name;
      const projectTotal = reportData.projectTotals[projectName];

      if (!projectTotal || projectTotal.totalHours === 0) {
        return; // Skip projects with no time in this range
      }

      let groupKeys = [];

      switch (groupBy) {
        case 'departmentalGoal':
          groupKeys = Array.isArray(project.departmental_goal)
            ? project.departmental_goal
            : project.departmental_goal
              ? [project.departmental_goal]
              : ['Unspecified'];
          break;
        case 'strategicDirection':
          groupKeys = Array.isArray(project.strategic_direction)
            ? project.strategic_direction
            : project.strategic_direction
              ? [project.strategic_direction]
              : ['Unspecified'];
          break;
        case 'tag':
          groupKeys = Array.isArray(project.tags)
            ? project.tags
            : project.tags
              ? [project.tags]
              : ['Unspecified'];
          break;
        default:
          groupKeys = ['All Projects'];
      }

      groupKeys.forEach((groupKey) => {
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }

        groups[groupKey].push({
          ...project,
          totalHours: projectTotal.totalHours,
          entryCount: projectTotal.entryCount,
          entries: projectTotal.entries,
        });
      });
    });

    return groups;
  }

  /**
   * Sort grouped project data according to specified method
   * @param {Object} groupedData - Projects grouped by category
   * @param {string} sort - Sort method (alpha|hours|date)
   * @returns {Object} Sorted grouped data
   */
  sortGroupedData(groupedData, sort) {
    const sortedGroups = {};

    Object.keys(groupedData).forEach((groupKey) => {
      const projects = groupedData[groupKey];

      switch (sort) {
        case 'alpha':
          projects.sort((a, b) => a.project_name.localeCompare(b.project_name));
          break;
        case 'hours':
          projects.sort((a, b) => b.totalHours - a.totalHours);
          break;
        case 'date':
        default:
          projects.sort((a, b) => {
            const dateA = new Date(a.start_date || '1900-01-01');
            const dateB = new Date(b.start_date || '1900-01-01');
            return dateA - dateB;
          });
          break;
      }

      sortedGroups[groupKey] = projects;
    });

    return sortedGroups;
  }

  /**
   * Generate markdown format report
   * @param {Object} sortedData - Sorted and grouped project data
   * @param {Object} reportData - Complete report data
   * @param {string} startDate - Start date for report
   * @param {string} endDate - End date for report
   * @param {Object} options - Report options
   * @returns {string} Markdown formatted report
   */
  generateMarkdownReport(sortedData, reportData, startDate, endDate, options) {
    const { groupBy, topTasks } = options;
    const reportTitle = `Time Tracking Report: ${startDate} to ${endDate}`;

    let output = `# ${reportTitle}\n\n`;

    // Summary section
    output += `## Summary\n\n`;
    output += `**Date Range:** ${startDate} to ${endDate}  \n`;
    output += `**Total Hours:** ${reportData.totalHours.toFixed(1)}  \n`;
    output += `**Total Entries:** ${reportData.totalEntries}  \n`;
    output += `**Projects:** ${reportData.projects.length}  \n`;
    output += `**Days with Entries:** ${reportData.datesInRange.length}  \n`;
    output += `**Grouped By:** ${this.getGroupByDisplayName(groupBy)}  \n\n`;

    // Projects by group
    const groupKeys = Object.keys(sortedData).sort();

    groupKeys.forEach((groupKey) => {
      const projects = sortedData[groupKey];
      const groupTotal = projects.reduce((sum, p) => sum + p.totalHours, 0);

      output += `## ${groupKey}\n`;
      output += `*Total: ${groupTotal.toFixed(1)} hours*\n\n`;

      projects.forEach((project) => {
        output += `### ${project.project_name}\n`;
        output += `**Hours:** ${project.totalHours.toFixed(1)} | `;
        output += `**Entries:** ${project.entryCount} | `;
        output += `**Status:** ${project.status || 'Active'}\n\n`;

        if (project.summary) {
          output += `${this.truncateText(project.summary, 100)}\n\n`;
        }

        // Show top tasks for this project in date range
        if (topTasks > 0) {
          const topTasksList = this.getTopTasksForProject(
            project.entries,
            topTasks
          );
          if (topTasksList.length > 0) {
            output += `**Top Tasks:**\n`;
            topTasksList.forEach((task) => {
              output += `- ${task.task} (${task.hours.toFixed(1)}h)\n`;
            });
            output += `\n`;
          }
        }
      });
    });

    return output;
  }

  /**
   * Generate CSV format report
   * @param {Object} sortedData - Sorted and grouped project data
   * @param {Object} reportData - Complete report data
   * @param {string} startDate - Start date for report
   * @param {string} endDate - End date for report
   * @returns {string} CSV formatted report
   */
  generateCSVReport(sortedData, reportData, startDate, endDate) {
    let output = `Date Range,${startDate} to ${endDate}\n`;
    output += `Total Hours,${reportData.totalHours.toFixed(1)}\n`;
    output += `Total Entries,${reportData.totalEntries}\n\n`;

    output += `Group,Project,Hours,Entries,Status,Summary\n`;

    Object.keys(sortedData)
      .sort()
      .forEach((groupKey) => {
        sortedData[groupKey].forEach((project) => {
          const summary = this.truncateText(project.summary || '', 100);
          output += `${this.escapeCsvField(groupKey)},`;
          output += `${this.escapeCsvField(project.project_name)},`;
          output += `${project.totalHours.toFixed(1)},`;
          output += `${project.entryCount},`;
          output += `${this.escapeCsvField(project.status || 'Active')},`;
          output += `${this.escapeCsvField(summary)}\n`;
        });
      });

    return output;
  }

  /**
   * Generate JSON format report
   * @param {Object} sortedData - Sorted and grouped project data
   * @param {Object} reportData - Complete report data
   * @param {string} startDate - Start date for report
   * @param {string} endDate - End date for report
   * @param {Object} options - Report options
   * @returns {string} JSON formatted report
   */
  generateJSONReport(sortedData, reportData, startDate, endDate, options) {
    const report = {
      reportType: 'dateRange',
      dateRange: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalHours: reportData.totalHours,
        totalEntries: reportData.totalEntries,
        projectCount: reportData.projects.length,
        daysWithEntries: reportData.datesInRange.length,
      },
      options: {
        groupBy: options.groupBy,
        topTasks: options.topTasks,
      },
      groups: {},
    };

    Object.keys(sortedData)
      .sort()
      .forEach((groupKey) => {
        report.groups[groupKey] = {
          totalHours: sortedData[groupKey].reduce(
            (sum, p) => sum + p.totalHours,
            0
          ),
          projects: sortedData[groupKey].map((project) => ({
            name: project.project_name,
            hours: project.totalHours,
            entries: project.entryCount,
            status: project.status,
            summary: this.truncateText(project.summary || '', 100),
            topTasks:
              options.topTasks > 0
                ? this.getTopTasksForProject(project.entries, options.topTasks)
                : [],
          })),
        };
      });

    return JSON.stringify(report, null, 2);
  }

  /**
   * Get top tasks for a project based on time spent
   * @param {Array} entries - Time entries for the project
   * @param {number} limit - Maximum number of tasks to return
   * @returns {Array} Top tasks with hours
   */
  getTopTasksForProject(entries, limit) {
    const taskTotals = {};

    entries.forEach((entry) => {
      if (!taskTotals[entry.task]) {
        taskTotals[entry.task] = 0;
      }
      taskTotals[entry.task] += entry.durationHours;
    });

    return Object.entries(taskTotals)
      .map(([task, hours]) => ({ task, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, limit);
  }

  /**
   * Get display name for groupBy field
   * @param {string} groupBy - Group by field name
   * @returns {string} Human readable display name
   */
  getGroupByDisplayName(groupBy) {
    const displayNames = {
      departmentalGoal: 'Departmental Goal',
      strategicDirection: 'Strategic Direction',
      tag: 'Tag',
    };
    return displayNames[groupBy] || groupBy;
  }

  /**
   * Truncate text to specified length
   * @param {string} text - Text to truncate
   * @param {number} length - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, length) {
    if (!text || text.length <= length) return text;
    return `${text.substring(0, length - 3)}...`;
  }

  /**
   * Escape CSV field for proper formatting
   * @param {string} field - Field value to escape
   * @returns {string} Escaped CSV field
   */
  escapeCsvField(field) {
    if (!field) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

module.exports = DateRangeReport;
