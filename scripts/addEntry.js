/**
 * @fileoverview Time entry creation and management with comprehensive validation
 * Handles interactive and non-interactive entry creation, batch processing,
 * wiki-link validation, tag standardization, and project auto-creation.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const DataIndexer = require('./dataIndexer');
const TimeDataParser = require('./computeTimeData');
const WikiLinkValidator = require('./wikiLinkValidator');
const TagStandardizer = require('./tagStandardizer');
const InputValidator = require('./inputValidator');
const errorLogger = require('./errorLogger');

/**
 * Handles time entry creation with comprehensive validation and processing
 * Supports interactive prompts, non-interactive command-line usage, and batch processing
 *
 * @class AddEntry
 */
class AddEntry {
  /**
   * Initialize the AddEntry instance with all required validators and processors
   * @constructor
   */
  constructor() {
    this.dataIndexer = new DataIndexer();
    this.timeParser = new TimeDataParser();
    this.wikiValidator = new WikiLinkValidator();
    this.tagStandardizer = new TagStandardizer();
    this.inputValidator = new InputValidator();
  }

  /**
   * Initialize the data indexer and prepare for entry operations
   * @async
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.dataIndexer.initialize();
  }

  /**
   * Add a time entry using either interactive prompts or provided options
   * Supports single entries, batch processing from JSON files, and comprehensive validation
   *
   * @async
   * @param {Object} options - Entry options or configuration
   * @param {string} [options.date] - Entry date in YYYY-MM-DD format
   * @param {string} [options.start] - Start time in HH:MM format
   * @param {string} [options.end] - End time in HH:MM format
   * @param {string} [options.task] - Task description
   * @param {string} [options.project] - Project name
   * @param {string} [options.tags] - Comma-separated tags
   * @param {string} [options.notes] - Additional notes
   * @param {string} [options.file] - JSON file path for batch processing
   * @returns {Promise<Object>} Result of the entry creation operation
   * @throws {Error} When validation fails or required fields are missing
   */
  async addEntry(options = {}) {
    try {
      await this.initialize();

      let entryData;

      if (options.file) {
        // Batch mode - read from JSON file
        entryData = await this.processBatchFile(options.file);
      } else if (AddEntry.hasAllRequiredFlags(options)) {
        // Non-interactive mode - use provided flags
        entryData = await this.processNonInteractive(options);
      } else {
        // Interactive mode - prompt user
        entryData = await this.processInteractive(options);
      }

      // Add the entry
      const result = await this.saveEntry(entryData);
      console.log(
        chalk.green(
          `✓ Added time entry: ${entryData.task} (${entryData.durationHours}h)`
        )
      );

      return result;
    } catch (error) {
      console.error(chalk.red('Error adding entry:'), error.message);
      errorLogger.logError(error, {
        operation: 'ADD_ENTRY',
        options,
      });
      throw error;
    } finally {
      await this.dataIndexer.close();
    }
  }

  /**
   * Check if all required flags are provided for non-interactive mode
   */
  static hasAllRequiredFlags(options) {
    const required = ['date', 'start', 'end', 'task', 'project'];
    return required.every((field) => options[field]);
  }

  /**
   * Process batch entries from JSON file
   */
  async processBatchFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Batch file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let entries;

