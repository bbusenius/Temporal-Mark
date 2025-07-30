/**
 * @fileoverview Tag standardization and normalization system
 * Enforces consistent tag formatting across all project and time log files
 * Provides bulk standardization, validation, and migration reporting.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const errorLogger = require('./errorLogger');

/**
 * Handles tag standardization and normalization across the entire system
 * Ensures consistent formatting: lowercase, hyphens instead of spaces, alphanumeric only
 *
 * @class TagStandardizer
 */
class TagStandardizer {
  /**
   * Initialize the TagStandardizer with validation patterns and cache
   * @constructor
   */
  constructor() {
    this.validTagRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    this.tagCache = new Set();
  }

  /**
   * Normalize a single tag to standard format (lowercase, hyphen-separated, alphanumeric)
   *
   * @param {string} tag - Tag to normalize
   * @returns {string} Normalized tag following system standards
   * @example
   * // Returns: "ui-design"
   * normalizeTag("UI Design!")
   */
  normalizeTag(tag) {
    if (!tag || typeof tag !== 'string') {
      return '';
    }

    return tag
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9\-]/g, '') // Remove invalid characters
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Normalize an array of tags
   */
  normalizeTags(tags) {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .map((tag) => this.normalizeTag(tag))
      .filter((tag) => tag.length > 0)
      .filter((tag, index, array) => array.indexOf(tag) === index); // Remove duplicates
  }

  /**
   * Validate that a tag meets standards
   */
  isValidTag(tag) {
    if (!tag || typeof tag !== 'string') {
      return false;
    }

    return this.validTagRegex.test(tag) && tag.length >= 2 && tag.length <= 30;
  }

  /**
   * Validate an array of tags
   */
  validateTags(tags) {
    const results = {
      valid: [],
      invalid: [],
      normalized: [],
      isValid: true,
    };

    if (!Array.isArray(tags)) {
      results.isValid = false;
      return results;
    }

    tags.forEach((originalTag) => {
      const normalized = this.normalizeTag(originalTag);

      if (this.isValidTag(normalized)) {
        results.valid.push(originalTag);
        results.normalized.push(normalized);
      } else {
        results.invalid.push({
          original: originalTag,
          normalized,
          reason: this.getValidationReason(normalized),
        });
        results.isValid = false;
      }
    });

    return results;
  }

  /**
   * Get reason why a tag is invalid
   */
  getValidationReason(tag) {
    if (!tag || tag.length === 0) {
      return 'Tag is empty after normalization';
    }
    if (tag.length < 2) {
      return 'Tag must be at least 2 characters';
    }
    if (tag.length > 30) {
      return 'Tag must be no more than 30 characters';
    }
    if (!this.validTagRegex.test(tag)) {
      return 'Tag contains invalid characters (only lowercase letters, numbers, and hyphens allowed)';
    }
    return 'Unknown validation error';
  }

  /**
   * Standardize tags in project files
   */
  async standardizeProjectTags(
    projectsDir = path.join(__dirname, '../projects')
  ) {
    const results = {
      filesProcessed: 0,
      filesChanged: 0,
      tagsStandardized: 0,
      errors: [],
    };

    try {
      if (!fs.existsSync(projectsDir)) {
        errorLogger.logWarning('Projects directory not found', { projectsDir });
        return results;
      }

      const files = fs
        .readdirSync(projectsDir)
        .filter((file) => file.endsWith('.md'))
        .map((file) => path.join(projectsDir, file));

      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const updated = await this.standardizeTagsInContent(
            content,
            filePath
          );

          results.filesProcessed++;

          if (updated.hasChanges) {
            fs.writeFileSync(filePath, updated.content, 'utf8');
            results.filesChanged++;
            results.tagsStandardized += updated.changedTags.length;

            errorLogger.logActivity('TAGS_STANDARDIZED_IN_PROJECT', {
              filePath,
              changedTags: updated.changedTags,
            });
          }
        } catch (error) {
          results.errors.push({
            file: path.basename(filePath),
            error: error.message,
          });
          errorLogger.logError(error, {
            operation: 'STANDARDIZE_PROJECT_TAGS',
            filePath,
          });
        }
      }

      errorLogger.logActivity('PROJECT_TAG_STANDARDIZATION_COMPLETE', results);
      return results;
    } catch (error) {
      errorLogger.logError(error, { operation: 'STANDARDIZE_PROJECT_TAGS' });
      throw error;
    }
  }

  /**
   * Standardize tags in time log files
   */
  async standardizeTimeLogTags(
    timeLogsDir = path.join(__dirname, '../time-logs')
  ) {
    const results = {
      filesProcessed: 0,
      filesChanged: 0,
      tagsStandardized: 0,
      errors: [],
    };

    try {
      if (!fs.existsSync(timeLogsDir)) {
        errorLogger.logWarning('Time logs directory not found', {
          timeLogsDir,
        });
        return results;
      }

      const files = fs
        .readdirSync(timeLogsDir)
        .filter((file) => file.endsWith('.md') && file.startsWith('time-log-'))
        .map((file) => path.join(timeLogsDir, file));

      for (const filePath of files) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const updated = await this.standardizeTagsInTimeLog(
            content,
            filePath
          );

          results.filesProcessed++;

          if (updated.hasChanges) {
            fs.writeFileSync(filePath, updated.content, 'utf8');
            results.filesChanged++;
            results.tagsStandardized += updated.changedTags.length;

            errorLogger.logActivity('TAGS_STANDARDIZED_IN_TIMELOG', {
              filePath,
              changedTags: updated.changedTags,
            });
          }
        } catch (error) {
          results.errors.push({
            file: path.basename(filePath),
            error: error.message,
          });
          errorLogger.logError(error, {
            operation: 'STANDARDIZE_TIMELOG_TAGS',
            filePath,
          });
        }
      }

      errorLogger.logActivity('TIMELOG_TAG_STANDARDIZATION_COMPLETE', results);
      return results;
    } catch (error) {
      errorLogger.logError(error, { operation: 'STANDARDIZE_TIMELOG_TAGS' });
      throw error;
    }
  }

  /**
   * Standardize tags in YAML frontmatter and content
   */
  async standardizeTagsInContent(content, filePath) {
    let updatedContent = content;
    let hasChanges = false;
    const changedTags = [];

    // Handle YAML frontmatter
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];

      // Find tags lines in YAML
      const tagLines = yamlContent
        .split('\n')
        .filter(
          (line) =>
            line.trim().startsWith('tags:') || line.trim().startsWith('- ')
        );

      if (tagLines.length > 0) {
        let updatedYaml = yamlContent;

        // Extract current tags
        const tagsRegex = /tags:\s*\[(.*?)\]/;
        const tagsMatch = yamlContent.match(tagsRegex);

        if (tagsMatch) {
          const currentTags = tagsMatch[1]
            .split(',')
            .map((tag) => tag.trim().replace(/['"]/g, ''));

          const normalizedTags = this.normalizeTags(currentTags);

          // Check if any tags changed
          const tagsChanged = currentTags.some(
            (tag, index) => this.normalizeTag(tag) !== tag
          );

          if (tagsChanged) {
            const newTagsString = normalizedTags
              .map((tag) => `"${tag}"`)
              .join(', ');
            updatedYaml = updatedYaml.replace(
              tagsRegex,
              `tags: [${newTagsString}]`
            );

            currentTags.forEach((original, index) => {
              const normalized = this.normalizeTag(original);
              if (original !== normalized) {
                changedTags.push({ original, normalized });
              }
            });

            hasChanges = true;
          }
        }

        if (hasChanges) {
          updatedContent = updatedContent.replace(yamlMatch[1], updatedYaml);
        }
      }
    }

    return {
      content: updatedContent,
      hasChanges,
      changedTags,
    };
  }

  /**
   * Standardize tags in time log entries
   */
  async standardizeTagsInTimeLog(content, filePath) {
    let updatedContent = content;
    let hasChanges = false;
    const changedTags = [];

    // Find all tag patterns in time log entries: [tag1, tag2, tag3]
    const tagRegex = /\[([^\]]+)\](?=\s*$)/gm;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tagString = match[1];
      const currentTags = tagString.split(',').map((tag) => tag.trim());
      const normalizedTags = this.normalizeTags(currentTags);

      // Check if any tags changed
      const tagsChanged = currentTags.some(
        (tag) => this.normalizeTag(tag) !== tag
      );

      if (tagsChanged) {
        const newTagString = normalizedTags.join(', ');
        updatedContent = updatedContent.replace(match[0], `[${newTagString}]`);

        currentTags.forEach((original) => {
          const normalized = this.normalizeTag(original);
          if (original !== normalized) {
            changedTags.push({ original, normalized });
          }
        });

        hasChanges = true;
      }
    }

    return {
      content: updatedContent,
      hasChanges,
      changedTags,
    };
  }

  /**
   * Get tag usage statistics
   */
  async getTagStatistics(
    projectsDir = path.join(__dirname, '../projects'),
    timeLogsDir = path.join(__dirname, '../time-logs')
  ) {
    const stats = {
      totalTags: 0,
      uniqueTags: new Set(),
      invalidTags: [],
      duplicateTags: [],
      projectTags: new Map(),
      timeLogTags: new Map(),
    };

    // Analyze project tags
    if (fs.existsSync(projectsDir)) {
      const projectFiles = fs
        .readdirSync(projectsDir)
        .filter((file) => file.endsWith('.md'));

      for (const file of projectFiles) {
        const content = fs.readFileSync(path.join(projectsDir, file), 'utf8');
        const tags = this.extractTagsFromContent(content);

        if (tags.length > 0) {
          stats.projectTags.set(file, tags);
          tags.forEach((tag) => {
            stats.totalTags++;
            stats.uniqueTags.add(tag);

            if (!this.isValidTag(tag)) {
              stats.invalidTags.push({
                file,
                tag,
                normalized: this.normalizeTag(tag),
              });
            }
          });
        }
      }
    }

    // Analyze time log tags
    if (fs.existsSync(timeLogsDir)) {
      const timeLogFiles = fs
        .readdirSync(timeLogsDir)
        .filter((file) => file.endsWith('.md') && file.startsWith('time-log-'));

      for (const file of timeLogFiles) {
        const content = fs.readFileSync(path.join(timeLogsDir, file), 'utf8');
        const tags = this.extractTagsFromTimeLog(content);

        if (tags.length > 0) {
          stats.timeLogTags.set(file, tags);
          tags.forEach((tag) => {
            stats.totalTags++;
            stats.uniqueTags.add(tag);

            if (!this.isValidTag(tag)) {
              stats.invalidTags.push({
                file,
                tag,
                normalized: this.normalizeTag(tag),
              });
            }
          });
        }
      }
    }

    return {
      totalTags: stats.totalTags,
      uniqueTagCount: stats.uniqueTags.size,
      uniqueTags: Array.from(stats.uniqueTags).sort(),
      invalidTags: stats.invalidTags,
      projectTagCount: stats.projectTags.size,
      timeLogTagCount: stats.timeLogTags.size,
    };
  }

  /**
   * Extract tags from project content (YAML frontmatter)
   */
  extractTagsFromContent(content) {
    const tags = [];
    const tagsRegex = /tags:\s*\[(.*?)\]/;
    const match = content.match(tagsRegex);

    if (match) {
      const tagString = match[1];
      tags.push(
        ...tagString.split(',').map((tag) => tag.trim().replace(/['"]/g, ''))
      );
    }

    return tags.filter((tag) => tag.length > 0);
  }

  /**
   * Extract tags from time log content
   */
  extractTagsFromTimeLog(content) {
    const tags = [];
    const tagRegex = /\[([^\]]+)\](?=\s*$)/gm;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const tagString = match[1];
      tags.push(...tagString.split(',').map((tag) => tag.trim()));
    }

    return tags.filter((tag) => tag.length > 0);
  }

  /**
   * Generate tag migration report
   */
  async generateMigrationReport() {
    const stats = await this.getTagStatistics();

    const report = {
      summary: {
        totalTags: stats.totalTags,
        uniqueTags: stats.uniqueTagCount,
        invalidTags: stats.invalidTags.length,
        needsMigration: stats.invalidTags.length > 0,
      },
      invalidTags: stats.invalidTags,
      allTags: stats.uniqueTags,
      recommendations: [],
    };

    // Generate recommendations
    if (stats.invalidTags.length > 0) {
      report.recommendations.push(
        'Run tag standardization to fix invalid tags'
      );
    }

    if (stats.uniqueTagCount > 50) {
      report.recommendations.push(
        'Consider consolidating similar tags to reduce complexity'
      );
    }

    return report;
  }
}

module.exports = TagStandardizer;
