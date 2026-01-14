/**
 * Security functions test suite
 * Tests for XSS prevention, path traversal prevention, and safe file deletion
 */

import { describe, it, expect } from 'vitest';
import { escapeMarkoTemplate, validateThemeName } from './index.js';

describe('escapeMarkoTemplate', () => {
  describe('XSS Prevention', () => {
    it('should escape interpolation syntax', () => {
      const input = 'Hello ${user.name}';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('Hello $\\{user.name}');
    });

    it('should escape dynamic tags', () => {
      const input = '<${Component} />';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\$\\{Component} />');
    });

    it('should escape for loop syntax', () => {
      const input = '<for|item| of=items>${item}</for>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\for|item| of=items>$\\{item}</for>');
    });

    it('should escape for alternative syntax', () => {
      const input = '<for(item in items)>${item}</for>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\for(item in items)>$\\{item}</for>');
    });

    it('should escape if conditional syntax', () => {
      const input = '<if=user.isAdmin>Admin Panel</if>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\if=user.isAdmin>Admin Panel</if>');
    });

    it('should escape if alternative syntax', () => {
      const input = '<if(user.isAdmin)>Admin Panel</if>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\if(user.isAdmin)>Admin Panel</if>');
    });

    it('should escape else-if syntax', () => {
      const input = '<if=x><else-if=y><else>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\if=x><\\else-if=y><\\else>');
    });

    it('should escape else syntax', () => {
      const input = '<if=condition>True<else>False</else>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\if=condition>True<\\else>False</else>');
    });

    it('should escape while loop syntax', () => {
      const input = '<while(i < 10)>${i++}</while>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\while(i < 10)>$\\{i++}</while>');
    });

    it('should escape macro definitions', () => {
      const input = '<macro|greeting(name)|>Hello ${name}</macro>';
      const output = escapeMarkoTemplate(input);
      expect(output).toBe('<\\macro|greeting(name)|>Hello $\\{name}</macro>');
    });

    it('should handle complex attack vectors', () => {
      const malicious = '<script>alert("XSS")</script><if=true>${dangerous()}</if>';
      const output = escapeMarkoTemplate(malicious);
      expect(output).not.toContain('${');
      expect(output).not.toContain('<if=');
      expect(output).toContain('$\\{');
      expect(output).toContain('<\\if=');
    });

    it('should preserve safe HTML', () => {
      const safe = '<p>Hello <strong>World</strong></p>';
      const output = escapeMarkoTemplate(safe);
      expect(output).toBe(safe);
    });

    it('should handle empty strings', () => {
      expect(escapeMarkoTemplate('')).toBe('');
    });

    it('should handle plain text', () => {
      const plain = 'Just plain text 123 !@#';
      expect(escapeMarkoTemplate(plain)).toBe(plain);
    });
  });
});

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
