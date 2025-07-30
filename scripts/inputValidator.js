/**
 * @fileoverview Comprehensive input validation system for all data entry
 * Validates dates, times, field lengths, logical constraints, and data integrity
 * Provides detailed error messages and suggestions for users.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const errorLogger = require('./errorLogger');
const TagStandardizer = require('./tagStandardizer');
const WikiLinkValidator = require('./wikiLinkValidator');

/**
 * Provides comprehensive validation for all user inputs and data entry
 * Validates formats, ranges, logical constraints, and provides helpful error messages
 *
 * @class InputValidator
 */
class InputValidator {
  /**
   * Initialize the InputValidator with validation patterns and error message templates
   * @constructor
   */
  constructor() {
    this.tagStandardizer = new TagStandardizer();
    this.wikiValidator = new WikiLinkValidator();

    // Validation patterns
    this.patterns = {
      date: /^\d{4}-\d{2}-\d{2}$/,
      time: /^([01]?\d|2[0-3]):([0-5]\d)$/,
      fiscalYear: /^\d{4}-\d{4}$/,
      projectName: /^[a-zA-Z0-9\s\-_.]{1,100}$/,
      taskDescription: /^.{1,500}$/,
      notes: /^.{0,1000}$/,
    };

    // Error message templates
    this.errorMessages = {
      required: (field) => `${this.capitalizeField(field)} is required`,
      format: (field, expected) =>
        `${this.capitalizeField(field)} must be in ${expected} format`,
      length: (field, min, max) =>
        `${this.capitalizeField(field)} must be between ${min} and ${max} characters`,
      range: (field, min, max) =>
        `${this.capitalizeField(field)} must be between ${min} and ${max}`,
      invalid: (field, reason) =>
        `${this.capitalizeField(field)} is invalid: ${reason}`,
      overlap: (startTime, endTime, existingStart, existingEnd, task) =>
        `Time overlap: ${startTime}-${endTime} conflicts with existing entry ${existingStart}-${existingEnd} (${task})`,
      future: (field) =>
        `${this.capitalizeField(field)} cannot be in the future`,
      logical: (message) => `Logical error: ${message}`,
    };
  }

