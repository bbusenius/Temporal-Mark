/**
 * @fileoverview Wiki-link validation and management system for Obsidian-style project references
 * Provides validation, auto-creation, suggestions, and bulk operations for wiki-links
 * in time logs and other markdown files.
 *
 * @author Temporal Mark
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const errorLogger = require('./errorLogger');

/**
 * Validates and manages wiki-links ([[Project Name]]) throughout the system
 * Provides project auto-creation, similarity suggestions, and bulk validation
 *
 * @class WikiLinkValidator
 */
class WikiLinkValidator {
  /**
   * Initialize the WikiLinkValidator with project directory and validation regex
   * @constructor
   * @param {string} [projectsDir] - Directory containing project files (default: ../projects)
   */
  constructor(projectsDir = path.join(__dirname, '../projects')) {
    this.projectsDir = projectsDir;
    this.wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    this.projectCache = new Map();
  }

  /**
   * Extract all wiki-links from text using [[Project Name]] syntax
   *
   * @param {string} text - Text to search for wiki-links
   * @returns {Array<Object>} Array of link objects with fullMatch, linkText, startIndex, endIndex
   * @example
   * // Returns: [{ fullMatch: '[[Project Name]]', linkText: 'Project Name', startIndex: 0, endIndex: 16 }]
   * extractWikiLinks('Working on [[Project Name]] today')
   */
  extractWikiLinks(text) {
    const links = [];
    let match;

    // Reset regex state
    this.wikiLinkRegex.lastIndex = 0;

    while ((match = this.wikiLinkRegex.exec(text)) !== null) {
      links.push({
        fullMatch: match[0],
        linkText: match[1].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return links;
  }

  /**
   * Validate that all wiki-links in text point to existing projects
   */
  async validateWikiLinks(text, allowMissing = false) {
    const links = this.extractWikiLinks(text);
    const validationResults = [];

    await this.loadProjectCache();

    for (const link of links) {
      const projectExists = this.projectCache.has(link.linkText.toLowerCase());
      const isValid = projectExists || allowMissing;

      validationResults.push({
        linkText: link.linkText,
        fullMatch: link.fullMatch,
        startIndex: link.startIndex,
        endIndex: link.endIndex,
        exists: projectExists,
        isValid,
        suggestions: projectExists ? [] : this.getSuggestions(link.linkText),
      });

      if (!isValid) {
        errorLogger.logValidationError(
          'wikiLink',
          link.linkText,
          'existing project name',
          {
            fullText: text,
            suggestions: this.getSuggestions(link.linkText),
          }
        );
      }
    }

    return {
      isValid: validationResults.every((r) => r.isValid),
      links: validationResults,
      invalidCount: validationResults.filter((r) => !r.isValid).length,
    };
  }

  /**
   * Get suggestions for similar project names
   */
  getSuggestions(linkText, maxSuggestions = 3) {
    const projectNames = Array.from(this.projectCache.keys());
    const suggestions = [];

    const linkLower = linkText.toLowerCase();

    // Exact partial matches first
    projectNames.forEach((name) => {
      if (name.includes(linkLower) || linkLower.includes(name)) {
        suggestions.push({ name, score: 2 });
      }
    });

    // Levenshtein distance matches
    projectNames.forEach((name) => {
      const nameLower = name.toLowerCase();

      // Check similarity against full name
      const distance = this.levenshteinDistance(linkLower, nameLower);
      const maxLength = Math.max(linkLower.length, nameLower.length);
      const similarity = 1 - distance / maxLength;

      // Check if the link text is contained in the project name
      const containsMatch =
        nameLower.includes(linkLower) && linkLower.length >= 3;

      // Check similarity against first word of project name (for long project names)
      const firstWord = nameLower.split(/[-\s]/)[0];
      const firstWordDistance = this.levenshteinDistance(linkLower, firstWord);
      const firstWordSimilarity =
        1 - firstWordDistance / Math.max(linkLower.length, firstWord.length);

      // Use best similarity score
      const bestSimilarity = Math.max(similarity, firstWordSimilarity);

      if (
        (bestSimilarity > 0.4 || containsMatch) &&
        !suggestions.find((s) => s.name === name)
      ) {
        suggestions.push({ name, score: containsMatch ? 1.5 : bestSimilarity });
      }
    });

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions)
      .map((s) => s.name);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Load project names into cache
   */
  async loadProjectCache() {
    try {
      if (!fs.existsSync(this.projectsDir)) {
        return;
      }

      this.projectCache.clear();

      const files = fs
        .readdirSync(this.projectsDir)
        .filter((file) => file.endsWith('.md'));

      for (const file of files) {
        const projectName = path.basename(file, '.md');
        this.projectCache.set(projectName.toLowerCase(), {
          name: projectName,
          filePath: path.join(this.projectsDir, file),
        });
      }

      errorLogger.logActivity('WIKI_LINK_CACHE_LOADED', {
        projectCount: this.projectCache.size,
      });
    } catch (error) {
      errorLogger.logError(error, { operation: 'LOAD_PROJECT_CACHE' });
    }
  }

  /**
   * Create a new project file for a wiki-link
   */
  async createProjectForWikiLink(projectName, metadata = {}) {
    try {
      const sanitizedName = this.sanitizeProjectName(projectName);
      const filePath = path.join(this.projectsDir, `${sanitizedName}.md`);

      if (fs.existsSync(filePath)) {
        throw new Error(`Project file already exists: ${sanitizedName}.md`);
      }

      // Ensure projects directory exists
      if (!fs.existsSync(this.projectsDir)) {
        fs.mkdirSync(this.projectsDir, { recursive: true });
      }

      const currentDate = new Date().toISOString().split('T')[0];
      const defaultMetadata = {
        project: sanitizedName,
        status: 'Active',
        startDate: currentDate,
        departmentalGoal: ['General'],
        strategicDirection: ['General'],
        tags: [],
        summary: `Project created from wiki-link reference: [[${projectName}]]`,
        ...metadata,
      };

      const yamlHeader = Object.entries(defaultMetadata)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            if (value.length === 0) {
              return `${key}: []`;
            }
            return `${key}:\n${value.map((v) => `  - ${v}`).join('\n')}`;
          }
          // Always quote string values for consistent YAML formatting
          if (typeof value === 'string') {
            return `${key}: "${value}"`;
          }
          return `${key}: ${value}`;
        })
        .join('\n');

      const content = `---\n${yamlHeader}\n---\n\n# ${sanitizedName}\n\n${defaultMetadata.summary}\n\n## Notes\n\n*Add project details here*\n`;

      fs.writeFileSync(filePath, content, 'utf8');

      // Update cache
      this.projectCache.set(sanitizedName.toLowerCase(), {
        name: sanitizedName,
        filePath,
      });

      errorLogger.logActivity('PROJECT_CREATED_FROM_WIKI_LINK', {
        projectName: sanitizedName,
        originalName: projectName,
        filePath,
      });

      return {
        success: true,
        projectName: sanitizedName,
        filePath,
        created: true,
      };
    } catch (error) {
      errorLogger.logError(error, {
        operation: 'CREATE_PROJECT_FOR_WIKI_LINK',
        projectName,
      });
      throw error;
    }
  }

