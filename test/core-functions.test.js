/**
 * @fileoverview Core functionality tests for critical system functions
 * This test suite focuses on the most important and stable functions
 */

const TimeDataParser = require('../scripts/computeTimeData');
const TagStandardizer = require('../scripts/tagStandardizer');

describe('Core System Functions', () => {
  describe('TimeDataParser - Core Functions', () => {
    let parser;

    beforeEach(() => {
      parser = new TimeDataParser();
    });

    describe('parseTimeToMinutes', () => {
      test('should convert time strings to minutes correctly', () => {
        expect(parser.parseTimeToMinutes('00:00')).toBe(0);
        expect(parser.parseTimeToMinutes('08:30')).toBe(510);
        expect(parser.parseTimeToMinutes('12:00')).toBe(720);
        expect(parser.parseTimeToMinutes('23:59')).toBe(1439);
      });
    });

    describe('calculateDuration', () => {
      test('should calculate duration for normal time ranges', () => {
        expect(parser.calculateDuration('09:00', '10:30')).toBe(1.5);
        expect(parser.calculateDuration('08:00', '17:00')).toBe(9);
        expect(parser.calculateDuration('13:15', '14:45')).toBe(1.5);
      });

      test('should handle overnight entries', () => {
        expect(parser.calculateDuration('23:00', '01:00')).toBe(2);
        expect(parser.calculateDuration('22:30', '06:30')).toBe(8);
      });
    });

    describe('minutesToTimeString', () => {
      test('should convert minutes back to time format', () => {
        expect(parser.minutesToTimeString(0)).toBe('00:00');
        expect(parser.minutesToTimeString(510)).toBe('08:30');
        expect(parser.minutesToTimeString(720)).toBe('12:00');
        expect(parser.minutesToTimeString(1439)).toBe('23:59');
      });
    });

    describe('getTotalLoggedHours', () => {
      test('should calculate total hours correctly', () => {
        const entries = [
          { durationHours: 2.5 },
          { durationHours: 1.5 },
          { durationHours: 4.0 },
        ];

        expect(parser.getTotalLoggedHours(entries)).toBe(8.0);
      });

      test('should handle empty entries array', () => {
        expect(parser.getTotalLoggedHours([])).toBe(0);
      });
    });

    describe('parseTags', () => {
      test('should parse comma-separated tags correctly', () => {
        expect(parser.parseTags('design, ui, web')).toEqual([
          'design',
          'ui',
          'web',
        ]);
        expect(parser.parseTags('Development,Testing')).toEqual([
          'development',
          'testing',
        ]);
        expect(parser.parseTags('single')).toEqual(['single']);
      });

      test('should handle empty or null tag strings', () => {
        expect(parser.parseTags('')).toEqual([]);
        expect(parser.parseTags(null)).toEqual([]);
        expect(parser.parseTags(undefined)).toEqual([]);
      });
    });
  });

  describe('TagStandardizer - Core Functions', () => {
    let standardizer;

    beforeEach(() => {
      standardizer = new TagStandardizer();
    });

    describe('normalizeTag', () => {
      test('should normalize tags to lowercase with hyphens', () => {
        expect(standardizer.normalizeTag('UI Design')).toBe('ui-design');
        expect(standardizer.normalizeTag('WEB DEVELOPMENT')).toBe(
          'web-development'
        );
        expect(standardizer.normalizeTag('Front-End')).toBe('front-end');
      });

      test('should remove invalid characters', () => {
        expect(standardizer.normalizeTag('UI/UX Design!')).toBe('uiux-design');
        expect(standardizer.normalizeTag('C++ Programming')).toBe(
          'c-programming'
        );
        expect(standardizer.normalizeTag('Node.js Development')).toBe(
          'nodejs-development'
        );
      });

      test('should handle empty or invalid input', () => {
        expect(standardizer.normalizeTag('')).toBe('');
        expect(standardizer.normalizeTag(null)).toBe('');
        expect(standardizer.normalizeTag(undefined)).toBe('');
        expect(standardizer.normalizeTag(123)).toBe('');
      });
    });

    describe('normalizeTags', () => {
      test('should normalize array of tags', () => {
        const tags = ['UI Design', 'WEB Development', 'Testing!'];
        const result = standardizer.normalizeTags(tags);
        expect(result).toEqual(['ui-design', 'web-development', 'testing']);
      });

      test('should remove duplicates', () => {
        const tags = ['UI Design', 'ui-design', 'UI DESIGN'];
        const result = standardizer.normalizeTags(tags);
        expect(result).toEqual(['ui-design']);
      });

      test('should handle non-array input', () => {
        expect(standardizer.normalizeTags('not-array')).toEqual([]);
        expect(standardizer.normalizeTags(null)).toEqual([]);
        expect(standardizer.normalizeTags(undefined)).toEqual([]);
      });
    });

    describe('isValidTag', () => {
      test('should validate correct tags', () => {
        expect(standardizer.isValidTag('ui-design')).toBe(true);
        expect(standardizer.isValidTag('web-development')).toBe(true);
        expect(standardizer.isValidTag('html5')).toBe(true);
        expect(standardizer.isValidTag('testing')).toBe(true);
      });

      test('should reject invalid tags', () => {
        expect(standardizer.isValidTag('UI Design')).toBe(false); // Uppercase and space
        expect(standardizer.isValidTag('web_development')).toBe(false); // Underscore
        expect(standardizer.isValidTag('a')).toBe(false); // Too short
        expect(standardizer.isValidTag('')).toBe(false); // Empty
        expect(standardizer.isValidTag(null)).toBe(false); // Null
      });

      test('should validate tag length requirements', () => {
        expect(standardizer.isValidTag('ab')).toBe(true); // Minimum length
        expect(standardizer.isValidTag('a'.repeat(30))).toBe(true); // Maximum length
        expect(standardizer.isValidTag('a')).toBe(false); // Too short
        expect(standardizer.isValidTag('a'.repeat(31))).toBe(false); // Too long
      });
    });

    describe('getValidationReason', () => {
      test('should provide correct validation reasons', () => {
        expect(standardizer.getValidationReason('')).toBe(
          'Tag is empty after normalization'
        );
        expect(standardizer.getValidationReason('a')).toBe(
          'Tag must be at least 2 characters'
        );
        expect(standardizer.getValidationReason('a'.repeat(31))).toBe(
          'Tag must be no more than 30 characters'
        );
        expect(standardizer.getValidationReason('UI_Design')).toBe(
          'Tag contains invalid characters (only lowercase letters, numbers, and hyphens allowed)'
        );
      });
    });
  });

  describe('Integration Tests', () => {
    test('should work together for a complete time entry processing', () => {
      const parser = new TimeDataParser();
      const standardizer = new TagStandardizer();

      // Simulate processing a time entry
      const rawTags = 'UI Design, Web Development, Testing!';
      const startTime = '09:00';
      const endTime = '10:30';

      // Process tags
      const parsedTags = parser.parseTags(rawTags);
      const normalizedTags = standardizer.normalizeTags(parsedTags);

      // Calculate duration
      const duration = parser.calculateDuration(startTime, endTime);

      expect(normalizedTags).toEqual([
        'ui-design',
        'web-development',
        'testing',
      ]);
      expect(duration).toBe(1.5);

      // Validate all normalized tags
      normalizedTags.forEach((tag) => {
        expect(standardizer.isValidTag(tag)).toBe(true);
      });
    });
  });
});