    try {
      entries = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON in batch file: ${error.message}`);
    }

    if (!Array.isArray(entries)) {
      entries = [entries];
    }

    const results = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const entry of entries) {
      // eslint-disable-next-line no-await-in-loop
      const processedEntry = await this.validateAndProcessEntry(entry);
      // eslint-disable-next-line no-await-in-loop
      const result = await this.saveEntry(processedEntry);
      results.push(result);
      console.log(
        chalk.green(
          `✓ Added: ${processedEntry.task} (${processedEntry.durationHours}h)`
        )
      );
    }

    console.log(
      chalk.blue(`\nBatch complete: ${results.length} entries added`)
    );
    return results;
  }

  /**
   * Process non-interactive mode with command line flags
   */
  async processNonInteractive(options) {
    const entry = {
      date: options.date,
      startTime: options.start,
      endTime: options.end,
      task: options.task,
      project: options.project,
      tags: options.tags
        ? this.tagStandardizer.normalizeTags(options.tags.split(','))
        : [],
      notes: options.notes || null,
    };

    return this.validateAndProcessEntry(entry);
  }

  /**
   * Process interactive mode with inquirer prompts
   */
  async processInteractive(options = {}) {
    console.log(chalk.blue('Interactive Time Entry'));
    console.log('======================\n');

    // Get available projects and tags for suggestions
    const projects = await this.dataIndexer.getAllProjectSummaries();
    const projectNames = projects.map((p) => p.project_name);

    // Load wiki-link validator and get project names
    await this.wikiValidator.loadProjectCache();
    const wikiProjectNames = this.wikiValidator.getProjectNames();

    // Combine project names from both sources
    const allProjectNames = [
      ...new Set([...projectNames, ...wikiProjectNames]),
    ];

    // Get existing tags from recent entries for suggestions
    const recentTags = await this.getRecentTags();

    const questions = [
      {
        type: 'input',
        name: 'date',
        message: 'Date (YYYY-MM-DD):',
        default: options.date || AddEntry.getCurrentDate(),
        validate: (input) =>
          this.timeParser.isValidDate(input) ||
          'Please enter a valid date (YYYY-MM-DD)',
      },
      {
        type: 'input',
        name: 'startTime',
        message: 'Start time (HH:MM):',
        default: options.start,
        validate: (input) =>
          this.timeParser.isValidTime(input) ||
          'Please enter a valid time (HH:MM)',
      },
      {
        type: 'input',
        name: 'endTime',
        message: 'End time (HH:MM):',
        default: options.end,
        validate: (input) =>
          this.timeParser.isValidTime(input) ||
          'Please enter a valid time (HH:MM)',
      },
      {
        type: 'input',
        name: 'task',
        message: 'Task description:',
        default: options.task,
        validate: (input) =>
          input.trim().length > 0 || 'Task description is required',
      },
      {
        type: 'list',
        name: 'project',
        message: 'Project:',
        choices: [
          ...allProjectNames,
          new inquirer.Separator(),
          'Enter custom project name',
        ],
        default: options.project,
      },
      {
        type: 'input',
        name: 'customProject',
        message: 'Custom project name:',
        when: (answers) => answers.project === 'Enter custom project name',
        validate: (input) =>
          input.trim().length > 0 || 'Project name is required',
      },
      {
        type: 'checkbox',
        name: 'tags',
        message: 'Tags (select existing or add custom):',
        choices: [
          ...recentTags.map((tag) => ({ name: tag, value: tag })),
          new inquirer.Separator(),
          { name: 'Add custom tags', value: '__custom__' },
        ],
        default: options.tags || [],
        validate: (input) => {
          // At least show what was selected for debugging
          if (!Array.isArray(input)) {
            return 'Please select at least one option or none';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'customTags',
        message:
          'Custom tags (comma-separated) - leave empty if not adding custom tags:',
        default: '',
        filter: (input) => {
          if (!input || input.trim() === '') {
            return [];
          }
          return this.tagStandardizer.normalizeTags(
            input.split(',').map((tag) => tag.trim())
          );
        },
      },
      {
        type: 'input',
        name: 'notes',
        message: 'Notes (optional):',
        default: options.notes,
      },
    ];

    const answers = await inquirer.prompt(questions);

    // Process answers
    const selectedTags = (answers.tags || []).filter(
      (tag) => tag !== '__custom__'
    );
    const customTags = answers.customTags || [];

    const entry = {
      date: answers.date,
      startTime: answers.startTime,
      endTime: answers.endTime,
      task: answers.task.trim(),
      project: answers.customProject || answers.project,
      tags: [...selectedTags, ...customTags],
      notes: answers.notes?.trim() || null,
    };

    return this.validateAndProcessEntry(entry);
  }

  /**
   * Validate and process entry data
   */
  async validateAndProcessEntry(entry) {
    console.log(chalk.blue('\n🔍 Validating entry...'));

    // Get existing entries for overlap detection
    const existingEntries = await this.dataIndexer.db.getTimeEntriesForDate(
      entry.date
    );

    // Run comprehensive validation
    const validationResults = await this.inputValidator.validateTimeEntry(
      entry,
      existingEntries
    );

    // Log validation results
    this.inputValidator.logValidationResults(validationResults, {
      operation: 'ADD_ENTRY_VALIDATION',
      entry,
    });

    // Display validation results
    if (
      validationResults.errors.length > 0 ||
      validationResults.warnings.length > 0
    ) {
      console.log(
        `\n${this.inputValidator.formatValidationResults(validationResults)}`
      );
    }

    // Stop if there are errors
    if (!validationResults.isValid) {
      const errorMessage = `Validation failed with ${validationResults.errors.length} error(s)`;
      throw new Error(errorMessage);
    }

    // Show summary for warnings
    if (validationResults.warnings.length > 0) {
      console.log(
        chalk.yellow(
          `\n📋 ${validationResults.warnings.length} warning(s) detected`
        )
      );

      // Ask user if they want to continue with warnings
      const continueAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continue',
          message: 'Continue with warnings?',
          default: true,
        },
      ]);

      if (!continueAnswer.continue) {
        throw new Error('Entry cancelled due to validation warnings');
      }
    }

    // Standardize tags (already validated above)
    entry.tags = this.tagStandardizer.normalizeTags(entry.tags || []);

    // Calculate duration
    const durationHours = this.timeParser.calculateDuration(
      entry.startTime,
      entry.endTime
    );

    // Handle wiki-links (create missing projects)
    await this.handleWikiLinksInEntry(entry);

    console.log(chalk.green('✅ Validation completed successfully'));

    return {
      ...entry,
      durationHours,
    };
  }

  /**
   * Handle wiki-links in entry text fields (create missing projects)
   */
  async handleWikiLinksInEntry(entry) {
    // Ensure the project exists as a wiki-link (auto-create if needed)
    await this.wikiValidator.loadProjectCache();

    if (!this.wikiValidator.projectExists(entry.project)) {
      try {
        console.log(
          chalk.blue(`📝 Creating project file for: ${entry.project}`)
        );
        await this.wikiValidator.createProjectForWikiLink(entry.project);
        console.log(chalk.green(`✓ Created project file: ${entry.project}.md`));
      } catch (error) {
        console.log(
          chalk.yellow(`⚠️  Could not create project file: ${error.message}`)
        );
        console.log(
          chalk.gray(
            "   Project will still be saved but won't have a project file"
          )
        );
      }
    }
  }

  /**
   * Save entry to both database and Markdown file
   */
  async saveEntry(entry) {
    // Save to database
    const dbResult = await this.dataIndexer.db.insertTimeEntry(entry);

    // Append to Markdown file
    await this.appendToMarkdownFile(entry);

    return dbResult;
  }

  /**
   * Append entry to appropriate Markdown time log file
   */
  async appendToMarkdownFile(entry) {
    const fiscalYear = AddEntry.getFiscalYearFromDate(entry.date);
    const filePath = path.join(
      this.dataIndexer.timeLogsDir,
      `time-log-${fiscalYear}.md`
    );

    // Create file if it doesn't exist
    if (!fs.existsSync(filePath)) {
      const header = `# Time Log ${fiscalYear}\n\n`;
      fs.writeFileSync(filePath, header, 'utf8');
    }