  /**
   * Sanitize project name for file system
   */
  sanitizeProjectName(name) {
    return name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename chars
      .replace(/\s+/g, ' ') // Normalize whitespace but preserve spaces
      .replace(/^\.+|\.+$/g, '') // Remove leading/trailing dots
      .slice(0, 100); // Limit length
  }

  /**
   * Auto-fix wiki-links in text by suggesting corrections
   */
  async autoFixWikiLinks(text, autoCreate = false) {
    const validation = await this.validateWikiLinks(text, true);
    let fixedText = text;
    const changes = [];

    // Process from end to start to maintain indices
    const invalidLinks = validation.links.filter((l) => !l.exists).reverse();

    for (const link of invalidLinks) {
      let replacement = link.fullMatch;

      if (link.suggestions.length > 0) {
        // Use best suggestion
        replacement = `[[${link.suggestions[0]}]]`;
        changes.push({
          type: 'suggestion',
          original: link.linkText,
          replacement: link.suggestions[0],
          confidence: 'high',
        });
      } else if (autoCreate) {
        // Create new project
        const result = await this.createProjectForWikiLink(link.linkText);
        replacement = `[[${result.projectName}]]`;
        changes.push({
          type: 'created',
          original: link.linkText,
          replacement: result.projectName,
          filePath: result.filePath,
        });
      } else {
        changes.push({
          type: 'unresolved',
          original: link.linkText,
          suggestions: link.suggestions,
        });
        continue; // Don't modify text for unresolved links
      }

      fixedText =
        fixedText.slice(0, link.startIndex) +
        replacement +
        fixedText.slice(link.endIndex);
    }

    return {
      originalText: text,
      fixedText,
      changes,
      hasChanges: changes.length > 0,
    };
  }

  /**
   * Get all project names for autocomplete
   */
  getProjectNames() {
    return Array.from(this.projectCache.values())
      .map((p) => p.name)
      .sort();
  }

  /**
   * Check if a project exists (case-insensitive)
   */
  projectExists(projectName) {
    return this.projectCache.has(projectName.toLowerCase());
  }
}

module.exports = WikiLinkValidator;
