const fs = require('fs');
const path = require('path');
const DataIndexer = require('./dataIndexer');
const ProjectParser = require('./projectParser');
const TimeDataParser = require('./computeTimeData');

class FiscalYearReport {
  constructor() {
    this.dataIndexer = new DataIndexer();
    this.projectParser = new ProjectParser();
    this.timeParser = new TimeDataParser();
  }

  async initialize() {
    await this.dataIndexer.initialize();
  }

  /**
   * Generate fiscal year report
   */
  async generateReport(fiscalYear, options = {}) {
    try {
      await this.initialize();

      const {
        groupBy = 'departmentalGoal',
        format = 'markdown',
        sort = 'date',
        topTasks = 3,
        suppressProjects = '',
      } = options;

      // Get all data for the fiscal year
      const reportData = await this.gatherReportData(fiscalYear, options);

      if (reportData.totalEntries === 0) {
        throw new Error(`No time entries found for fiscal year ${fiscalYear}`);
      }

      // Apply project suppression
      const suppressedProjects = this.parseSuppressedProjects(suppressProjects);
      const filteredReportData = this.applySuppression(
        reportData,
        suppressedProjects
      );

      // Group projects according to groupBy option
      const groupedData = this.groupProjectData(filteredReportData, groupBy);

      // Sort projects within each group
      const sortedData = this.sortGroupedData(groupedData, sort);

      // Generate report in requested format
      let output;
      switch (format.toLowerCase()) {
        case 'markdown':
          output = this.generateMarkdownReport(
            sortedData,
            filteredReportData,
            fiscalYear,
            { groupBy, topTasks }
          );
          break;
        case 'csv':
          output = this.generateCSVReport(
            sortedData,
            filteredReportData,
            fiscalYear
          );
          break;
        case 'json':
          output = this.generateJSONReport(
            sortedData,
            filteredReportData,
            fiscalYear,
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
   * Gather all data needed for the report
   */
  async gatherReportData(fiscalYear, options = {}) {
    // Get all projects
    const projects = await this.dataIndexer.getAllProjectSummaries();

    // Get all time entries for the fiscal year
    const allEntries = [];
    const fiscalYearPattern = new RegExp(`time-log-${fiscalYear}\\.md$`);
    const timeLogFiles = this.dataIndexer
      .findTimeLogFiles()
      .filter((file) => fiscalYearPattern.test(path.basename(file)));

    for (const filePath of timeLogFiles) {
      const entries = this.timeParser.parseTimeLogFile(filePath);
      allEntries.push(...entries);
    }

    // Calculate totals
    const totalHours = this.timeParser.getTotalLoggedHours(allEntries);
    const totalEntries = allEntries.length;

    // Group entries by project
    const entriesByProject = this.timeParser.groupEntriesByProject(allEntries);

    // Combine project metadata with time data
    const projectsWithTimeData = projects
      .map((project) => {
        const projectEntries = entriesByProject[project.project_name] || [];
        const projectHours =
          this.timeParser.getTotalLoggedHours(projectEntries);
        const percentage =
          totalHours > 0 ? (projectHours / totalHours) * 100 : 0;

        // Get top tasks for this project
        const topTasks = this.getTopTasksForProject(
          projectEntries,
          options.topTasks !== undefined ? options.topTasks : 3
        );

        return {
          ...project,
          projectHours,
          projectEntries: projectEntries.length,
          percentage,
          entries: projectEntries,
          topTasks,
        };
      })
      .filter((project) => project.projectHours > 0); // Only include projects with time logged

    return {
      projects: projectsWithTimeData,
      totalHours,
      totalEntries,
      fiscalYear,
      generatedDate: new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Get top tasks for a project
   */
  getTopTasksForProject(entries, count = 3) {
    // Group by task and sum hours
    const taskHours = {};
    entries.forEach((entry) => {
      if (!taskHours[entry.task]) {
        taskHours[entry.task] = {
          task: entry.task,
          totalHours: 0,
          count: 0,
          dates: [],
        };
      }
      taskHours[entry.task].totalHours += entry.durationHours;
      taskHours[entry.task].count += 1;
      taskHours[entry.task].dates.push(entry.date);
    });

    // Sort by total hours and return top N (or all if count is 0)
    const sortedTasks = Object.values(taskHours)
      .sort((a, b) => b.totalHours - a.totalHours)
      .map((task) => ({
        ...task,
        dates: [...new Set(task.dates)].sort(),
      }));

    return count === 0 ? sortedTasks : sortedTasks.slice(0, count);
  }

  /**
   * Group project data by specified field
   */
  groupProjectData(reportData, groupBy) {
    const grouped = {};

    reportData.projects.forEach((project) => {
      let groupKeys = [];

      switch (groupBy) {
        case 'departmentalGoal':
          groupKeys = project.departmentalGoals || [];
          break;
        case 'strategicDirection':
          groupKeys = project.strategicDirections || [];
          break;
        case 'tag':
          groupKeys = project.tags || [];
          break;
        default:
          groupKeys = ['All Projects'];
      }

      // Handle projects with no values for the groupBy field
      if (groupKeys.length === 0) {
        groupKeys = ['Uncategorized'];
      }

      // Add project to each relevant group
      groupKeys.forEach((key) => {
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(project);
      });
    });

    return grouped;
  }

  /**
   * Sort grouped data
   */
  sortGroupedData(groupedData, sortBy) {
    const sortFunctions = {
      date: (a, b) => new Date(a.start_date) - new Date(b.start_date),
      alpha: (a, b) => a.project_name.localeCompare(b.project_name),
      hours: (a, b) => b.projectHours - a.projectHours,
    };

    const sortFunc = sortFunctions[sortBy] || sortFunctions.date;

    // Sort projects within each group
    Object.keys(groupedData).forEach((groupKey) => {
      groupedData[groupKey].sort(sortFunc);
    });

    return groupedData;
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(groupedData, reportData, fiscalYear, options) {
    const { groupBy, topTasks } = options;
    const currentDate = new Date().toISOString().split('T')[0];

    let markdown = `# Fiscal Year Report ${fiscalYear}\n\n`;
    markdown += `Generated on: ${currentDate}\n`;
    markdown += `Report Period: Up to ${currentDate}\n\n`;

    // Summary statistics
    markdown += `## Summary\n\n`;
    markdown += `- **Total Hours Logged**: ${reportData.totalHours}h\n`;
    markdown += `- **Total Entries**: ${reportData.totalEntries}\n`;
    markdown += `- **Active Projects**: ${reportData.projects.length}\n`;
    markdown += `- **Grouped By**: ${this.getGroupByDisplayName(groupBy)}\n\n`;

    // Group sections
    const groupKeys = Object.keys(groupedData).sort();

    groupKeys.forEach((groupKey) => {
      const projects = groupedData[groupKey];
      const groupHours = projects.reduce((sum, p) => sum + p.projectHours, 0);
      const groupPercentage =
        reportData.totalHours > 0
          ? (groupHours / reportData.totalHours) * 100
          : 0;

      markdown += `## ${this.getGroupByDisplayName(groupBy)}: ${groupKey}\n\n`;
      markdown += `**Group Total**: ${groupHours}h (${groupPercentage.toFixed(1)}% of total)\n\n`;

      projects.forEach((project) => {
        markdown += `### ${project.project_name}\n\n`;
        markdown += `- **Total Hours**: ${project.projectHours}h\n`;
        markdown += `- **Percentage of Total**: ${project.percentage.toFixed(1)}%\n`;
        markdown += `- **Description**: ${this.truncateText(project.summary || 'No description available', 100)}\n`;

        if (project.topTasks.length > 0) {
          const tasksToShow =
            topTasks === 0
              ? project.topTasks
              : project.topTasks.slice(0, topTasks);
          const taskHeader =
            topTasks === 0
              ? `- **All Tasks** (${project.topTasks.length} tasks):`
              : `- **Key Tasks** (Top ${Math.min(topTasks, project.topTasks.length)}):`;

          markdown += `${taskHeader}\n`;
          tasksToShow.forEach((task) => {
            const dateRange =
              task.dates.length > 1
                ? `${task.dates[0]} to ${task.dates[task.dates.length - 1]}`
                : task.dates[0];
            markdown += `  - ${dateRange}: ${task.task} (${task.totalHours}h)\n`;
          });
        }

        markdown += `\n`;
      });
    });

    return markdown;
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(groupedData, reportData, fiscalYear) {
    const headers = [
      'Date Range',
      'Task',
      'Duration',
      'Project',
      'DepartmentalGoal',
      'StrategicDirection',
      'Tags',
      'Description',
      'FiscalYear',
    ];

    let csv = `${headers.join(',')}\n`;

    // Flatten all entries from all projects
    const allEntries = [];
    Object.values(groupedData).forEach((projects) => {
      projects.forEach((project) => {
        project.entries.forEach((entry) => {
          allEntries.push({
            entry,
            project,
          });
        });
      });
    });

    // Sort entries by date
    allEntries.sort(
      (a, b) =>
        new Date(`${a.entry.date} ${a.entry.startTime}`) -
        new Date(`${b.entry.date} ${b.entry.startTime}`)
    );

    // Generate CSV rows
    allEntries.forEach(({ entry, project }) => {
      const row = [
        entry.date,
        `"${this.escapeCsvField(entry.task)}"`,
        entry.durationHours,
        `"${this.escapeCsvField(project.project_name)}"`,
        `"${(project.departmentalGoals || []).join('; ')}"`,
        `"${(project.strategicDirections || []).join('; ')}"`,
        `"${entry.tags.join('; ')}"`,
        `"${this.escapeCsvField(project.summary || '')}"`,
        fiscalYear,
      ];
      csv += `${row.join(',')}\n`;
    });

    return csv;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(groupedData, reportData, fiscalYear, options) {
    const report = {
      fiscalYear,
      generatedDate: reportData.generatedDate,
      summary: {
        totalHours: reportData.totalHours,
        totalEntries: reportData.totalEntries,
        activeProjects: reportData.projects.length,
        groupedBy: options.groupBy,
      },
      groups: {},
    };

    Object.entries(groupedData).forEach(([groupKey, projects]) => {
      const groupHours = projects.reduce((sum, p) => sum + p.projectHours, 0);
      const groupPercentage =
        reportData.totalHours > 0
          ? (groupHours / reportData.totalHours) * 100
          : 0;

      report.groups[groupKey] = {
        totalHours: groupHours,
        percentage: groupPercentage,
        projects: projects.map((project) => ({
          name: project.project_name,
          hours: project.projectHours,
          percentage: project.percentage,
          entryCount: project.projectEntries,
          description: project.summary || '',
          departmentalGoals: project.departmentalGoals || [],
          strategicDirections: project.strategicDirections || [],
          tags: project.tags || [],
          startDate: project.start_date,
          status: project.status,
          topTasks: project.topTasks,
          entries: project.entries.map((entry) => ({
            date: entry.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            duration: entry.durationHours,
            task: entry.task,
            tags: entry.tags,
            notes: entry.notes,
          })),
        })),
      };
    });

    return JSON.stringify(report, null, 2);
  }

  /**
   * Helper methods
   */
  getGroupByDisplayName(groupBy) {
    const displayNames = {
      departmentalGoal: 'Departmental Goal',
      strategicDirection: 'Strategic Direction',
      tag: 'Tag',
    };
    return displayNames[groupBy] || 'Category';
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return `${text.substring(0, maxLength - 3)}...`;
  }

  escapeCsvField(field) {
    if (!field) return '';
    return field.toString().replace(/"/g, '""');
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
   * Apply suppression filtering to report data
   * @param {Object} reportData - Report data with projects array
   * @param {Set} suppressedProjects - Set of project names to suppress
   * @returns {Object} Filtered report data with suppressed projects removed
   */
  applySuppression(reportData, suppressedProjects) {
    const filteredProjects = reportData.projects.filter(
      (project) => !suppressedProjects.has(project.project_name)
    );

    // Recalculate totals for filtered data
    const totalHours = filteredProjects.reduce(
      (sum, project) => sum + project.projectHours,
      0
    );
    const totalEntries = filteredProjects.reduce(
      (sum, project) => sum + project.projectEntries,
      0
    );

    return {
      ...reportData,
      projects: filteredProjects,
      totalHours,
      totalEntries,
    };
  }

  /**
   * Save report to file
   */
  async saveReportToFile(content, fiscalYear, format) {
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fiscal-year-report-${fiscalYear}-${timestamp}.${format}`;
    const filePath = path.join(reportsDir, filename);

    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }
}

module.exports = FiscalYearReport;