    // Read existing content
    let content = fs.readFileSync(filePath, 'utf8');

    // Format the entry
    const monthYear = AddEntry.getMonthYearFromDate(entry.date);
    const dateHeader = `### ${entry.date}`;
    const tagsStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
    const entryLine = `- **${entry.startTime}-${entry.endTime}**: ${entry.task} [[${entry.project}]]${tagsStr}`;
    const notesLine = entry.notes ? `  - Notes: ${entry.notes}` : '';

    // Find or create the month section
    const monthHeader = `## ${monthYear}`;
    if (!content.includes(monthHeader)) {
      content += `${monthHeader}\n\n`;
    }

    // Find or create the date section
    if (!content.includes(dateHeader)) {
      // Find where to insert the date header (chronologically)
      const dateRegex = /^### (\d{4}-\d{2}-\d{2})$/gm;
      const dates = [];
      let match;

      while ((match = dateRegex.exec(content)) !== null) {
        dates.push({ date: match[1], index: match.index });
      }

      // Find insertion point for new date section
      let insertIndex = content.length;
      // eslint-disable-next-line no-restricted-syntax
      for (const dateMatch of dates) {
        if (entry.date < dateMatch.date) {
          insertIndex = dateMatch.index;
          break;
        }
      }

      // Ensure proper spacing before insertion
      let insertion = `${dateHeader}\n${entryLine}${notesLine ? `\n${notesLine}` : ''}\n\n`;
      if (
        insertIndex > 0 &&
        !content.slice(insertIndex - 2, insertIndex).includes('\n\n')
      ) {
        insertion = `\n${insertion}`;
      }

      content =
        content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
    } else {
      // Add to existing date section in chronological order
      const dateIndex = content.indexOf(dateHeader);
      const nextDateIndex = content.indexOf('\n### ', dateIndex + 1);
      const sectionEnd = nextDateIndex === -1 ? content.length : nextDateIndex;

      // Extract existing entries for this date
      const sectionContent = content.slice(dateIndex, sectionEnd);
      const entryRegex = /^- \*\*(\d{2}:\d{2})-(\d{2}:\d{2})\*\*:/gm;
      const existingEntries = [];
      let entryMatch;

      while ((entryMatch = entryRegex.exec(sectionContent)) !== null) {
        existingEntries.push({
          startTime: entryMatch[1],
          index: dateIndex + entryMatch.index,
        });
      }

      // Find insertion point based on start time
      let insertIndex = sectionEnd;
      // eslint-disable-next-line no-restricted-syntax
      for (const existingEntry of existingEntries) {
        if (entry.startTime < existingEntry.startTime) {
          insertIndex = existingEntry.index;
          break;
        }
      }

      const insertion = `${entryLine}${notesLine ? `\n${notesLine}` : ''}\n`;
      content =
        content.slice(0, insertIndex) + insertion + content.slice(insertIndex);
    }

    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * Get recent tags for suggestions
   */
  async getRecentTags() {
    const allProjects = await this.dataIndexer.getAllProjectSummaries();
    const allTags = new Set();

    // Get tags from projects
    allProjects.forEach((project) => {
      if (project.tags && project.tags !== 'null') {
        try {
          // Handle both string and already-parsed array cases
          let tags;
          if (typeof project.tags === 'string') {
            if (project.tags.trim() !== '') {
              tags = JSON.parse(project.tags);
            }
          } else if (Array.isArray(project.tags)) {
            tags = project.tags;
          }

          if (Array.isArray(tags)) {
            tags.forEach((tag) => allTags.add(tag));
          }
        } catch (error) {
          // Skip invalid JSON tags
          console.warn(
            `Warning: Invalid tags JSON in project ${project.project_name}: ${project.tags}`
          );
        }
      }
    });

    // TODO: Get tags from recent time entries
    // This would require additional database queries

    return Array.from(allTags).sort();
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  static getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get fiscal year from date (assumes July-June fiscal year)
   */
  static getFiscalYearFromDate(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-based

    if (month >= 6) {
      // July or later
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  }

  /**
   * Get month-year string from date
   */
  static getMonthYearFromDate(dateStr) {
    const date = new Date(dateStr);
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }
}

module.exports = AddEntry;
