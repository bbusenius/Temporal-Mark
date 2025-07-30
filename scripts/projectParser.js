const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ProjectParser {
  constructor() {
    this.frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    this.summaryRegex = /^## Summary\n(.*?)(?=\n## |$)/ms;
  }

  /**
   * Parse a single project file and extract metadata
   */
  parseProjectFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(this.frontmatterRegex);

    if (!match) {
      throw new Error(
        `Invalid project file format: ${filePath}. Missing frontmatter.`
      );
    }

    const [, frontmatterYaml, markdownBody] = match;

    let frontmatter;
    try {
      frontmatter = yaml.load(frontmatterYaml);
    } catch (error) {
      throw new Error(
        `Invalid YAML frontmatter in ${filePath}: ${error.message}`
      );
    }

    // Validate required fields
    this.validateProjectFrontmatter(frontmatter, filePath);

    // Extract summary from markdown body
    const summary = this.extractSummary(markdownBody);

    return {
      projectName: frontmatter.project,
      departmentalGoals: this.ensureArray(frontmatter.departmentalGoal),
      strategicDirections: this.ensureArray(frontmatter.strategicDirection),
      tags: this.ensureArray(frontmatter.tags),
      status: frontmatter.status,
      startDate: this.normalizeDate(frontmatter.startDate),
      summary: summary || '',
      filePath,
      frontmatter,
      markdownBody,
    };
  }

  /**
   * Parse all project files in a directory
   */
  parseAllProjectFiles(projectsDir) {
    if (!fs.existsSync(projectsDir)) {
      throw new Error(`Projects directory not found: ${projectsDir}`);
    }

    const files = fs
      .readdirSync(projectsDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(projectsDir, file));

    const projects = [];
    const errors = [];

    files.forEach((filePath) => {
      try {
        const project = this.parseProjectFile(filePath);
        projects.push(project);
      } catch (error) {
        errors.push({
          file: filePath,
          error: error.message,
        });
      }
    });

    return { projects, errors };
  }

  /**
   * Validate required frontmatter fields
   */
  validateProjectFrontmatter(frontmatter, filePath) {
    const requiredFields = [
      'project',
      'departmentalGoal',
      'strategicDirection',
      'status',
      'startDate',
    ];

    const missingFields = requiredFields.filter((field) => !frontmatter[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required fields in ${filePath}: ${missingFields.join(', ')}`
      );
    }

    // Validate date format
    const normalizedDate = this.normalizeDate(frontmatter.startDate);
    if (!this.isValidDate(normalizedDate)) {
      throw new Error(
        `Invalid startDate format in ${filePath}: ${frontmatter.startDate}. Expected YYYY-MM-DD.`
      );
    }

    // Validate status
    const validStatuses = ['Active', 'Completed', 'On Hold', 'Cancelled'];
    if (!validStatuses.includes(frontmatter.status)) {
      throw new Error(
        `Invalid status in ${filePath}: ${frontmatter.status}. Must be one of: ${validStatuses.join(', ')}`
      );
    }
  }

  /**
   * Extract summary section from markdown body
   */
  extractSummary(markdownBody) {
    const match = markdownBody.match(this.summaryRegex);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * Ensure a field is an array
   */
  ensureArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return [value];
    }
    if (value === null || value === undefined) {
      return [];
    }
    return [value];
  }

  /**
   * Normalize date to YYYY-MM-DD string format
   */
  normalizeDate(dateValue) {
    if (typeof dateValue === 'string') {
      return dateValue;
    }
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0];
    }
    return String(dateValue);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDate(dateStr) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return date.toISOString().split('T')[0] === dateStr;
  }

  /**
   * Get project by name from a list of projects
   */
  findProjectByName(projects, projectName) {
    return projects.find(
      (project) =>
        project.projectName === projectName ||
        project.projectName.toLowerCase() === projectName.toLowerCase()
    );
  }

  /**
   * Group projects by departmental goal
   */
  groupProjectsByDepartmentalGoal(projects) {
    const grouped = {};

    projects.forEach((project) => {
      project.departmentalGoals.forEach((goal) => {
        if (!grouped[goal]) {
          grouped[goal] = [];
        }
        grouped[goal].push(project);
      });
    });

    return grouped;
  }

  /**
   * Group projects by strategic direction
   */
  groupProjectsByStrategicDirection(projects) {
    const grouped = {};

    projects.forEach((project) => {
      project.strategicDirections.forEach((direction) => {
        if (!grouped[direction]) {
          grouped[direction] = [];
        }
        grouped[direction].push(project);
      });
    });

    return grouped;
  }

  /**
   * Get all unique tags from projects
   */
  getAllTags(projects) {
    const allTags = new Set();

    projects.forEach((project) => {
      project.tags.forEach((tag) => {
        allTags.add(tag);
      });
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get all unique departmental goals
   */
  getAllDepartmentalGoals(projects) {
    const allGoals = new Set();

    projects.forEach((project) => {
      project.departmentalGoals.forEach((goal) => {
        allGoals.add(goal);
      });
    });

    return Array.from(allGoals).sort();
  }

  /**
   * Get all unique strategic directions
   */
  getAllStrategicDirections(projects) {
    const allDirections = new Set();

    projects.forEach((project) => {
      project.strategicDirections.forEach((direction) => {
        allDirections.add(direction);
      });
    });

    return Array.from(allDirections).sort();
  }

  /**
   * Truncate project summary to specified length
   */
  truncateSummary(summary, maxLength = 100) {
    if (!summary || summary.length <= maxLength) {
      return summary;
    }

    return `${summary.substring(0, maxLength - 3).trim()}...`;
  }

  /**
   * Sort projects by start date (chronological)
   */
  sortProjectsByDate(projects) {
    return [...projects].sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );
  }

  /**
   * Sort projects alphabetically by name
   */
  sortProjectsAlphabetically(projects) {
    return [...projects].sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    );
  }
}

module.exports = ProjectParser;
