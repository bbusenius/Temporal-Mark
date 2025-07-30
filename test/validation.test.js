/**
 * @fileoverview Validation system tests
 * Tests the critical validation functionality without external dependencies
 */

const InputValidator = require('../scripts/inputValidator');

// Mock external dependencies that require filesystem access
jest.mock('../scripts/errorLogger', () => ({
  logActivity: jest.fn(),
  logError: jest.fn(),
  logValidationError: jest.fn(),
}));

jest.mock('../scripts/tagStandardizer', () =>
  jest.fn().mockImplementation(() => ({
    validateTags: jest.fn().mockReturnValue({
      isValid: true,
      valid: ['test-tag'],
      invalid: [],
      normalized: ['test-tag'],
    }),
  }))
);

jest.mock('../scripts/wikiLinkValidator', () =>
  jest.fn().mockImplementation(() => ({
    extractWikiLinks: jest.fn().mockReturnValue([]),
    loadProjectCache: jest.fn(),
    projectExists: jest.fn().mockReturnValue(true),
  }))
);

describe('Validation System', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('validateDate', () => {
    test('should validate correct dates', () => {
      const result = validator.validateDate('2025-07-29');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid date formats', () => {
      const result = validator.validateDate('07/29/2025');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('format');
    });

    test('should warn about old dates', () => {
      const result = validator.validateDate('2020-01-01');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('old');
    });
  });

  describe('validateTime', () => {
    test('should validate correct time formats', () => {
      const result = validator.validateTime('14:30');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid time formats', () => {
      const result = validator.validateTime('25:00');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('format');
    });

    test('should warn about unusual hours', () => {
      const result = validator.validateTime('03:00');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('unusual');
    });
  });

  describe('validateTimeRange', () => {
    test('should validate correct time ranges', () => {
      const result = validator.validateTimeRange('09:00', '17:00');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject when end time is before start time', () => {
      const result = validator.validateTimeRange('17:00', '09:00');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('logical');
    });

    test('should warn about very short durations', () => {
      const result = validator.validateTimeRange('09:00', '09:10');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('short');
    });

    test('should warn about very long durations', () => {
      const result = validator.validateTimeRange('08:00', '20:00');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('long');
    });
  });

  describe('validateTask', () => {
    test('should validate normal task descriptions', () => {
      const result = validator.validateTask('Working on project documentation');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject tasks that are too long', () => {
      const longTask = 'a'.repeat(501);
      const result = validator.validateTask(longTask);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('length');
    });

    test('should warn about very short tasks', () => {
      const result = validator.validateTask('Work');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('short');
    });
  });

  describe('validateFiscalYear', () => {
    test('should validate correct fiscal year format', () => {
      const result = validator.validateFiscalYear('2025-2026');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid format', () => {
      const result = validator.validateFiscalYear('2025-26');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('format');
    });

    test('should reject non-consecutive years', () => {
      const result = validator.validateFiscalYear('2025-2027');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('logical');
    });
  });

  describe('validateTimeOverlap', () => {
    test('should detect overlapping entries', () => {
      const existingEntries = [
        {
          date: '2025-07-29',
          startTime: '09:00',
          endTime: '10:00',
          task: 'Existing task',
        },
      ];

      const result = validator.validateTimeOverlap(
        '2025-07-29',
        '09:30',
        '10:30',
        existingEntries
      );
      expect(result.isValid).toBe(false);
      expect(result.errors[0].type).toBe('overlap');
    });

    test('should allow non-overlapping entries', () => {
      const existingEntries = [
        {
          date: '2025-07-29',
          startTime: '09:00',
          endTime: '10:00',
          task: 'Existing task',
        },
      ];

      const result = validator.validateTimeOverlap(
        '2025-07-29',
        '10:00',
        '11:00',
        existingEntries
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about adjacent entries', () => {
      const existingEntries = [
        {
          date: '2025-07-29',
          startTime: '09:00',
          endTime: '10:00',
          task: 'Existing task',
        },
      ];

      const result = validator.validateTimeOverlap(
        '2025-07-29',
        '10:05',
        '11:00',
        existingEntries
      );
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('adjacent');
    });
  });

  describe('Utility Functions', () => {
    test('timeToMinutes should convert correctly', () => {
      expect(validator.timeToMinutes('00:00')).toBe(0);
      expect(validator.timeToMinutes('08:30')).toBe(510);
      expect(validator.timeToMinutes('12:00')).toBe(720);
      expect(validator.timeToMinutes('23:59')).toBe(1439);
    });

    test('capitalizeField should format field names', () => {
      expect(validator.capitalizeField('date')).toBe('Date');
      expect(validator.capitalizeField('startTime')).toBe('Start Time');
      expect(validator.capitalizeField('fiscalYear')).toBe('Fiscal Year');
    });
  });

  describe('Result Formatting', () => {
    test('should format results with errors', () => {
      const results = {
        errors: [{ message: 'Test error', suggestion: 'Fix this' }],
        warnings: [],
      };

      const formatted = validator.formatValidationResults(results);
      expect(formatted).toContain('❌ Validation Errors:');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('💡 Fix this');
    });

    test('should format results with warnings', () => {
      const results = {
        errors: [],
        warnings: [{ message: 'Test warning', suggestion: 'Consider this' }],
      };

      const formatted = validator.formatValidationResults(results);
      expect(formatted).toContain('⚠️  Validation Warnings:');
      expect(formatted).toContain('Test warning');
      expect(formatted).toContain('💡 Consider this');
    });

    test('should show success message when no issues', () => {
      const results = {
        errors: [],
        warnings: [],
      };

      const formatted = validator.formatValidationResults(results);
      expect(formatted).toContain('✅ All validation checks passed');
    });
  });
});
