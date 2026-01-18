/**
 * Security functions test suite
 * Tests for XSS prevention, path traversal prevention, and safe file deletion
 */

import { describe, it, expect } from 'vitest';
import { validateThemeName } from './index.js';

describe('validateThemeName', () => {
  describe('Valid Package Names', () => {
    it('should accept valid unscoped names', () => {
      expect(() => validateThemeName('my-theme')).not.toThrow();
      expect(() => validateThemeName('theme-default')).not.toThrow();
      expect(() => validateThemeName('awesome_theme')).not.toThrow();
    });

    it('should accept valid scoped names', () => {
      expect(() => validateThemeName('@markopress/theme-default')).not.toThrow();
      expect(() => validateThemeName('@org/my-theme')).not.toThrow();
    });

    it('should accept names with special chars', () => {
      expect(() => validateThemeName('my-awesome_theme')).not.toThrow();
      expect(() => validateThemeName('theme.v2.0')).not.toThrow();
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject path traversal attempts', () => {
      expect(() => validateThemeName('../../../etc/passwd'))
        .toThrow();
    });

    it('should reject relative paths', () => {
      expect(() => validateThemeName('foo/../../bar'))
        .toThrow();
    });

    it('should reject double dots anywhere', () => {
      expect(() => validateThemeName('theme..malicious'))
        .toThrow('Theme name cannot contain traversal sequences');
    });
  });

  describe('Path Separator Prevention', () => {
    it('should reject backslashes', () => {
      expect(() => validateThemeName('foo\\bar'))
        .toThrow();
    });

    it('should reject multiple slashes', () => {
      expect(() => validateThemeName('foo//bar/theme'))
        .toThrow();
    });

    it('should reject unscoped names with slashes', () => {
      expect(() => validateThemeName('foo/bar/theme'))
        .toThrow();
    });
  });

  describe('Absolute Path Prevention', () => {
    it('should reject Unix absolute paths', () => {
      expect(() => validateThemeName('/etc/passwd'))
        .toThrow();
    });

    it('should reject root paths', () => {
      expect(() => validateThemeName('/'))
        .toThrow();
    });
  });

  describe('Invalid Package Names', () => {
    it('should reject uppercase letters', () => {
      expect(() => validateThemeName('MyTheme'))
        .toThrow('Invalid theme name');
    });

    it('should reject names starting with dots', () => {
      expect(() => validateThemeName('.theme'))
        .toThrow('Invalid theme name');
    });

    it('should reject empty strings', () => {
      expect(() => validateThemeName(''))
        .toThrow('Invalid theme name');
    });

    it('should reject names with spaces', () => {
      expect(() => validateThemeName('my theme'))
        .toThrow('Invalid theme name');
    });

    it('should reject special characters', () => {
      expect(() => validateThemeName('theme!@#$'))
        .toThrow('Invalid theme name');
    });

    it('should reject incomplete scoped names', () => {
      expect(() => validateThemeName('@org/'))
        .toThrow('Invalid theme name');
    });
  });
});
