/**
 * @fileoverview Tests for TimeDataParser - time calculation and parsing functionality
 */

const TimeDataParser = require('../scripts/computeTimeData');
// const fs = require('fs'); // Unused for now
// const path = require('path'); // Unused for now

describe('TimeDataParser', () => {
  let parser;

  beforeEach(() => {
    parser = new TimeDataParser();
  });

  describe('parseTimeToMinutes', () => {
    test('should convert time string to minutes correctly', () => {
      expect(parser.parseTimeToMinutes('00:00')).toBe(0);
      expect(parser.parseTimeToMinutes('08:30')).toBe(510);
      expect(parser.parseTimeToMinutes('12:00')).toBe(720);
      expect(parser.parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('calculateDuration', () => {
    test('should calculate duration correctly for same day', () => {
      expect(parser.calculateDuration('09:00', '10:30')).toBe(1.5);
      expect(parser.calculateDuration('08:00', '17:00')).toBe(9);
      expect(parser.calculateDuration('13:15', '14:45')).toBe(1.5);
    });

    test('should handle overnight entries', () => {
      expect(parser.calculateDuration('23:00', '01:00')).toBe(2);
      expect(parser.calculateDuration('22:30', '06:30')).toBe(8);
    });

    test('should handle same start and end time', () => {
      expect(parser.calculateDuration('09:00', '09:00')).toBe(0);
    });
  });

  describe('isValidDate', () => {
    test('should validate correct date formats', () => {
      expect(parser.isValidDate('2025-07-29')).toBe(true);
      expect(parser.isValidDate('2024-02-29')).toBe(true); // Leap year
      expect(parser.isValidDate('2023-12-31')).toBe(true);
    });

    test('should reject invalid date formats', () => {
      expect(parser.isValidDate('25-07-29')).toBe(false); // Wrong format
      expect(parser.isValidDate('07/29/2025')).toBe(false); // Wrong format
      expect(parser.isValidDate('invalid-date')).toBe(false); // Invalid format
    });
  });

  describe('isValidTime', () => {
    test('should validate correct time formats', () => {
      expect(parser.isValidTime('00:00')).toBe(true);
      expect(parser.isValidTime('08:30')).toBe(true);
      expect(parser.isValidTime('23:59')).toBe(true);
      expect(parser.isValidTime('9:00')).toBe(true); // Single digit hour
    });

    test('should reject invalid time formats', () => {
      expect(parser.isValidTime('24:00')).toBe(false);
      expect(parser.isValidTime('08:60')).toBe(false);
      expect(parser.isValidTime('08')).toBe(false);
      expect(parser.isValidTime('8:30 AM')).toBe(false);
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

    test('should trim whitespace and convert to lowercase', () => {
      expect(parser.parseTags('  Design  ,  UI  ,  Web  ')).toEqual([
        'design',
        'ui',
        'web',
      ]);
      expect(parser.parseTags('UPPERCASE, MixedCase')).toEqual([
        'uppercase',
        'mixedcase',
      ]);
    });
  });

  describe('minutesToTimeString', () => {
    test('should convert minutes to time string correctly', () => {
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

  describe('groupEntriesByProject', () => {
    test('should group entries by project correctly', () => {
      const entries = [
        { project: 'Project A', task: 'Task 1' },
        { project: 'Project B', task: 'Task 2' },
        { project: 'Project A', task: 'Task 3' },
      ];

      const grouped = parser.groupEntriesByProject(entries);

      expect(Object.keys(grouped)).toEqual(['Project A', 'Project B']);
      expect(grouped['Project A']).toHaveLength(2);
      expect(grouped['Project B']).toHaveLength(1);
    });
  });

  describe('groupEntriesByTag', () => {
    test('should group entries by tags correctly', () => {
      const entries = [
        { tags: ['design', 'ui'], task: 'Task 1' },
        { tags: ['development'], task: 'Task 2' },
        { tags: ['design', 'testing'], task: 'Task 3' },
      ];

      const grouped = parser.groupEntriesByTag(entries);

      expect(Object.keys(grouped).sort()).toEqual([
        'design',
        'development',
        'testing',
        'ui',
      ]);
      expect(grouped.design).toHaveLength(2);
      expect(grouped.development).toHaveLength(1);
    });
  });

  describe('checkForOverlaps', () => {
    test('should detect overlapping time entries', () => {
      const entries = [
        { startTime: '09:00', endTime: '10:30', task: 'Task 1' },
        { startTime: '10:00', endTime: '11:30', task: 'Task 2' },
        { startTime: '12:00', endTime: '13:00', task: 'Task 3' },
      ];

      const overlaps = parser.checkForOverlaps(entries);

      expect(overlaps).toHaveLength(1);
      expect(overlaps[0].entry1.task).toBe('Task 1');
      expect(overlaps[0].entry2.task).toBe('Task 2');
      expect(overlaps[0].overlapMinutes).toBe(30);
    });

    test('should return empty array for non-overlapping entries', () => {
      const entries = [
        { startTime: '09:00', endTime: '10:00', task: 'Task 1' },
        { startTime: '10:00', endTime: '11:00', task: 'Task 2' },
        { startTime: '11:00', endTime: '12:00', task: 'Task 3' },
      ];

      const overlaps = parser.checkForOverlaps(entries);
      expect(overlaps).toHaveLength(0);
    });
  });

  describe('findGapsInDay', () => {
    test('should find gaps between entries', () => {
      const entries = [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:30', endTime: '11:30' },
        { startTime: '13:00', endTime: '14:00' },
      ];

      const gaps = parser.findGapsInDay(entries);

      expect(gaps).toHaveLength(2);
      expect(gaps[0].start).toBe('10:00');
      expect(gaps[0].end).toBe('10:30');
      expect(gaps[0].durationHours).toBe(0.5);
      expect(gaps[1].start).toBe('11:30');
      expect(gaps[1].end).toBe('13:00');
      expect(gaps[1].durationHours).toBe(1.5);
    });

    test('should return empty array for continuous entries', () => {
      const entries = [
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' },
        { startTime: '11:00', endTime: '12:00' },
      ];

      const gaps = parser.findGapsInDay(entries);
      expect(gaps).toHaveLength(0);
    });
  });
});
