/**
 * @fileoverview Time data parsing and calculation system
 * Handles parsing of time log markdown files, time calculations, validation,
 * and provides utilities for working with time entries and durations.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
// const path = require('path'); // Unused for now

/**
 * Parses and processes time data from markdown files
 * Provides time calculation utilities, validation, and entry processing
 *
 * @class TimeDataParser
 */
class TimeDataParser {
  /**
   * Initialize the TimeDataParser with regex patterns for parsing
   * @constructor
   */
  constructor() {
    // Updated regex to handle both completed entries and [ACTIVE] entries
    // Also handles entries without projects (optional [[project]])
    this.timeEntryRegex =
      /^- \*\*(\d{2}:\d{2})-(\d{2}:\d{2}|\[ACTIVE\])\*\*: (.+?)(?:\s\[\[(.+?)\]\])?(?:\s\[(.+?)\])?(?:\s-\s(.+?))?$/;
    this.notesRegex = /^ {2}- Notes: (.+)$/;
    this.dateHeaderRegex = /^### (\d{4}-\d{2}-\d{2})$/;
  }

  /**
   * Parse a time string to minutes since midnight
   * Converts HH:MM format to total minutes for calculations
   *
   * @param {string} timeStr - Time string in HH:MM format
   * @returns {number} Minutes since midnight
   */
  parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calculate duration in hours between start and end time
   * Handles overnight entries by adding 24 hours when end time is before start time
   *
   * @param {string} startTime - Start time in HH:MM format
   * @param {string} endTime - End time in HH:MM format
   * @returns {number} Duration in hours (decimal)
   */
  calculateDuration(startTime, endTime) {
    const startMinutes = this.parseTimeToMinutes(startTime);
    let endMinutes = this.parseTimeToMinutes(endTime);

    // Handle overnight entries (rare but possible)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }

    const durationMinutes = endMinutes - startMinutes;
    return durationMinutes / 60; // Convert to hours
  }

  /**
   * Validate date format and ensure it represents a valid calendar date
   * Checks both format (YYYY-MM-DD) and actual date validity
   *
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if date is valid
   */
  isValidDate(dateStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date.toISOString().split('T')[0] === dateStr;
  }

