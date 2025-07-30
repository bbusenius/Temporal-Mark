/**
 * @fileoverview Time Tracker for managing active/incomplete time entries
 * Handles starting and finishing time entries with [ACTIVE] marker system.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const chalk = require('chalk');
const WikiLinkValidator = require('./wikiLinkValidator');
const InputValidator = require('./inputValidator');
const ProjectParser = require('./projectParser');

class TimeTracker {
  constructor(options = {}) {
    this.validator = new InputValidator();
    this.projectParser = new ProjectParser();
    this.wikiValidator = new WikiLinkValidator();
    this.silent = options.silent || false; // For testing
  }

  /**
   * Start a new time entry with [ACTIVE] marker
   * @param {Object} options - Entry options
   * @param {string} options.task - Task description
   * @param {string} [options.project] - Project name
   * @param {string} [options.tags] - Comma-separated tags
   * @param {string} [options.notes] - Additional notes
   * @param {string} [options.start] - Custom start time (HH:MM)
   * @param {string} [options.date] - Custom date (YYYY-MM-DD)
   * @returns {Promise<Object>} Result object
   */
  async startEntry(options) {
    try {
      // Validate required fields
      if (!options.task || options.task.trim() === '') {
        throw new Error('Task description is required');
      }

      // Determine date and validate
      const date = options.date || new Date().toISOString().split('T')[0];
      const dateValidation = this.validator.validateDate(date);
      if (!dateValidation.isValid) {
        throw new Error(`Invalid date: ${dateValidation.message}`);
      }

      // Determine start time and validate
      const startTime = options.start || new Date().toTimeString().slice(0, 5);
      const timeValidation = this.validator.validateTime(
        startTime,
        'start time'
      );
      if (!timeValidation.isValid) {
        throw new Error(`Invalid start time: ${timeValidation.message}`);
      }

      // Get fiscal year and file path
      const fiscalYear = this.getFiscalYear(date);
      const filePath = this.getTestFilePath
        ? this.getTestFilePath(fiscalYear)
        : path.join('time-logs', `time-log-${fiscalYear}.md`);

      // Check for existing active entry
      const hasActiveEntry = await this.hasActiveEntry(filePath);
      if (hasActiveEntry) {
        throw new Error(
          'An active entry already exists. Please finish the current entry before starting a new one.'
        );
      }

      // Create project file if it doesn't exist
      if (options.project) {
        const exactFileName = `${options.project}.md`;
        const exactPath = path.join('projects', exactFileName);
        const normalizedFileName = `${options.project.toLowerCase().replace(/\s+/g, '-')}.md`;
        const normalizedPath = path.join('projects', normalizedFileName);

        const projectExists =
          fsSync.existsSync(exactPath) || fsSync.existsSync(normalizedPath);

        if (!projectExists) {
          try {
            await this.wikiValidator.createProjectForWikiLink(options.project);
            if (!this.silent) {
              console.log(
                chalk.green(`✓ Created project file: ${options.project}.md`)
              );
            }
          } catch (error) {
            if (!this.silent) {
              console.log(
                chalk.yellow(
                  `⚠️  Could not create project file: ${error.message}`
                )
              );
              console.log(
                chalk.gray(
                  "   Project will still be saved but won't have a project file"
                )
              );
            }
          }
        }
      }

      // Create the entry
      const entry = this.formatActiveEntry(date, startTime, options);
      await this.appendEntryToFile(filePath, entry, date);

      return {
        success: true,
        message: `Started tracking: ${options.task}`,
        entry: entry.trim(),
        filePath,
      };
    } catch (error) {
      if (!this.silent) {
        console.error(chalk.red('Error starting entry:'), error.message);
      }
      throw error;
    }
  }

  /**
   * Finish the current active entry
   * @param {Object} options - Finish options
   * @param {string} [options.end] - Custom end time (HH:MM)
   * @param {string} [options.notes] - Additional notes to append
   * @returns {Promise<Object>} Result object
   */
  async finishEntry(options = {}) {
    try {
      // Find the active entry
      const activeEntryInfo = await this.findActiveEntry();
      if (!activeEntryInfo) {
        throw new Error(
          'No active entry found. Use "start" command to begin tracking time.'
        );
      }

      // Determine end time and validate
      const endTime = options.end || new Date().toTimeString().slice(0, 5);
      const timeValidation = this.validator.validateTime(endTime, 'end time');
      if (!timeValidation.isValid) {
        throw new Error(`Invalid end time: ${timeValidation.message}`);
      }

      // Validate end time is after start time
      const { startTime } = activeEntryInfo;
      if (this.compareTime(endTime, startTime) <= 0) {
        throw new Error(
          `End time (${endTime}) must be after start time (${startTime})`
        );
      }

      // Update the file
      const updatedEntry = await this.updateActiveEntry(
        activeEntryInfo,
        endTime,
        options.notes
      );

      return {
        success: true,
        message: `Finished tracking: ${activeEntryInfo.task}`,
        entry: updatedEntry.trim(),
        duration: this.calculateDuration(startTime, endTime),
        filePath: activeEntryInfo.filePath,
      };
    } catch (error) {
      if (!this.silent) {
        console.error(chalk.red('Error finishing entry:'), error.message);
      }
      throw error;
    }
  }

  /**
   * Check if there's an active entry in the specified file
   * @param {string} filePath - Path to time log file
   * @returns {Promise<boolean>} True if active entry exists
   */
  async hasActiveEntry(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content.includes('[ACTIVE]');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // File doesn't exist, no active entry
      }
      throw error;
    }
  }

  /**
   * Find the current active entry across all time log files
   * @returns {Promise<Object|null>} Active entry info or null
   */
  async findActiveEntry() {
    try {
      const timeLogsDir = this.getTimeLogsDir
        ? this.getTimeLogsDir()
        : 'time-logs';
      const files = await fs.readdir(timeLogsDir);

      for (const file of files) {
        if (file.endsWith('.md') && file.startsWith('time-log-')) {
          const filePath = path.join(timeLogsDir, file);
          const content = await fs.readFile(filePath, 'utf8');

          const activeMatch = content.match(
            /^- \*\*(\d{2}:\d{2})-\[ACTIVE\]\*\*:\s*(.+)$/m
          );
          if (activeMatch) {
            const [fullMatch, startTime, taskLine] = activeMatch;

            // Find the full multi-line entry including notes
            const lines = content.split('\n');
            const activeLineIndex = lines.findIndex(
              (line) => line === fullMatch
            );
            const fullEntryLines = [fullMatch];

            // Check for notes on following lines
            if (activeLineIndex !== -1) {
              for (let i = activeLineIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '') continue; // Skip empty lines
                if (line.startsWith('  - Notes:')) {
                  fullEntryLines.push(line);
                } else if (
                  line.startsWith('- **') ||
                  line.startsWith('###') ||
                  line.startsWith('##')
                ) {
                  break; // Hit another entry or section header
                } else if (line.startsWith('  ')) {
                  fullEntryLines.push(line); // Other indented content
                } else {
                  break; // Hit non-indented content
                }
              }
            }

            const fullEntryContent = fullEntryLines.join('\n');

            // Parse the task line to extract components (notes will be null since we handle them separately)
            const parsed = this.parseTaskLine(taskLine);

            // Extract existing notes from the full entry
            let existingNotes = null;
            const notesLines = fullEntryLines.filter((line) =>
              line.startsWith('  - Notes:')
            );
            if (notesLines.length > 0) {
              existingNotes = notesLines
                .map((line) => line.replace(/^\s*- Notes:\s*/, ''))
                .join(' ');
            }

            return {
              filePath,
              fullMatch: fullEntryContent,
              startTime,
              task: parsed.task,
              project: parsed.project,
              tags: parsed.tags,
              notes: existingNotes,
              lineContent: fullEntryContent,
            };
          }
        }
      }

      return null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // Directory doesn't exist
      }
      throw error;
    }
  }

  /**
   * Update the active entry to completed status
   * @param {Object} activeEntryInfo - Active entry information
   * @param {string} endTime - End time
   * @param {string} [notes] - Additional notes
   * @returns {Promise<string>} Updated entry line
   */
  async updateActiveEntry(activeEntryInfo, endTime, notes) {
    const content = await fs.readFile(activeEntryInfo.filePath, 'utf8');

    // Build the completed entry
    let updatedTaskLine = activeEntryInfo.task;
    if (activeEntryInfo.project) {
      updatedTaskLine += ` [[${activeEntryInfo.project}]]`;
    }
    if (activeEntryInfo.tags && activeEntryInfo.tags.length > 0) {
      updatedTaskLine += ` [${activeEntryInfo.tags.join(', ')}]`;
    }

    const completedEntry = `- **${activeEntryInfo.startTime}-${endTime}**: ${updatedTaskLine}`;

    // Add existing notes and new notes on separate line
    let notesLine = '';
    const allNotes = [];
    if (activeEntryInfo.notes) {
      allNotes.push(activeEntryInfo.notes);
    }
    if (notes && notes.trim()) {
      allNotes.push(notes.trim());
    }
    if (allNotes.length > 0) {
      notesLine = `\n  - Notes: ${allNotes.join(' ')}`;
    }

    const fullCompletedEntry = completedEntry + notesLine;

    // Replace the active entry with completed entry
    const updatedContent = content.replace(
      activeEntryInfo.lineContent,
      fullCompletedEntry
    );

    await fs.writeFile(activeEntryInfo.filePath, updatedContent, 'utf8');

    return fullCompletedEntry;
  }

  /**
   * Parse a task line to extract components
   * @param {string} taskLine - Task line content
   * @returns {Object} Parsed components
   */
  parseTaskLine(taskLine) {
    let task = taskLine;
    let project = null;
    let tags = [];
    let notes = null;

    // Extract project [[Project Name]]
    const projectMatch = task.match(/\[\[([^\]]+)\]\]/);
    if (projectMatch) {
      project = projectMatch[1];
      task = task.replace(projectMatch[0], '').trim();
    }

    // Extract tags [tag1, tag2]
    const tagsMatch = task.match(/\[([^\]]+)\]/);
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map((tag) => tag.trim());
      task = task.replace(tagsMatch[0], '').trim();
    }

    // Extract notes (everything after " - ")
    const notesMatch = task.match(/\s*-\s*(.+)$/);
    if (notesMatch) {
      notes = notesMatch[1];
      task = task.replace(notesMatch[0], '').trim();
    }

    return { task, project, tags, notes };
  }

  /**
   * Format an active entry line
   * @param {string} date - Entry date
   * @param {string} startTime - Start time
   * @param {Object} options - Entry options
   * @returns {string} Formatted entry
   */
  formatActiveEntry(date, startTime, options) {
    let entry = `- **${startTime}-[ACTIVE]**: ${options.task}`;

    if (options.project) {
      entry += ` [[${options.project}]]`;
    }

    if (options.tags) {
      const tagList = options.tags.split(',').map((tag) => tag.trim());
      entry += ` [${tagList.join(', ')}]`;
    }

    if (options.notes && options.notes.trim()) {
      entry += `\n  - Notes: ${options.notes.trim()}`;
    }

    return `${entry}\n`;
  }

  /**
   * Append entry to file, creating file and date section if needed
   * @param {string} filePath - File path
   * @param {string} entry - Entry content
   * @param {string} date - Entry date
   */
  async appendEntryToFile(filePath, entry, date) {
    let content = '';

    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, create with header
        const fiscalYear = this.getFiscalYear(date);
        content = `# Time Log ${fiscalYear}\n\n`;
      } else {
        throw error;
      }
    }

    // Check if date section exists
    const dateHeader = `### ${date}`;
    if (!content.includes(dateHeader)) {
      // Add date section
      const monthYear = new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      const monthHeader = `## ${monthYear}`;

      if (!content.includes(monthHeader)) {
        content += `\n${monthHeader}\n\n`;
      }

      content += `${dateHeader}\n`;
    }

    // Find the right place to insert the entry chronologically
    const lines = content.split('\n');
    const dateHeaderIndex = lines.findIndex((line) => line === dateHeader);

    if (dateHeaderIndex !== -1) {
      // Extract start time from the new entry
      const newEntryTime = this.extractStartTime(entry);

      // Find chronological insertion point
      let insertIndex = dateHeaderIndex + 1;

      for (let i = dateHeaderIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        // Stop if we hit another date header or month header
        if (line.startsWith('###') || line.startsWith('##')) {
          break;
        }

        // Skip empty lines and notes
        if (!line.startsWith('- **')) {
          continue;
        }

        // Extract time from existing entry
        const existingTime = this.extractStartTime(line);

        if (
          existingTime &&
          newEntryTime &&
          this.compareTime(newEntryTime, existingTime) <= 0
        ) {
          insertIndex = i;
          break;
        }

        insertIndex = i + 1;
      }

      lines.splice(insertIndex, 0, entry.trim());
      content = lines.join('\n');
    } else {
      // Fallback: append to end
      content += entry;
    }

    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * Extract start time from a time entry line
   * @param {string} line - Entry line (e.g., "- **09:00-10:30**: Task...")
   * @returns {string|null} Start time (HH:MM) or null if not found
   */
  extractStartTime(line) {
    const timeMatch = line.match(/- \*\*(\d{2}:\d{2})-/);
    return timeMatch ? timeMatch[1] : null;
  }

  /**
   * Compare two time strings
   * @param {string} time1 - First time (HH:MM)
   * @param {string} time2 - Second time (HH:MM)
   * @returns {number} -1 if time1 < time2, 0 if equal, 1 if time1 > time2
   */
  compareTime(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    const minutes1 = h1 * 60 + m1;
    const minutes2 = h2 * 60 + m2;

    if (minutes1 < minutes2) return -1;
    if (minutes1 > minutes2) return 1;
    return 0;
  }

  /**
   * Get fiscal year for a given date
   * @param {string} date - Date string (YYYY-MM-DD)
   * @returns {string} Fiscal year (e.g., "2025-2026")
   */
  getFiscalYear(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // JavaScript months are 0-indexed

    if (month >= 7) {
      // July through December
      return `${year}-${year + 1}`;
    } // January through June
    return `${year - 1}-${year}`;
  }

  /**
   * Calculate duration between two times
   * @param {string} startTime - Start time (HH:MM)
   * @param {string} endTime - End time (HH:MM)
   * @returns {string} Duration in hours and minutes
   */
  calculateDuration(startTime, endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const diffMinutes = endMinutes - startMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 0) {
      return `${minutes} minutes`;
    }
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
  }
}

module.exports = TimeTracker;