  /**
   * Validate a complete time entry
   */
  async validateTimeEntry(entry, existingEntries = []) {
    const errors = [];
    const warnings = [];

    // Required field validation
    const requiredFields = ['date', 'startTime', 'endTime', 'task', 'project'];
    for (const field of requiredFields) {
      if (
        !entry[field] ||
        (typeof entry[field] === 'string' && entry[field].trim() === '')
      ) {
        errors.push({
          field,
          type: 'required',
          message: this.errorMessages.required(field),
          severity: 'error',
        });
      }
    }

    // If required fields are missing, return early
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Date validation
    const dateValidation = this.validateDate(entry.date);
    if (!dateValidation.isValid) {
      errors.push(...dateValidation.errors);
    }
    warnings.push(...dateValidation.warnings);

    // Time validation
    const startTimeValidation = this.validateTime(entry.startTime, 'startTime');
    if (!startTimeValidation.isValid) {
      errors.push(...startTimeValidation.errors);
    }

    const endTimeValidation = this.validateTime(entry.endTime, 'endTime');
    if (!endTimeValidation.isValid) {
      errors.push(...endTimeValidation.errors);
    }

    // Time range validation (only if both times are valid)
    if (startTimeValidation.isValid && endTimeValidation.isValid) {
      const timeRangeValidation = this.validateTimeRange(
        entry.startTime,
        entry.endTime
      );
      if (!timeRangeValidation.isValid) {
        errors.push(...timeRangeValidation.errors);
      }
      warnings.push(...timeRangeValidation.warnings);
    }

    // Task validation
    const taskValidation = this.validateTask(entry.task);
    if (!taskValidation.isValid) {
      errors.push(...taskValidation.errors);
    }
    warnings.push(...taskValidation.warnings);

    // Project validation
    const projectValidation = await this.validateProject(entry.project);
    if (!projectValidation.isValid) {
      errors.push(...projectValidation.errors);
    }
    warnings.push(...projectValidation.warnings);

    // Tags validation
    if (entry.tags) {
      const tagsValidation = this.validateTags(entry.tags);
      if (!tagsValidation.isValid) {
        errors.push(...tagsValidation.errors);
      }
      warnings.push(...tagsValidation.warnings);
    }

    // Notes validation
    if (entry.notes) {
      const notesValidation = this.validateNotes(entry.notes);
      if (!notesValidation.isValid) {
        errors.push(...notesValidation.errors);
      }
      warnings.push(...notesValidation.warnings);
    }

    // Time overlap validation
    if (existingEntries.length > 0 && errors.length === 0) {
      const overlapValidation = this.validateTimeOverlap(
        entry.date,
        entry.startTime,
        entry.endTime,
        existingEntries
      );
      if (!overlapValidation.isValid) {
        errors.push(...overlapValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalIssues: errors.length + warnings.length,
        errorCount: errors.length,
        warningCount: warnings.length,
      },
    };
  }

  /**
   * Validate date field
   */
  validateDate(date) {
    const errors = [];
    const warnings = [];

    if (!this.patterns.date.test(date)) {
      errors.push({
        field: 'date',
        type: 'format',
        message: this.errorMessages.format('date', 'YYYY-MM-DD'),
        severity: 'error',
        value: date,
      });
      return { isValid: false, errors, warnings };
    }

    // Parse and validate actual date
    const dateObj = new Date(`${date}T00:00:00`); // Add time to avoid timezone issues
    const today = new Date();

    // Check if the date is valid (not NaN)
    if (Number.isNaN(dateObj.getTime())) {
      errors.push({
        field: 'date',
        type: 'invalid',
        message: this.errorMessages.invalid(
          'date',
          'not a valid calendar date'
        ),
        severity: 'error',
        value: date,
      });
      return { isValid: false, errors, warnings };
    }

    // Validate that the formatted date matches the input (catches invalid dates like 2025-02-30)
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const reconstructedDate = `${year}-${month}-${day}`;

    if (reconstructedDate !== date) {
      errors.push({
        field: 'date',
        type: 'invalid',
        message: this.errorMessages.invalid(
          'date',
          'not a valid calendar date'
        ),
        severity: 'error',
        value: date,
      });
      return { isValid: false, errors, warnings };
    }

    // Warn about future dates
    if (dateObj > today) {
      warnings.push({
        field: 'date',
        type: 'future',
        message: this.errorMessages.future('date'),
        severity: 'warning',
        value: date,
        suggestion: 'Consider if this entry should be for a future date',
      });
    }

    // Warn about very old dates (more than 1 year ago)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (dateObj < oneYearAgo) {
      warnings.push({
        field: 'date',
        type: 'old',
        message: `Date is more than one year old`,
        severity: 'warning',
        value: date,
        suggestion: 'Verify this is the correct date',
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate time field
   */
  validateTime(time, fieldName = 'time') {
    const errors = [];
    const warnings = [];

    if (!this.patterns.time.test(time)) {
      errors.push({
        field: fieldName,
        type: 'format',
        message: this.errorMessages.format(fieldName, 'HH:MM (24-hour)'),
        severity: 'error',
        value: time,
      });
      return { isValid: false, errors, warnings };
    }

    const [hours, minutes] = time.split(':').map(Number);

    // Additional validation
    if (hours > 23 || minutes > 59) {
      errors.push({
        field: fieldName,
        type: 'invalid',
        message: this.errorMessages.invalid(
          fieldName,
          'hours must be 0-23, minutes must be 0-59'
        ),
        severity: 'error',
        value: time,
      });
      return { isValid: false, errors, warnings };
    }

    // Warn about unusual hours
    if (hours < 6 || hours > 22) {
      warnings.push({
        field: fieldName,
        type: 'unusual',
        message: `${this.capitalizeField(fieldName)} is outside typical work hours (06:00-22:00)`,
        severity: 'warning',
        value: time,
        suggestion: 'Verify this is the correct time',
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate time range
   */
  validateTimeRange(startTime, endTime) {
    const errors = [];
    const warnings = [];

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const durationMinutes = endMinutes - startMinutes;

    if (durationMinutes <= 0) {
      errors.push({
        field: 'timeRange',
        type: 'logical',
        message: this.errorMessages.logical(
          'end time must be after start time'
        ),
        severity: 'error',
        value: `${startTime}-${endTime}`,
        suggestion: 'Check that start and end times are correct',
      });
      return { isValid: false, errors, warnings };
    }

    // Warn about very short durations (less than 15 minutes)
    if (durationMinutes < 15) {
      warnings.push({
        field: 'timeRange',
        type: 'short',
        message: `Duration is very short (${durationMinutes} minutes)`,
        severity: 'warning',
        value: `${startTime}-${endTime}`,
        suggestion: 'Consider if this duration is accurate',
      });
    }

    // Warn about very long durations (more than 8 hours)
    if (durationMinutes > 480) {
      warnings.push({
        field: 'timeRange',
        type: 'long',
        message: `Duration is very long (${(durationMinutes / 60).toFixed(1)} hours)`,
        severity: 'warning',
        value: `${startTime}-${endTime}`,
        suggestion: 'Consider breaking this into multiple entries',
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate task description
   */
  validateTask(task) {
    const errors = [];
    const warnings = [];

    if (!this.patterns.taskDescription.test(task)) {
      if (task.length > 500) {
        errors.push({
          field: 'task',
          type: 'length',
          message: this.errorMessages.length('task', 1, 500),
          severity: 'error',
          value: task,
          actualLength: task.length,
        });
      } else {
        errors.push({
          field: 'task',
          type: 'invalid',
          message: this.errorMessages.invalid(
            'task',
            'contains invalid characters'
          ),
          severity: 'error',
          value: task,
        });
      }
      return { isValid: false, errors, warnings };
    }

    // Warn about very short descriptions
    if (task.length < 5) {
      warnings.push({
        field: 'task',
        type: 'short',
        message: 'Task description is very short',
        severity: 'warning',
        value: task,
        suggestion: 'Consider adding more detail to help with future reference',
      });
    }

    // Check for wiki-links in task
    const wikiLinks = this.wikiValidator.extractWikiLinks(task);
    if (wikiLinks.length > 0) {
      warnings.push({
        field: 'task',
        type: 'wikiLinks',
        message: `Contains ${wikiLinks.length} wiki-link(s)`,
        severity: 'info',
        value: task,
        details: wikiLinks.map((link) => link.linkText),
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate project name
   */
  async validateProject(project) {
    const errors = [];
    const warnings = [];

    if (!this.patterns.projectName.test(project)) {
      if (project.length > 100) {
        errors.push({
          field: 'project',
          type: 'length',
          message: this.errorMessages.length('project', 1, 100),
          severity: 'error',
          value: project,
          actualLength: project.length,
        });
      } else {
        errors.push({
          field: 'project',
          type: 'invalid',
          message: this.errorMessages.invalid(
            'project',
            'contains invalid characters'
          ),
          severity: 'error',
          value: project,
        });
      }
      return { isValid: false, errors, warnings };
    }

    // Check if project exists
    await this.wikiValidator.loadProjectCache();
    if (!this.wikiValidator.projectExists(project)) {
      warnings.push({
        field: 'project',
        type: 'notFound',
        message: 'Project file does not exist',
        severity: 'warning',
        value: project,
        suggestion: 'Project file will be created automatically',
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate tags array
   */
  validateTags(tags) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(tags)) {
      errors.push({
        field: 'tags',
        type: 'format',
        message: this.errorMessages.invalid('tags', 'must be an array'),
        severity: 'error',
        value: tags,
      });
      return { isValid: false, errors, warnings };
    }

    if (tags.length > 10) {
      warnings.push({
        field: 'tags',
        type: 'many',
        message: `Large number of tags (${tags.length})`,
        severity: 'warning',
        value: tags,
        suggestion: 'Consider using fewer, more specific tags',
      });
    }

    // Validate individual tags
    const tagValidation = this.tagStandardizer.validateTags(tags);
    if (!tagValidation.isValid) {
      tagValidation.invalid.forEach((invalid) => {
        warnings.push({
          field: 'tags',
          type: 'invalid',
          message: `Tag "${invalid.original}" will be normalized to "${invalid.normalized}"`,
          severity: 'warning',
          value: invalid.original,
          normalizedValue: invalid.normalized,
          reason: invalid.reason,
        });
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate notes field
   */
  validateNotes(notes) {
    const errors = [];
    const warnings = [];

    if (!this.patterns.notes.test(notes)) {
      errors.push({
        field: 'notes',
        type: 'length',
        message: this.errorMessages.length('notes', 0, 1000),
        severity: 'error',
        value: notes,
        actualLength: notes.length,
      });
      return { isValid: false, errors, warnings };
    }

    // Check for wiki-links in notes
    const wikiLinks = this.wikiValidator.extractWikiLinks(notes);
    if (wikiLinks.length > 0) {
      warnings.push({
        field: 'notes',
        type: 'wikiLinks',
        message: `Contains ${wikiLinks.length} wiki-link(s)`,
        severity: 'info',
        value: notes,
        details: wikiLinks.map((link) => link.linkText),
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Validate time overlap with existing entries
   */
  validateTimeOverlap(date, startTime, endTime, existingEntries) {
    const errors = [];
    const warnings = [];

    const newStartMinutes = this.timeToMinutes(startTime);
    const newEndMinutes = this.timeToMinutes(endTime);

    const dateEntries = existingEntries.filter((entry) => entry.date === date);

    for (const entry of dateEntries) {
      const existingStartMinutes = this.timeToMinutes(entry.startTime);
      const existingEndMinutes = this.timeToMinutes(entry.endTime);

      // Check for overlap
      if (
        newStartMinutes < existingEndMinutes &&
        newEndMinutes > existingStartMinutes
      ) {
        errors.push({
          field: 'timeRange',
          type: 'overlap',
          message: this.errorMessages.overlap(
            startTime,
            endTime,
            entry.startTime,
            entry.endTime,
            entry.task
          ),
          severity: 'error',
          value: `${startTime}-${endTime}`,
          conflictingEntry: {
            time: `${entry.startTime}-${entry.endTime}`,
            task: entry.task,
            project: entry.project,
          },
        });
      }

      // Check for adjacent entries (might want to merge)
      const timeBetween = Math.min(
        Math.abs(newStartMinutes - existingEndMinutes),
        Math.abs(existingStartMinutes - newEndMinutes)
      );

      if (timeBetween <= 15 && timeBetween > 0) {
        warnings.push({
          field: 'timeRange',
          type: 'adjacent',
          message: `Entry is very close to existing entry (${timeBetween} minutes apart)`,
          severity: 'warning',
          value: `${startTime}-${endTime}`,
          suggestion: 'Consider if these entries should be combined',
          adjacentEntry: {
            time: `${entry.startTime}-${entry.endTime}`,
            task: entry.task,
          },
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate fiscal year format
   */
  validateFiscalYear(fiscalYear) {
    const errors = [];
    const warnings = [];

    if (!this.patterns.fiscalYear.test(fiscalYear)) {
      errors.push({
        field: 'fiscalYear',
        type: 'format',
        message: this.errorMessages.format('fiscal year', 'YYYY-YYYY'),
        severity: 'error',
        value: fiscalYear,
      });
      return { isValid: false, errors, warnings };
    }

    const [startYear, endYear] = fiscalYear.split('-').map(Number);

    if (endYear !== startYear + 1) {
      errors.push({
        field: 'fiscalYear',
        type: 'logical',
        message: this.errorMessages.logical(
          'fiscal year end must be one year after start'
        ),
        severity: 'error',
        value: fiscalYear,
      });
      return { isValid: false, errors, warnings };
    }

    const currentYear = new Date().getFullYear();
    if (startYear > currentYear + 1) {
      warnings.push({
        field: 'fiscalYear',
        type: 'future',
        message: 'Fiscal year is in the future',
        severity: 'warning',
        value: fiscalYear,
      });
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Helper methods
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  capitalizeField(field) {
    return (
      field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')
    );
  }

  /**
   * Format validation results for display
   */
  formatValidationResults(results) {
    const output = [];

    if (results.errors.length > 0) {
      output.push('❌ Validation Errors:');
      results.errors.forEach((error) => {
        output.push(`  • ${error.message}`);
        if (error.suggestion) {
          output.push(`    💡 ${error.suggestion}`);
        }
      });
    }

    if (results.warnings.length > 0) {
      output.push('⚠️  Validation Warnings:');
      results.warnings.forEach((warning) => {
        output.push(`  • ${warning.message}`);
        if (warning.suggestion) {
          output.push(`    💡 ${warning.suggestion}`);
        }
      });
    }

    if (results.errors.length === 0 && results.warnings.length === 0) {
      output.push('✅ All validation checks passed');
    }

    return output.join('\n');
  }

  /**
   * Log validation results
   */
  logValidationResults(results, context = {}) {
    if (results.errors.length > 0) {
      results.errors.forEach((error) => {
        errorLogger.logValidationError(error.field, error.value, error.type, {
          ...context,
          validationError: error,
        });
      });
    }

    if (results.warnings.length > 0) {
      errorLogger.logActivity('VALIDATION_WARNINGS', {
        warningCount: results.warnings.length,
        warnings: results.warnings,
        ...context,
      });
    }
  }
}

module.exports = InputValidator;
