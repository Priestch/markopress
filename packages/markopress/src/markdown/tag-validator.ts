/**
 * Tag Validator for Marko components in markdown
 *
 * Tracks all detected Marko tags during the build process,
 * scans the tags/ directory for available components,
 * and validates that all detected tags have corresponding component files.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface DetectedTag {
  /** Tag name (kebab-case, e.g., "alert-box") */
  tagName: string;

  /** File path where tag was used */
  fileName: string;

  /** Line number where tag was used */
  lineNumber: number;
}

export interface ValidationResult {
  /** True if all detected tags have corresponding component files */
  success: boolean;

  /** List of missing tags with their usage locations */
  missingTags: DetectedTag[];
}

export class TagValidator {
  private detectedTags: Map<string, DetectedTag[]> = new Map();
  private availableTags: Set<string> = new Set();

  /**
   * Add a detected tag for tracking
   */
  addDetectedTag(tagName: string, fileName: string, lineNumber: number): void {
    const normalized = tagName.toLowerCase();
    if (!this.detectedTags.has(normalized)) {
      this.detectedTags.set(normalized, []);
    }
    this.detectedTags.get(normalized)!.push({
      tagName: normalized,
      fileName,
      lineNumber,
    });
  }

  /**
   * Scan tags directory to find all available Marko components
   */
  async loadAvailableTags(tagsDir: string): Promise<void> {
    try {
      await fs.access(tagsDir);
    } catch {
      // Directory doesn't exist, that's OK (no tags available)
      console.warn(`Warning: tags directory not found at ${tagsDir}`);
      return;
    }

    const files = await fs.readdir(tagsDir);
    for (const file of files) {
      if (file.endsWith('.marko')) {
        const tagName = file.replace('.marko', '');
        this.availableTags.add(tagName);
      }
    }
  }

  /**
   * Get count of available tags
   */
  getAvailableTagsCount(): number {
    return this.availableTags.size;
  }

  /**
   * Get list of available tags
   */
  getAvailableTags(): string[] {
    return Array.from(this.availableTags).sort();
  }

  /**
   * Get all detected tags (grouped by tag name)
   */
  getDetectedTags(): Map<string, DetectedTag[]> {
    return this.detectedTags;
  }

  /**
   * Validate that all detected tags exist in the tags directory
   *
   * @returns Validation result with success flag and list of missing tags
   */
  validate(): ValidationResult {
    const missingTags: DetectedTag[] = [];

    // Check each detected tag
    for (const [tagName, occurrences] of this.detectedTags) {
      if (!this.availableTags.has(tagName)) {
        // Tag is missing - add all occurrences
        missingTags.push(...occurrences);
      }
    }

    return {
      success: missingTags.length === 0,
      missingTags,
    };
  }

  /**
   * Clear state for new build
   */
  reset(): void {
    this.detectedTags.clear();
    this.availableTags.clear();
  }
}

/**
 * Format validation error message
 */
export function formatValidationError(missingTags: DetectedTag[]): string {
  // Group by tag name
  const uniqueTags = new Map<string, DetectedTag[]>();
  for (const tag of missingTags) {
    if (!uniqueTags.has(tag.tagName)) {
      uniqueTags.set(tag.tagName, []);
    }
    uniqueTags.get(tag.tagName)!.push(tag);
  }

  let output = '\n❌ Marko tags not found:\n';
  for (const [tagName, occurrences] of uniqueTags) {
    output += `\n  <${tagName}> used in:\n`;
    for (const occ of occurrences) {
      output += `    ${occ.fileName}:${occ.lineNumber}\n`;
    }
  }

  output += '\nCreate missing files in tags/ directory or remove tags from markdown.\n';
  return output;
}

/**
 * Create a global validator instance
 */
export const globalTagValidator = new TagValidator();