  /**
   * Validate time format in 24-hour HH:MM format
   * Ensures hours are 0-23 and minutes are 0-59
   *
   * @param {string} timeStr - Time string to validate
   * @returns {boolean} True if time format is valid
   */
  isValidTime(timeStr) {
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]?\d)$/;
    return timeRegex.test(timeStr);
  }

  /**
   * Parse tags from a comma-separated tag string
   * Splits, trims, and normalizes tags to lowercase
   *
   * @param {string|null} tagStr - Comma-separated tag string
   * @returns {Array<string>} Array of normalized tag strings
   * @example
   * // Returns: ['design', 'ui', 'web']
   * parseTags('Design, UI, Web')
   */
  parseTags(tagStr) {
    if (!tagStr) return [];
    return tagStr.split(',').map((tag) => tag.trim().toLowerCase());
  }

  /**
   * Parse a single time log markdown file and extract all time entries
   * Processes the entire file structure including dates, entries, and notes
   *
   * @param {string} filePath - Full path to the time log markdown file
   * @returns {Array<Object>} Array of parsed time entry objects
   * @throws {Error} When file not found or parsing fails
   */
  parseTimeLogFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Time log file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const entries = [];
    let currentDate = null;
    let currentEntry = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for date header
      const dateMatch = line.match(this.dateHeaderRegex);
      if (dateMatch) {
        currentDate = dateMatch[1];
        if (!this.isValidDate(currentDate)) {
          throw new Error(
            `Invalid date format: ${currentDate} at line ${i + 1}`
          );
        }
        continue;
      }

      // Check for time entry
      const entryMatch = line.match(this.timeEntryRegex);
      if (entryMatch && currentDate) {
        const [, startTime, endTime, task, project, tagsStr, notesStr] =
          entryMatch;

        // Handle [ACTIVE] entries differently
        if (endTime === '[ACTIVE]') {
          // Skip [ACTIVE] entries in reports but don't throw an error
          console.warn(
            `Warning: Skipping active entry at line ${i + 1}: ${startTime}-${endTime}`
          );
          continue;
        }

        // Validate time formats for completed entries
        if (!this.isValidTime(startTime) || !this.isValidTime(endTime)) {
          throw new Error(
            `Invalid time format at line ${i + 1}: ${startTime}-${endTime}`
          );
        }

        // Calculate duration (only for completed entries)
        const durationHours = this.calculateDuration(startTime, endTime);

        // Parse tags
        const tags = this.parseTags(tagsStr);

        currentEntry = {
          date: currentDate,
          startTime,
          endTime,
          durationHours,
          task: task.trim(),
          project: project ? project.trim() : null,
          tags,
          notes: notesStr ? notesStr.trim() : null,
          lineNumber: i + 1,
        };

        entries.push(currentEntry);
        continue;
      }

      // Check for notes (must follow a time entry)
      const notesMatch = line.match(this.notesRegex);
      if (notesMatch && currentEntry) {
        currentEntry.notes = notesMatch[1].trim();
        continue;
      }
    }

    return entries;
  }

  /**
   * Find gaps between logged time entries within a day
   * Only identifies gaps between consecutive entries, not before/after work periods
   *
   * @param {Array<Object>} entries - Array of time entry objects for a single day
   * @param {string} [workdayStart='08:00'] - Start of workday (currently unused)
   * @param {string} [workdayEnd='17:00'] - End of workday (currently unused)
   * @returns {Array<Object>} Array of gap objects with start, end, and duration
   */
  findGapsInDay(entries, _workdayStart = '08:00', _workdayEnd = '17:00') {
    if (entries.length === 0) {
      return []; // No entries = no gaps to show
    }

    // Sort entries by start time
    const sortedEntries = entries.sort(
      (a, b) =>
        this.parseTimeToMinutes(a.startTime) -
        this.parseTimeToMinutes(b.startTime)
    );

    const gaps = [];

    // Only look for gaps BETWEEN entries, not before first or after last
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const currentEntry = sortedEntries[i];
      const nextEntry = sortedEntries[i + 1];

      const currentEndMinutes = this.parseTimeToMinutes(currentEntry.endTime);
      const nextStartMinutes = this.parseTimeToMinutes(nextEntry.startTime);

      // If there's a gap between the end of current entry and start of next entry
      if (nextStartMinutes > currentEndMinutes) {
        const gapStartTime = currentEntry.endTime;
        const gapEndTime = nextEntry.startTime;

        gaps.push({
          start: gapStartTime,
          end: gapEndTime,
          durationHours: this.calculateDuration(gapStartTime, gapEndTime),
        });
      }
    }

    return gaps;
  }

  /**
   * Convert minutes since midnight back to HH:MM time format
   * Used for displaying calculated times and gaps
   *
   * @param {number} minutes - Minutes since midnight
   * @returns {string} Time string in HH:MM format
   */
  minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate total logged hours for a collection of entries
   * Sums up the duration of all provided time entries
   *
   * @param {Array<Object>} entries - Array of time entry objects
   * @returns {number} Total hours logged (decimal)
   */
  getTotalLoggedHours(entries) {
    return entries.reduce((total, entry) => total + entry.durationHours, 0);
  }

  /**
   * Group time entries by project name
   * Organizes entries into project-based collections for analysis
   *
   * @param {Array<Object>} entries - Array of time entry objects
   * @returns {Object<string, Array>} Object with project names as keys and entry arrays as values
   */
  groupEntriesByProject(entries) {
    const grouped = {};
    entries.forEach((entry) => {
      if (!grouped[entry.project]) {
        grouped[entry.project] = [];
      }
      grouped[entry.project].push(entry);
    });
    return grouped;
  }

  /**
   * Group time entries by tags
   * Creates collections for each tag, with entries potentially appearing in multiple groups
   *
   * @param {Array<Object>} entries - Array of time entry objects
   * @returns {Object<string, Array>} Object with tag names as keys and entry arrays as values
   */
  groupEntriesByTag(entries) {
    const grouped = {};
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(entry);
      });
    });
    return grouped;
  }

  /**
   * Check for time overlaps between entries in a single day
   * Identifies conflicting time periods that need resolution
   *
   * @param {Array<Object>} entries - Array of time entry objects for validation
   * @returns {Array<Object>} Array of overlap objects with conflicting entries and overlap duration
   */
  checkForOverlaps(entries) {
    const overlaps = [];
    const sortedEntries = entries.sort(
      (a, b) =>
        this.parseTimeToMinutes(a.startTime) -
        this.parseTimeToMinutes(b.startTime)
    );

    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const current = sortedEntries[i];
      const next = sortedEntries[i + 1];

      const currentEnd = this.parseTimeToMinutes(current.endTime);
      const nextStart = this.parseTimeToMinutes(next.startTime);

      if (currentEnd > nextStart) {
        overlaps.push({
          entry1: current,
          entry2: next,
          overlapMinutes: currentEnd - nextStart,
        });
      }
    }

    return overlaps;
  }
}

module.exports = TimeDataParser;
