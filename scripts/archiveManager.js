/**
 * @fileoverview Archive management system for time log files and backup operations
 * Handles automated archiving based on age criteria, manual archiving by fiscal year,
 * restoration from archive, and cleanup of old backup files.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const errorLogger = require('./errorLogger');

/**
 * Manages archiving operations for time log files and maintains backup integrity
 * Provides automated and manual archiving with configurable retention policies
 *
 * @class ArchiveManager
 */
class ArchiveManager {
  /**
   * Initialize the ArchiveManager with directory paths
   * @constructor
   * @param {string} [rootDir] - Root project directory (default: parent directory)
   */
  constructor(rootDir = path.join(__dirname, '..')) {
    this.rootDir = rootDir;
    this.timeLogsDir = path.join(rootDir, 'time-logs');
    this.archiveDir = path.join(this.timeLogsDir, 'archive');
  }

  /**
   * Archive old time log files based on age criteria
   * Automatically archives files older than the specified number of years
   *
   * @async
   * @param {number} [yearsToKeepActive=2] - Number of years to keep active (archive older files)
   * @returns {Promise<Object>} Archive operation results with counts and file list
   * @throws {Error} When archive operations fail
   */
  async archiveOldTimeLogs(yearsToKeepActive = 2) {
    try {
      errorLogger.logActivity('ARCHIVE_START', { yearsToKeepActive });

      // Ensure archive directory exists
      if (!fs.existsSync(this.archiveDir)) {
        fs.mkdirSync(this.archiveDir, { recursive: true });
      }

      const currentYear = new Date().getFullYear();
      const cutoffYear = currentYear - yearsToKeepActive;

      const timeLogFiles = this.findTimeLogFiles();
      const archivedFiles = [];

      for (const filePath of timeLogFiles) {
        const fileName = path.basename(filePath);
        const fiscalYearMatch = fileName.match(/time-log-(\d{4})-(\d{4})\.md$/);

        if (fiscalYearMatch) {
          const _startYear = parseInt(fiscalYearMatch[1], 10);
          const endYear = parseInt(fiscalYearMatch[2], 10);

          // Archive if both start and end year are before cutoff
          if (endYear < cutoffYear) {
            await this.archiveFile(filePath);
            archivedFiles.push(fileName);
          }
        }
      }

      errorLogger.logActivity('ARCHIVE_COMPLETE', {
        archivedCount: archivedFiles.length,
        archivedFiles,
        cutoffYear,
      });

      return {
        archivedCount: archivedFiles.length,
        archivedFiles,
        message:
          archivedFiles.length > 0
            ? `Archived ${archivedFiles.length} old time log files`
            : 'No files needed archiving',
      };
    } catch (error) {
      errorLogger.logError(error, { operation: 'ARCHIVE_TIME_LOGS' });
      throw error;
    }
  }

