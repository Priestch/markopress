/**
 * Tag Validator for Marko components in markdown
 *
 * Tracks all detected Marko tags during the build process,
 * scans the tags/ directory for available components,
 * and validates that all detected tags have corresponding component files.
 */
import { promises as fs } from 'node:fs';
export class TagValidator {
    detectedTags = new Map();
    availableTags = new Set();
    /**
     * Add a detected tag for tracking
     */
    addDetectedTag(tagName, fileName, lineNumber) {
        const normalized = tagName.toLowerCase();
        if (!this.detectedTags.has(normalized)) {
            this.detectedTags.set(normalized, []);
        }
        this.detectedTags.get(normalized).push({
            tagName: normalized,
            fileName,
            lineNumber,
        });
    }
    /**
     * Scan tags directory to find all available Marko components
     */
    async loadAvailableTags(tagsDir) {
        try {
            await fs.access(tagsDir);
        }
        catch {
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
    getAvailableTagsCount() {
        return this.availableTags.size;
    }
    /**
     * Get list of available tags
     */
    getAvailableTags() {
        return Array.from(this.availableTags).sort();
    }
    /**
     * Get all detected tags (grouped by tag name)
     */
    getDetectedTags() {
        return this.detectedTags;
    }
    /**
     * Validate that all detected tags exist in the tags directory
     *
     * @returns Validation result with success flag and list of missing tags
     */
    validate() {
        const missingTags = [];
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
    reset() {
        this.detectedTags.clear();
        this.availableTags.clear();
    }
}
/**
 * Format validation error message
 */
export function formatValidationError(missingTags) {
    // Group by tag name
    const uniqueTags = new Map();
    for (const tag of missingTags) {
        if (!uniqueTags.has(tag.tagName)) {
            uniqueTags.set(tag.tagName, []);
        }
        uniqueTags.get(tag.tagName).push(tag);
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
