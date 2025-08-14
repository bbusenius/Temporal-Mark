#!/usr/bin/env node

/**
 * @fileoverview Main CLI entry point for Temporal Mark time tracking system
 * Provides comprehensive command-line interface for all system operations including
 * time entry management, validation, reporting, archiving, and maintenance.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const { program } = require('commander');
const chalk = require('chalk');
const AddEntry = require('./addEntry');
const TimeTracker = require('./timeTracker');
const DataIndexer = require('./dataIndexer');
const FiscalYearReport = require('./reportFiscalYear');
const ArchiveManager = require('./archiveManager');
const WikiLinkValidator = require('./wikiLinkValidator');
const TagStandardizer = require('./tagStandardizer');
const InputValidator = require('./inputValidator');

// Set version from package.json
const packageJson = require('../package.json');

program.version(packageJson.version);

/**
 * Calculate week boundaries (Monday to Sunday) for a given date
 * @param {Date} date - Target date
 * @returns {Object} Object with start and end date strings
 */
function calculateWeekBounds(date) {
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
 */
function calculateMonthBounds(date) {
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
    throw new Error(`Invalid date format: ${date}. Use YYYY-MM-DD or YYYY-MM`);
  }

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month

  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
}

// Add command
program
  .command('add')
  .description('Add a new time entry')
  .option('-d, --date <date>', 'Date for the entry (YYYY-MM-DD)')
  .option('-s, --start <time>', 'Start time (HH:MM)')
  .option('-e, --end <time>', 'End time (HH:MM)')
  .option('-t, --task <task>', 'Task description')
  .option('-p, --project <project>', 'Project name')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('-n, --notes <notes>', 'Additional notes')
  .option('-f, --file <file>', 'JSON file with batch entries')
  .action(async (options) => {
    try {
      const addEntry = new AddEntry();
      await addEntry.addEntry(options);
    } catch (error) {
      console.error(chalk.red('Failed to add entry:'), error.message);
      process.exit(1);
    }
  });

// Daily view command
program
  .command('daily <date>')
  .description('Show daily view for a specific date')
  .action(async (date) => {
    try {
      const indexer = new DataIndexer();
      await indexer.initialize();

      const summary = await indexer.getDailySummary(date);

      console.log(chalk.blue(`\nDaily View: ${date}`));
      console.log('='.repeat(30));

      if (summary.entries.length === 0) {
        console.log(chalk.yellow('No entries found for this date.'));
        return;
      }

      // Display entries in table format
      console.log('\nTime Entries:');
      console.table(
        summary.entries.map((entry) => ({
          Time: `${entry.startTime}-${entry.endTime}`,
          Task:
            entry.task.length > 40
              ? `${entry.task.slice(0, 37)}...`
              : entry.task,
          Project: entry.project,
          Duration: `${entry.durationHours}h`,
          Tags: entry.tags.join(', '),
        }))
      );

      // Show gaps
      if (summary.gaps.length > 0) {
        console.log(`\n${chalk.yellow('Unlogged Gaps Between Entries:')}`);
        summary.gaps.forEach((gap) => {
          console.log(`  ${gap.start}-${gap.end} (${gap.durationHours}h)`);
        });
      } else {
        console.log(`\n${chalk.green('No gaps between logged entries')}`);
      }

      // Summary statistics
      const workPeriodStart = summary.entries[0]?.startTime;
      const workPeriodEnd =
        summary.entries[summary.entries.length - 1]?.endTime;

      console.log(`\n${chalk.green('Summary:')}`);
      console.log(`  Work period: ${workPeriodStart}-${workPeriodEnd}`);
      console.log(`  Total logged: ${summary.totalLoggedHours}h`);
      console.log(`  Total gaps: ${summary.totalGapHours}h`);

      await indexer.close();
    } catch (error) {
      console.error(chalk.red('Failed to show daily view:'), error.message);
      process.exit(1);
    }
  });