  /**
   * Archive a specific time log file by fiscal year
   * Manually archives a particular fiscal year's time log file
   *
   * @async
   * @param {string} fiscalYear - Fiscal year in YYYY-YYYY format
   * @returns {Promise<Object>} Archive result with success status and message
   * @throws {Error} When file not found or archive operation fails
   */
  async archiveSpecificYear(fiscalYear) {
    try {
      const fileName = `time-log-${fiscalYear}.md`;
      const filePath = path.join(this.timeLogsDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Time log file not found: ${fileName}`);
      }

      // Ensure archive directory exists
      if (!fs.existsSync(this.archiveDir)) {
        fs.mkdirSync(this.archiveDir, { recursive: true });
      }

      await this.archiveFile(filePath);

      errorLogger.logActivity('ARCHIVE_SPECIFIC_YEAR', {
        fiscalYear,
        fileName,
      });

      return {
        success: true,
        message: `Successfully archived ${fileName}`,
        archivedFile: fileName,
      };
    } catch (error) {
      errorLogger.logError(error, {
        operation: 'ARCHIVE_SPECIFIC_YEAR',
        fiscalYear,
      });
      throw error;
    }
  }

  /**
   * Move a file to archive directory with backup handling
   * Creates timestamped backups if file already exists in archive
   *
   * @async
   * @param {string} filePath - Full path to file being archived
   * @returns {Promise<void>}
   * @throws {Error} When file operations fail
   */
  async archiveFile(filePath) {
    const fileName = path.basename(filePath);
    const archivePath = path.join(this.archiveDir, fileName);

    // Check if file already exists in archive
    if (fs.existsSync(archivePath)) {
      // Create timestamped backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = fileName.replace('.md', `_backup_${timestamp}.md`);
      const backupPath = path.join(this.archiveDir, backupName);

      fs.renameSync(archivePath, backupPath);
      errorLogger.logActivity('ARCHIVE_BACKUP_CREATED', {
        originalFile: fileName,
        backupFile: backupName,
      });
    }

    // Move file to archive
    fs.renameSync(filePath, archivePath);

    errorLogger.logActivity('FILE_ARCHIVED', {
      from: filePath,
      to: archivePath,
    });
  }

  /**
   * Restore a file from archive back to active directory
   * Moves archived file back to time-logs directory
   *
   * @async
   * @param {string} fileName - Name of file to restore from archive
   * @returns {Promise<Object>} Restore result with success status and message
   * @throws {Error} When file not found in archive or already exists in active directory
   */
  async restoreFromArchive(fileName) {
    try {
      const archivePath = path.join(this.archiveDir, fileName);
      const restorePath = path.join(this.timeLogsDir, fileName);

      if (!fs.existsSync(archivePath)) {
        throw new Error(`Archived file not found: ${fileName}`);
      }

      if (fs.existsSync(restorePath)) {
        throw new Error(`File already exists in active directory: ${fileName}`);
      }

      fs.renameSync(archivePath, restorePath);

      errorLogger.logActivity('FILE_RESTORED', {
        from: archivePath,
        to: restorePath,
      });

      return {
        success: true,
        message: `Successfully restored ${fileName}`,
        restoredFile: fileName,
      };
    } catch (error) {
      errorLogger.logError(error, {
        operation: 'RESTORE_FROM_ARCHIVE',
        fileName,
      });
      throw error;
    }
  }

  /**
   * List all archived files with metadata
   * Returns file information including fiscal year, size, and archive date
   *
   * @returns {Array<Object>} Array of file objects with fileName, fiscalYear, sizeKB, archivedDate
   */
  listArchivedFiles() {
    try {
      if (!fs.existsSync(this.archiveDir)) {
        return [];
      }

      const files = fs
        .readdirSync(this.archiveDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => {
          const filePath = path.join(this.archiveDir, file);
          const stats = fs.statSync(filePath);
          const fiscalYearMatch = file.match(/time-log-(\d{4})-(\d{4})\.md$/);

          return {
            fileName: file,
            fiscalYear: fiscalYearMatch
              ? `${fiscalYearMatch[1]}-${fiscalYearMatch[2]}`
              : 'Unknown',
            sizeKB: Math.round(stats.size / 1024),
            archivedDate: stats.mtime.toISOString().split('T')[0],
          };
        })
        .sort((a, b) => b.fiscalYear.localeCompare(a.fiscalYear));

      return files;
    } catch (error) {
      errorLogger.logError(error, { operation: 'LIST_ARCHIVED_FILES' });
      return [];
    }
  }

  /**
   * Get comprehensive archive statistics
   * Calculates total file count, sizes, and date ranges
   *
   * @returns {Object} Statistics object with file counts, sizes, and oldest/newest files
   */
  getArchiveStats() {
    try {
      const archivedFiles = this.listArchivedFiles();
      const totalSizeKB = archivedFiles.reduce(
        (sum, file) => sum + file.sizeKB,
        0
      );

      return {
        fileCount: archivedFiles.length,
        totalSizeKB,
        totalSizeMB: Math.round((totalSizeKB / 1024) * 100) / 100,
        oldestFile:
          archivedFiles.length > 0
            ? archivedFiles[archivedFiles.length - 1]
            : null,
        newestFile: archivedFiles.length > 0 ? archivedFiles[0] : null,
      };
    } catch (error) {
      errorLogger.logError(error, { operation: 'GET_ARCHIVE_STATS' });
      return {
        fileCount: 0,
        totalSizeKB: 0,
        totalSizeMB: 0,
        oldestFile: null,
        newestFile: null,
      };
    }
  }

  /**
   * Clean up old backup files in archive directory
   * Removes backup files older than specified number of days
   *
   * @param {number} [daysToKeep=90] - Number of days to retain backup files
   * @returns {Object} Cleanup results with count of files removed and message
   */
  cleanupOldBackups(daysToKeep = 90) {
    try {
      if (!fs.existsSync(this.archiveDir)) {
        return { cleanedCount: 0, message: 'Archive directory does not exist' };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const files = fs.readdirSync(this.archiveDir);
      const backupFiles = files.filter((file) => file.includes('_backup_'));
      let cleanedCount = 0;

      backupFiles.forEach((file) => {
        const filePath = path.join(this.archiveDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          cleanedCount++;
          errorLogger.logActivity('BACKUP_FILE_CLEANED', {
            file,
            age: Math.round(
              (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
            ),
          });
        }
      });

      errorLogger.logActivity('BACKUP_CLEANUP_COMPLETE', {
        cleanedCount,
        daysToKeep,
      });

      return {
        cleanedCount,
        message:
          cleanedCount > 0
            ? `Cleaned up ${cleanedCount} old backup files`
            : 'No old backup files to clean',
      };
    } catch (error) {
      errorLogger.logError(error, { operation: 'CLEANUP_OLD_BACKUPS' });
      return { cleanedCount: 0, message: 'Failed to cleanup backup files' };
    }
  }

  /**
   * Find all time log files in the time-logs directory
   * Scans for files matching time-log-*.md pattern
   *
   * @returns {Array<string>} Array of full file paths to time log files
   */
  findTimeLogFiles() {
    try {
      if (!fs.existsSync(this.timeLogsDir)) {
        return [];
      }

      return fs
        .readdirSync(this.timeLogsDir)
        .filter((file) => file.startsWith('time-log-') && file.endsWith('.md'))
        .map((file) => path.join(this.timeLogsDir, file))
        .filter((filePath) => {
          const stats = fs.statSync(filePath);
          return stats.isFile();
        });
    } catch (error) {
      errorLogger.logError(error, { operation: 'FIND_TIME_LOG_FILES' });
      return [];
    }
  }

  /**
   * Check if a fiscal year should be archived based on age criteria
   * Determines if a fiscal year is old enough to be archived
   *
   * @param {string} fiscalYear - Fiscal year in YYYY-YYYY format
   * @param {number} [yearsToKeepActive=2] - Number of years to keep active
   * @returns {boolean} True if fiscal year should be archived
   */
  shouldArchive(fiscalYear, yearsToKeepActive = 2) {
    const currentYear = new Date().getFullYear();
    const cutoffYear = currentYear - yearsToKeepActive;

    const match = fiscalYear.match(/(\d{4})-(\d{4})/);
    if (!match) return false;

    const endYear = parseInt(match[2], 10);
    return endYear < cutoffYear;
  }
}

module.exports = ArchiveManager;