// Project summary command
program
  .command('project <name>')
  .description('Show summary for a specific project')
  .action(async (name) => {
    try {
      const indexer = new DataIndexer();
      await indexer.initialize();

      const summary = await indexer.getProjectSummary(name);

      if (!summary.project) {
        console.log(chalk.red(`Project not found: "${name}"`));
        console.log(chalk.yellow('Available projects:'));
        const allProjects = await indexer.getAllProjectSummaries();
        allProjects.forEach((p) => console.log(`  - ${p.project_name}`));
        await indexer.close();
        return;
      }

      console.log(
        chalk.blue(`\nProject Summary: ${summary.project.project_name}`)
      );
      console.log('='.repeat(50));

      // Project metadata
      console.log(`\n${chalk.green('Project Details:')}`);
      console.log(`  Status: ${summary.project.status}`);
      console.log(`  Start Date: ${summary.project.start_date}`);
      console.log(
        `  Departmental Goals: ${summary.project.departmentalGoals.join(', ')}`
      );
      console.log(
        `  Strategic Directions: ${summary.project.strategicDirections.join(', ')}`
      );
      console.log(`  Tags: ${summary.project.tags.join(', ')}`);

      if (summary.project.summary) {
        console.log(`  Summary: ${summary.project.summary}`);
      }

      // Time statistics
      console.log(`\n${chalk.green('Time Statistics:')}`);
      console.log(`  Total Hours: ${summary.totalHours}h`);
      console.log(`  Total Entries: ${summary.entryCount}`);

      if (summary.entries.length > 0) {
        const avgDuration = summary.totalHours / summary.entryCount;
        console.log(`  Average Entry Duration: ${avgDuration.toFixed(1)}h`);

        // Date range
        const dates = summary.entries.map((e) => e.date).sort();
        console.log(`  Date Range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }

      // Recent entries
      if (summary.entries.length > 0) {
        console.log(`\n${chalk.green('Recent Entries:')}`);
        const recentEntries = summary.entries
          .sort(
            (a, b) =>
              new Date(`${b.date} ${b.startTime}`) -
              new Date(`${a.date} ${a.startTime}`)
          )
          .slice(0, 10);

        console.table(
          recentEntries.map((entry) => ({
            Date: entry.date,
            Time: `${entry.startTime}-${entry.endTime}`,
            Task:
              entry.task.length > 50
                ? `${entry.task.slice(0, 47)}...`
                : entry.task,
            Duration: `${entry.durationHours}h`,
            Tags: entry.tags.join(', '),
          }))
        );

        if (summary.entries.length > 10) {
          console.log(
            chalk.gray(`... and ${summary.entries.length - 10} more entries`)
          );
        }
      }

      await indexer.close();
    } catch (error) {
      console.error(
        chalk.red('Failed to show project summary:'),
        error.message
      );
      process.exit(1);
    }
  });

// Tag summary command
program
  .command('tag <tag>')
  .description('Show summary for a specific tag')
  .action(async (tag) => {
    try {
      const indexer = new DataIndexer();
      await indexer.initialize();

      const summary = await indexer.getTagSummary(tag);

      if (summary.entries.length === 0) {
        console.log(chalk.red(`No entries found for tag: "${tag}"`));

        // Get all available tags for suggestions
        const allProjects = await indexer.getAllProjectSummaries();
        const allTags = new Set();
        allProjects.forEach((project) => {
          if (project.tags) {
            const tags = JSON.parse(project.tags);
            tags.forEach((t) => allTags.add(t));
          }
        });

        if (allTags.size > 0) {
          console.log(chalk.yellow('Available tags:'));
          Array.from(allTags)
            .sort()
            .forEach((t) => console.log(`  - ${t}`));
        }

        await indexer.close();
        return;
      }

      console.log(chalk.blue(`\nTag Summary: "${tag}"`));
      console.log('='.repeat(30));

      // Tag statistics
      console.log(`\n${chalk.green('Statistics:')}`);
      console.log(`  Total Hours: ${summary.totalHours}h`);
      console.log(`  Total Entries: ${summary.entryCount}`);
      console.log(`  Projects Used: ${summary.projectsUsed.length}`);

      if (summary.entries.length > 0) {
        const avgDuration = summary.totalHours / summary.entryCount;
        console.log(`  Average Entry Duration: ${avgDuration.toFixed(1)}h`);

        // Date range
        const dates = summary.entries.map((e) => e.date).sort();
        console.log(`  Date Range: ${dates[0]} to ${dates[dates.length - 1]}`);
      }

      // Projects breakdown
      if (summary.projectsUsed.length > 0) {
        console.log(`\n${chalk.green('Projects Using This Tag:')}`);

        // Group entries by project and calculate hours
        const projectBreakdown = {};
        summary.entries.forEach((entry) => {
          if (!projectBreakdown[entry.project]) {
            projectBreakdown[entry.project] = {
              hours: 0,
              count: 0,
            };
          }
          projectBreakdown[entry.project].hours += entry.durationHours;
          projectBreakdown[entry.project].count += 1;
        });

        Object.entries(projectBreakdown)
          .sort(([, a], [, b]) => b.hours - a.hours)
          .forEach(([project, stats]) => {
            console.log(
              `  - ${project}: ${stats.hours}h (${stats.count} entries)`
            );
          });
      }

      // Recent entries
      if (summary.entries.length > 0) {
        console.log(`\n${chalk.green('Recent Entries:')}`);
        const recentEntries = summary.entries
          .sort(
            (a, b) =>
              new Date(`${b.date} ${b.startTime}`) -
              new Date(`${a.date} ${a.startTime}`)
          )
          .slice(0, 15);

        console.table(
          recentEntries.map((entry) => ({
            Date: entry.date,
            Time: `${entry.startTime}-${entry.endTime}`,
            Task:
              entry.task.length > 40
                ? `${entry.task.slice(0, 37)}...`
                : entry.task,
            Project:
              entry.project.length > 25
                ? `${entry.project.slice(0, 22)}...`
                : entry.project,
            Duration: `${entry.durationHours}h`,
          }))
        );

        if (summary.entries.length > 15) {
          console.log(
            chalk.gray(`... and ${summary.entries.length - 15} more entries`)
          );
        }
      }

      await indexer.close();
    } catch (error) {
      console.error(chalk.red('Failed to show tag summary:'), error.message);
      process.exit(1);
    }
  });

// Report command
program
  .command('report <fiscal-year>')
  .description('Generate fiscal year report')
  .option(
    '--group-by <field>',
    'Group by field (departmentalGoal|strategicDirection|tag)',
    'departmentalGoal'
  )
  .option('--format <format>', 'Output format (markdown|csv|json)', 'markdown')
  .option('--sort <sort>', 'Sort order (alpha|hours|date)', 'date')
  .option('--top-tasks <n>', 'Number of top tasks to show', '3')
  .option('--save', 'Save report to file')
  .action(async (fiscalYear, options) => {
    try {
      const reporter = new FiscalYearReport();

      console.log(
        chalk.blue(
          `Generating ${options.format} report for fiscal year ${fiscalYear}...`
        )
      );
      console.log(
        chalk.gray(`Grouped by: ${options.groupBy}, Sorted by: ${options.sort}`)
      );

      const reportContent = await reporter.generateReport(fiscalYear, {
        groupBy: options.groupBy,
        format: options.format,
        sort: options.sort,
        topTasks: parseInt(options.topTasks, 10),
      });

      if (options.save) {
        const filePath = await reporter.saveReportToFile(
          reportContent,
          fiscalYear,
          options.format
        );
        console.log(chalk.green(`Report saved to: ${filePath}`));
      } else {
        console.log(`\\n${chalk.blue('Report Output:')}`);
        console.log('='.repeat(50));
        console.log(reportContent);
      }
    } catch (error) {
      console.error(chalk.red('Failed to generate report:'), error.message);
      process.exit(1);
    }
  });

// Date range report command
program
  .command('range <start-date> <end-date>')
  .description('Generate report for a custom date range')
  .option(
    '--group-by <field>',
    'Group by field (departmentalGoal|strategicDirection|tag)',
    'departmentalGoal'
  )
  .option('--format <format>', 'Output format (markdown|csv|json)', 'markdown')
  .option('--sort <sort>', 'Sort order (alpha|hours|date)', 'date')
  .option('--top-tasks <n>', 'Number of top tasks to show', '3')
  .option('--save', 'Save report to file')
  .action(async (startDate, endDate, options) => {
    try {
      const DateRangeReport = require('./reportDateRange');
      const report = new DateRangeReport();

      const reportContent = await report.generateReport(startDate, endDate, {
        groupBy: options.groupBy,
        format: options.format,
        sort: options.sort,
        topTasks: parseInt(options.topTasks, 10),
      });

      if (options.save) {
        const filename = `date-range-report-${startDate}-to-${endDate}-${Date.now()}.${options.format}`;
        const ReportSaver = require('./reportFiscalYear');
        await ReportSaver.prototype.saveReportToFile.call(
          {
            reportType: 'date-range',
            period: `${startDate}-to-${endDate}`,
          },
          reportContent,
          options.format,
          filename
        );
        console.log(chalk.green(`Report saved to: ${filename}`));
      } else {
        console.log(reportContent);
      }
    } catch (error) {
      console.error(
        chalk.red('Failed to generate date range report:'),
        error.message
      );
      process.exit(1);
    }
  });

// Weekly report command
program
  .command('weekly [date]')
  .description(
    'Generate report for current week or week containing specified date'
  )
  .option(
    '--group-by <field>',
    'Group by field (departmentalGoal|strategicDirection|tag)',
    'departmentalGoal'
  )
  .option('--format <format>', 'Output format (markdown|csv|json)', 'markdown')
  .option('--sort <sort>', 'Sort order (alpha|hours|date)', 'date')
  .option('--top-tasks <n>', 'Number of top tasks to show', '3')
  .option('--save', 'Save report to file')
  .action(async (date, options) => {
    try {
      const DateRangeReport = require('./reportDateRange');
      const report = new DateRangeReport();

      // Calculate week boundaries (Monday to Sunday)
      const targetDate = date ? new Date(date) : new Date();
      const weekBounds = calculateWeekBounds(targetDate);

      const reportContent = await report.generateReport(
        weekBounds.start,
        weekBounds.end,
        {
          groupBy: options.groupBy,
          format: options.format,
          sort: options.sort,
          topTasks: parseInt(options.topTasks, 10),
        }
      );

      if (options.save) {
        const filename = `weekly-report-${weekBounds.start}-${Date.now()}.${options.format}`;
        const ReportSaver = require('./reportFiscalYear');
        await ReportSaver.prototype.saveReportToFile.call(
          {
            reportType: 'weekly',
            period: `week-of-${weekBounds.start}`,
          },
          reportContent,
          options.format,
          filename
        );
        console.log(chalk.green(`Report saved to: ${filename}`));
      } else {
        console.log(reportContent);
      }
    } catch (error) {
      console.error(
        chalk.red('Failed to generate weekly report:'),
        error.message
      );
      process.exit(1);
    }
  });

// Monthly report command
program
  .command('monthly [date]')
  .description('Generate report for current month or specified month (YYYY-MM)')
  .option(
    '--group-by <field>',
    'Group by field (departmentalGoal|strategicDirection|tag)',
    'departmentalGoal'
  )
  .option('--format <format>', 'Output format (markdown|csv|json)', 'markdown')
  .option('--sort <sort>', 'Sort order (alpha|hours|date)', 'date')
  .option('--top-tasks <n>', 'Number of top tasks to show', '3')
  .option('--save', 'Save report to file')
  .action(async (date, options) => {
    try {
      const DateRangeReport = require('./reportDateRange');
      const report = new DateRangeReport();

      // Calculate month boundaries
      const monthBounds = calculateMonthBounds(date);

      const reportContent = await report.generateReport(
        monthBounds.start,
        monthBounds.end,
        {
          groupBy: options.groupBy,
          format: options.format,
          sort: options.sort,
          topTasks: parseInt(options.topTasks, 10),
        }
      );

      if (options.save) {
        const filename = `monthly-report-${monthBounds.start.substring(0, 7)}-${Date.now()}.${options.format}`;
        const ReportSaver = require('./reportFiscalYear');
        await ReportSaver.prototype.saveReportToFile.call(
          {
            reportType: 'monthly',
            period: monthBounds.start.substring(0, 7),
          },
          reportContent,
          options.format,
          filename
        );
        console.log(chalk.green(`Report saved to: ${filename}`));
      } else {
        console.log(reportContent);
      }
    } catch (error) {
      console.error(
        chalk.red('Failed to generate monthly report:'),
        error.message
      );
      process.exit(1);
    }
  });

// Archive command
program
  .command('archive')
  .description('Archive management commands')
  .option('--auto', 'Automatically archive old time logs (older than 2 years)')
  .option('--year <fiscal-year>', 'Archive a specific fiscal year')
  .option('--list', 'List all archived files')
  .option('--stats', 'Show archive statistics')
  .option('--restore <filename>', 'Restore a file from archive')
  .option('--cleanup', 'Clean up old backup files')
  .action(async (options) => {
    try {
      const archiveManager = new ArchiveManager();

      if (options.auto) {
        console.log(chalk.blue('Auto-archiving old time logs...'));
        const result = await archiveManager.archiveOldTimeLogs();
        console.log(chalk.green(result.message));
        if (result.archivedFiles.length > 0) {
          result.archivedFiles.forEach((file) => {
            console.log(`  ✓ Archived: ${file}`);
          });
        }
      } else if (options.year) {
        console.log(chalk.blue(`Archiving fiscal year ${options.year}...`));
        const result = await archiveManager.archiveSpecificYear(options.year);
        console.log(chalk.green(result.message));
      } else if (options.list) {
        console.log(chalk.blue('Archived files:'));
        const files = archiveManager.listArchivedFiles();
        if (files.length === 0) {
          console.log(chalk.yellow('No archived files found.'));
        } else {
          console.table(
            files.map((file) => ({
              'Fiscal Year': file.fiscalYear,
              'File Name': file.fileName,
              'Size (KB)': file.sizeKB,
              'Archived Date': file.archivedDate,
            }))
          );
        }
      } else if (options.stats) {
        console.log(chalk.blue('Archive statistics:'));
        const stats = archiveManager.getArchiveStats();
        console.log(`  Files: ${stats.fileCount}`);
        console.log(`  Total size: ${stats.totalSizeMB} MB`);
        if (stats.oldestFile) {
          console.log(
            `  Oldest: ${stats.oldestFile.fiscalYear} (${stats.oldestFile.archivedDate})`
          );
        }
        if (stats.newestFile) {
          console.log(
            `  Newest: ${stats.newestFile.fiscalYear} (${stats.newestFile.archivedDate})`
          );
        }
      } else if (options.restore) {
        console.log(chalk.blue(`Restoring ${options.restore}...`));
        const result = await archiveManager.restoreFromArchive(options.restore);
        console.log(chalk.green(result.message));
      } else if (options.cleanup) {
        console.log(chalk.blue('Cleaning up old backup files...'));
        const result = archiveManager.cleanupOldBackups();
        console.log(chalk.green(result.message));
      } else {
        console.log(
          chalk.yellow(
            'Please specify an archive action. Use --help for options.'
          )
        );
      }
    } catch (error) {
      console.error(chalk.red('Archive operation failed:'), error.message);
      process.exit(1);
    }
  });

// Wiki-link command
program
  .command('wiki')
  .description('Wiki-link management commands')
  .option('--validate <file>', 'Validate wiki-links in a specific file')
  .option('--validate-all', 'Validate all wiki-links in time logs')
  .option('--list-projects', 'List all available projects')
  .option('--create <name>', 'Create a new project file')
  .option('--fix <file>', 'Auto-fix wiki-links in a file')
  .option('--suggestions <text>', 'Get suggestions for a project name')
  .action(async (options) => {
    try {
      const wikiValidator = new WikiLinkValidator();
      await wikiValidator.loadProjectCache();

      if (options.listProjects) {
        console.log(chalk.blue('Available projects:'));
        const projects = wikiValidator.getProjectNames();
        if (projects.length === 0) {
          console.log(chalk.yellow('No projects found.'));
        } else {
          projects.forEach((project, index) => {
            console.log(`  ${index + 1}. ${project}`);
          });
        }
      } else if (options.create) {
        console.log(chalk.blue(`Creating project: ${options.create}`));
        const result = await wikiValidator.createProjectForWikiLink(
          options.create
        );
        console.log(chalk.green(`✓ Created: ${result.filePath}`));
      } else if (options.suggestions) {
        console.log(chalk.blue(`Suggestions for: "${options.suggestions}"`));
        const suggestions = wikiValidator.getSuggestions(options.suggestions);
        if (suggestions.length === 0) {
          console.log(chalk.yellow('No suggestions found.'));
        } else {
          suggestions.forEach((suggestion, index) => {
            console.log(`  ${index + 1}. ${suggestion}`);
          });
        }
      } else if (options.validate) {
        console.log(
          chalk.blue(`Validating wiki-links in: ${options.validate}`)
        );
        const fs = require('fs');
        if (!fs.existsSync(options.validate)) {
          console.log(chalk.red(`File not found: ${options.validate}`));
          return;
        }

        const content = fs.readFileSync(options.validate, 'utf8');
        const validation = await wikiValidator.validateWikiLinks(content);

        if (validation.isValid) {
          console.log(chalk.green('✓ All wiki-links are valid'));
        } else {
          console.log(
            chalk.red(`✗ ${validation.invalidCount} invalid wiki-links found:`)
          );
          validation.links
            .filter((l) => !l.exists)
            .forEach((link) => {
              console.log(chalk.yellow(`  - "${link.linkText}"`));
              if (link.suggestions.length > 0) {
                console.log(
                  chalk.gray(`    Suggestions: ${link.suggestions.join(', ')}`)
                );
              }
            });
        }
      } else if (options.validateAll) {
        console.log(chalk.blue('Validating all time log files...'));
        const path = require('path');
        const fs = require('fs');
        const timeLogsDir = path.join(__dirname, '../time-logs');

        if (!fs.existsSync(timeLogsDir)) {
          console.log(chalk.yellow('No time-logs directory found.'));
          return;
        }

        const files = fs
          .readdirSync(timeLogsDir)
          .filter(
            (file) => file.endsWith('.md') && file.startsWith('time-log-')
          )
          .map((file) => path.join(timeLogsDir, file));

        let totalInvalid = 0;
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          const validation = await wikiValidator.validateWikiLinks(content);

          if (!validation.isValid) {
            console.log(
              chalk.red(
                `${path.basename(file)}: ${validation.invalidCount} invalid links`
              )
            );
            totalInvalid += validation.invalidCount;
          } else {
            console.log(chalk.green(`${path.basename(file)}: ✓ valid`));
          }
        }

        console.log(chalk.blue(`\nTotal invalid wiki-links: ${totalInvalid}`));
      } else if (options.fix) {
        console.log(chalk.blue(`Auto-fixing wiki-links in: ${options.fix}`));
        const fs = require('fs');
        if (!fs.existsSync(options.fix)) {
          console.log(chalk.red(`File not found: ${options.fix}`));
          return;
        }

        const content = fs.readFileSync(options.fix, 'utf8');
        const result = await wikiValidator.autoFixWikiLinks(content, false);

        // Filter to only suggestion type changes that can actually be applied
        const suggestableChanges = result.changes.filter(
          (change) => change.type === 'suggestion'
        );

        if (suggestableChanges.length > 0) {
          console.log(chalk.yellow('Suggested changes:'));
          suggestableChanges.forEach((change) => {
            console.log(`  "${change.original}" → "${change.replacement}"`);
          });

          const inquirer = require('inquirer');
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'apply',
              message: 'Apply these changes?',
              default: false,
            },
          ]);

          if (answer.apply) {
            fs.writeFileSync(options.fix, result.fixedText, 'utf8');
            console.log(chalk.green('✓ Changes applied'));
          }
        } else if (result.hasChanges) {
          // Show unresolved changes
          console.log(
            chalk.yellow(
              'Found invalid wiki-links but no suggestions available:'
            )
          );
          result.changes
            .filter((c) => c.type === 'unresolved')
            .forEach((change) => {
              console.log(
                `  - "${change.original}" (no similar projects found)`
              );
            });
          console.log(
            chalk.blue(
              '💡 Consider creating these projects with: npm run tm -- wiki --create "Project Name"'
            )
          );
        } else {
          console.log(chalk.green('✓ No changes needed'));
        }
      } else {
        console.log(
          chalk.yellow(
            'Please specify a wiki-link action. Use --help for options.'
          )
        );
      }
    } catch (error) {
      console.error(chalk.red('Wiki-link operation failed:'), error.message);
      process.exit(1);
    }
  });

// Tags command
program
  .command('tags')
  .description('Tag standardization and management commands')
  .option('--standardize-projects', 'Standardize tags in all project files')
  .option('--standardize-timelogs', 'Standardize tags in all time log files')
  .option('--standardize-all', 'Standardize tags in all files')
  .option('--stats', 'Show tag usage statistics')
  .option('--validate <tag>', 'Validate if a tag meets standards')
  .option('--normalize <tag>', 'Show normalized version of a tag')
  .option('--report', 'Generate tag migration report')
  .action(async (options) => {
    try {
      const tagStandardizer = new TagStandardizer();

      if (options.stats) {
        console.log(chalk.blue('Analyzing tag usage...'));
        const stats = await tagStandardizer.getTagStatistics();

        console.log(chalk.green('\nTag Statistics:'));
        console.log(`  Total tags: ${stats.totalTags}`);
        console.log(`  Unique tags: ${stats.uniqueTagCount}`);
        console.log(`  Invalid tags: ${stats.invalidTags.length}`);

        if (stats.invalidTags.length > 0) {
          console.log(chalk.yellow('\nInvalid tags found:'));
          stats.invalidTags.forEach((invalid) => {
            console.log(
              `  - "${invalid.tag}" in ${invalid.file} → "${invalid.normalized}"`
            );
          });
        }

        if (stats.uniqueTags.length > 0) {
          console.log(chalk.blue('\nAll unique tags:'));
          stats.uniqueTags.forEach((tag, _index) => {
            const status = tagStandardizer.isValidTag(tag)
              ? chalk.green('✓')
              : chalk.red('✗');
            console.log(`  ${status} ${tag}`);
          });
        }
      } else if (options.validate) {
        console.log(chalk.blue(`Validating tag: "${options.validate}"`));
        const isValid = tagStandardizer.isValidTag(options.validate);
        const normalized = tagStandardizer.normalizeTag(options.validate);

        if (isValid) {
          console.log(chalk.green('✓ Tag is valid'));
        } else {
          console.log(chalk.red('✗ Tag is invalid'));
          console.log(chalk.yellow(`  Normalized: "${normalized}"`));
          console.log(
            chalk.gray(
              `  Reason: ${tagStandardizer.getValidationReason(normalized)}`
            )
          );
        }
      } else if (options.normalize) {
        console.log(chalk.blue(`Normalizing tag: "${options.normalize}"`));
        const normalized = tagStandardizer.normalizeTag(options.normalize);
        console.log(`Original: "${options.normalize}"`);
        console.log(`Normalized: "${normalized}"`);

        if (tagStandardizer.isValidTag(normalized)) {
          console.log(chalk.green('✓ Normalized tag is valid'));
        } else {
          console.log(chalk.red('✗ Normalized tag is still invalid'));
          console.log(
            chalk.gray(
              `  Reason: ${tagStandardizer.getValidationReason(normalized)}`
            )
          );
        }
      } else if (options.report) {
        console.log(chalk.blue('Generating tag migration report...'));
        const report = await tagStandardizer.generateMigrationReport();

        console.log(chalk.green('\nTag Migration Report:'));
        console.log(`  Total tags: ${report.summary.totalTags}`);
        console.log(`  Unique tags: ${report.summary.uniqueTags}`);
        console.log(`  Invalid tags: ${report.summary.invalidTags}`);
        console.log(
          `  Needs migration: ${report.summary.needsMigration ? 'Yes' : 'No'}`
        );

        if (report.recommendations.length > 0) {
          console.log(chalk.yellow('\nRecommendations:'));
          report.recommendations.forEach((rec) => {
            console.log(`  - ${rec}`);
          });
        }

        if (report.invalidTags.length > 0) {
          console.log(chalk.red('\nInvalid tags that will be fixed:'));
          report.invalidTags.forEach((invalid) => {
            console.log(
              `  - "${invalid.tag}" → "${invalid.normalized}" (${invalid.file})`
            );
          });
        }
      } else if (options.standardizeProjects) {
        console.log(chalk.blue('Standardizing tags in project files...'));
        const result = await tagStandardizer.standardizeProjectTags();

        console.log(chalk.green('\nProject tag standardization complete:'));
        console.log(`  Files processed: ${result.filesProcessed}`);
        console.log(`  Files changed: ${result.filesChanged}`);
        console.log(`  Tags standardized: ${result.tagsStandardized}`);

        if (result.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          result.errors.forEach((error) => {
            console.log(`  - ${error.file}: ${error.error}`);
          });
        }
      } else if (options.standardizeTimelogs) {
        console.log(chalk.blue('Standardizing tags in time log files...'));
        const result = await tagStandardizer.standardizeTimeLogTags();

        console.log(chalk.green('\nTime log tag standardization complete:'));
        console.log(`  Files processed: ${result.filesProcessed}`);
        console.log(`  Files changed: ${result.filesChanged}`);
        console.log(`  Tags standardized: ${result.tagsStandardized}`);

        if (result.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          result.errors.forEach((error) => {
            console.log(`  - ${error.file}: ${error.error}`);
          });
        }
      } else if (options.standardizeAll) {
        console.log(chalk.blue('Standardizing tags in all files...'));

        const projectResult = await tagStandardizer.standardizeProjectTags();
        const timeLogResult = await tagStandardizer.standardizeTimeLogTags();

        console.log(chalk.green('\nComplete tag standardization results:'));
        console.log('Projects:');
        console.log(`  Files processed: ${projectResult.filesProcessed}`);
        console.log(`  Files changed: ${projectResult.filesChanged}`);
        console.log(`  Tags standardized: ${projectResult.tagsStandardized}`);

        console.log('Time Logs:');
        console.log(`  Files processed: ${timeLogResult.filesProcessed}`);
        console.log(`  Files changed: ${timeLogResult.filesChanged}`);
        console.log(`  Tags standardized: ${timeLogResult.tagsStandardized}`);

        const totalErrors = [...projectResult.errors, ...timeLogResult.errors];
        if (totalErrors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          totalErrors.forEach((error) => {
            console.log(`  - ${error.file}: ${error.error}`);
          });
        }
      } else {
        console.log(
          chalk.yellow('Please specify a tag action. Use --help for options.')
        );
      }
    } catch (error) {
      console.error(chalk.red('Tag operation failed:'), error.message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Input validation utilities')
  .option('--date <date>', 'Validate a date (YYYY-MM-DD)')
  .option('--time <time>', 'Validate a time (HH:MM)')
  .option('--fiscal-year <year>', 'Validate a fiscal year (YYYY-YYYY)')
  .option('--entry <json>', 'Validate a complete time entry (JSON string)')
  .option('--file <path>', 'Validate entries from a JSON file')
  .action(async (options) => {
    try {
      const inputValidator = new InputValidator();

      if (options.date) {
        console.log(chalk.blue(`Validating date: "${options.date}"`));
        const result = inputValidator.validateDate(options.date);
        console.log(inputValidator.formatValidationResults(result));
      } else if (options.time) {
        console.log(chalk.blue(`Validating time: "${options.time}"`));
        const result = inputValidator.validateTime(options.time);
        console.log(inputValidator.formatValidationResults(result));
      } else if (options.fiscalYear) {
        console.log(
          chalk.blue(`Validating fiscal year: "${options.fiscalYear}"`)
        );
        const result = inputValidator.validateFiscalYear(options.fiscalYear);
        console.log(inputValidator.formatValidationResults(result));
      } else if (options.entry) {
        console.log(chalk.blue('Validating time entry...'));
        try {
          const entry = JSON.parse(options.entry);
          const result = await inputValidator.validateTimeEntry(entry);

          console.log(`\n📊 Validation Summary:`);
          console.log(`   Errors: ${result.errors.length}`);
          console.log(`   Warnings: ${result.warnings.length}`);
          console.log(
            `   Status: ${result.isValid ? chalk.green('VALID') : chalk.red('INVALID')}`
          );

          if (result.errors.length > 0 || result.warnings.length > 0) {
            console.log(`\n${inputValidator.formatValidationResults(result)}`);
          }
        } catch (parseError) {
          console.log(chalk.red('Invalid JSON format:'), parseError.message);
        }
      } else if (options.file) {
        console.log(
          chalk.blue(`Validating entries from file: ${options.file}`)
        );
        const fs = require('fs');

        if (!fs.existsSync(options.file)) {
          console.log(chalk.red(`File not found: ${options.file}`));
          return;
        }

        try {
          const content = fs.readFileSync(options.file, 'utf8');
          const entries = JSON.parse(content);
          const entriesArray = Array.isArray(entries) ? entries : [entries];

          console.log(`\n🔍 Validating ${entriesArray.length} entries...\n`);

          let totalErrors = 0;
          let totalWarnings = 0;
          let validEntries = 0;

          for (let i = 0; i < entriesArray.length; i++) {
            const entry = entriesArray[i];
            console.log(chalk.blue(`Entry ${i + 1}:`));

            const result = await inputValidator.validateTimeEntry(entry);
            totalErrors += result.errors.length;
            totalWarnings += result.warnings.length;

            if (result.isValid) {
              validEntries++;
              console.log(chalk.green('  ✅ Valid'));
            } else {
              console.log(
                chalk.red(`  ❌ Invalid (${result.errors.length} errors)`)
              );
            }

            if (result.warnings.length > 0) {
              console.log(
                chalk.yellow(`  ⚠️  ${result.warnings.length} warnings`)
              );
            }

            if (result.errors.length > 0 || result.warnings.length > 0) {
              const formatted = inputValidator.formatValidationResults(result);
              console.log(`  ${formatted.replace(/\n/g, '\n  ')}`);
            }

            console.log('');
          }

          console.log(chalk.blue('📊 Batch Validation Summary:'));
          console.log(`   Total entries: ${entriesArray.length}`);
          console.log(`   Valid entries: ${chalk.green(validEntries)}`);
          console.log(
            `   Invalid entries: ${chalk.red(entriesArray.length - validEntries)}`
          );
          console.log(`   Total errors: ${chalk.red(totalErrors)}`);
          console.log(`   Total warnings: ${chalk.yellow(totalWarnings)}`);
        } catch (parseError) {
          console.log(
            chalk.red('Invalid JSON format in file:'),
            parseError.message
          );
        }
      } else {
        console.log(
          chalk.yellow(
            'Please specify what to validate. Use --help for options.'
          )
        );
        console.log('\nExamples:');
        console.log('  npm run tm -- validate --date "2025-07-29"');
        console.log('  npm run tm -- validate --time "14:30"');
        console.log('  npm run tm -- validate --fiscal-year "2025-2026"');
        console.log(
          '  npm run tm -- validate --entry \'{"date":"2025-07-29","startTime":"09:00","endTime":"10:00","task":"Test","project":"Demo"}\''
        );
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error.message);
      process.exit(1);
    }
  });

// Start command
program
  .command('start')
  .description('Start tracking time for a new task')
  .option('-d, --date <date>', 'Date for the entry (YYYY-MM-DD)')
  .option('-s, --start <time>', 'Start time (HH:MM)')
  .option(
    '-t, --task <task>',
    'Task description (required in non-interactive mode)'
  )
  .option('-p, --project <project>', 'Project name')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('-n, --notes <notes>', 'Additional notes')
  .option('--no-interactive', 'Disable interactive mode (requires all options)')
  .action(async (options) => {
    try {
      const timeTracker = new TimeTracker();

      // Check if --no-interactive was explicitly set
      const isNonInteractive =
        !options.interactive && process.argv.includes('--no-interactive');

      // Use interactive mode if not in non-interactive mode and no task is provided
      const useInteractive = !isNonInteractive && !options.task;

      if (useInteractive) {
        // Interactive mode - show prompts for missing information
        console.log(chalk.blue('\nStarting interactive time tracking...\n'));
        const result = await timeTracker.processInteractiveStart();
        console.log(chalk.green('✓'), result.message);
        console.log(chalk.gray('Entry:'), result.entry);
        console.log(chalk.gray('File:'), result.filePath);
        return;
      }

      // Non-interactive mode - require task parameter
      if (!options.task) {
        console.error(
          chalk.red(
            'Error: Task description is required in non-interactive mode. ' +
              'Use --task or run without arguments for interactive mode.'
          )
        );
        process.exit(1);
      }

      const result = await timeTracker.startEntry({
        task: options.task,
        project: options.project,
        tags: options.tags,
        notes: options.notes,
        date: options.date,
        start: options.start,
      });

      console.log(chalk.green('✓'), result.message);
      console.log(chalk.gray('Entry:'), result.entry);
      console.log(chalk.gray('File:'), result.filePath);
    } catch (error) {
      console.error(chalk.red('Failed to start entry:'), error.message);
      process.exit(1);
    }
  });

// Finish command
program
  .command('finish')
  .description('Finish the current active time entry')
  .option('-e, --end <time>', 'End time (HH:MM)')
  .option('-n, --notes <notes>', 'Additional notes')
  .action(async (options) => {
    try {
      const timeTracker = new TimeTracker();
      const result = await timeTracker.finishEntry(options);

      console.log(chalk.green('✓'), result.message);
      console.log(chalk.gray('Entry:'), result.entry);
      console.log(chalk.gray('Duration:'), result.duration);
      console.log(chalk.gray('File:'), result.filePath);
    } catch (error) {
      console.error(chalk.red('Failed to finish entry:'), error.message);
      process.exit(1);
    }
  });

// Index command
program
  .command('index')
  .description('Re-index all data from Markdown files into database')
  .action(async () => {
    try {
      const dataIndexer = new DataIndexer();
      await dataIndexer.initialize({ skipAutoReindex: true });

      console.log(chalk.blue('Starting data re-indexing...'));

      const results = await dataIndexer.indexAllData();

      console.log(chalk.green('✓ Re-indexing completed successfully!'));
      console.log(chalk.gray('Projects indexed:'), results.projects.indexed);
      console.log(
        chalk.gray('Time entries indexed:'),
        results.timeEntries.indexed
      );

      await dataIndexer.close();
    } catch (error) {
      console.error(chalk.red('Failed to re-index data:'), error.message);
      process.exit(1);
    }
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
  console.log(chalk.yellow('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
