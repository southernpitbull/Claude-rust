/**
 * Theme Management System
 * Provides dark/light themes and custom theme support
 */

import type { Theme, Color, StyleConfig } from './types';

/**
 * Default dark theme
 */
export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan',
    background: 'black',
    foreground: 'white',
    border: 'gray',
    focus: 'brightBlue',
    selection: 'blue',
    disabled: 'gray',
  },
  styles: {
    header: {
      fg: 'white',
      bg: 'blue',
      bold: true,
      border: {
        type: 'line',
        fg: 'brightBlue',
      },
    },
    footer: {
      fg: 'white',
      bg: 'black',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    panel: {
      fg: 'white',
      bg: 'black',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    button: {
      fg: 'white',
      bg: 'blue',
      bold: true,
      border: {
        type: 'line',
        fg: 'brightBlue',
      },
    },
    input: {
      fg: 'white',
      bg: 'black',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    table: {
      fg: 'white',
      bg: 'black',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    tree: {
      fg: 'white',
      bg: 'black',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    modal: {
      fg: 'white',
      bg: 'black',
      bold: true,
      border: {
        type: 'line',
        fg: 'brightBlue',
      },
    },
  },
};

/**
 * Default light theme
 */
export const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'cyan',
    background: 'white',
    foreground: 'black',
    border: 'gray',
    focus: 'brightBlue',
    selection: 'blue',
    disabled: 'gray',
  },
  styles: {
    header: {
      fg: 'black',
      bg: 'white',
      bold: true,
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    footer: {
      fg: 'black',
      bg: 'white',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    panel: {
      fg: 'black',
      bg: 'white',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    button: {
      fg: 'white',
      bg: 'blue',
      bold: true,
      border: {
        type: 'line',
        fg: 'brightBlue',
      },
    },
    input: {
      fg: 'black',
      bg: 'white',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    table: {
      fg: 'black',
      bg: 'white',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    tree: {
      fg: 'black',
      bg: 'white',
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
    modal: {
      fg: 'black',
      bg: 'white',
      bold: true,
      border: {
        type: 'line',
        fg: 'gray',
      },
    },
  },
};

/**
 * Theme manager singleton
 */
export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme;
  private themes: Map<string, Theme>;
  private listeners: Set<(theme: Theme) => void>;

  private constructor() {
    this.themes = new Map<string, Theme>();
    this.themes.set('dark', darkTheme);
    this.themes.set('light', lightTheme);
    this.currentTheme = darkTheme;
    this.listeners = new Set();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Get the current theme
   */
  public getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Set the active theme
   */
  public setTheme(name: string): void {
    const theme = this.themes.get(name);
    if (!theme) {
      throw new Error(`Theme not found: ${name}`);
    }
    this.currentTheme = theme;
    this.notifyListeners();
  }

  /**
   * Register a custom theme
   */
  public registerTheme(theme: Theme): void {
    this.themes.set(theme.name, theme);
  }

  /**
   * Get all available theme names
   */
  public getThemeNames(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Get a specific color from the current theme
   */
  public getColor(name: keyof Theme['colors']): Color {
    return this.currentTheme.colors[name];
  }

  /**
   * Get a specific style from the current theme
   */
  public getStyle(component: keyof Theme['styles']): StyleConfig {
    return this.currentTheme.styles[component];
  }

  /**
   * Create a custom style by merging theme style with overrides
   */
  public createStyle(
    component: keyof Theme['styles'],
    overrides?: Partial<StyleConfig>
  ): StyleConfig {
    const baseStyle = this.currentTheme.styles[component];
    return {
      ...baseStyle,
      ...overrides,
      border: {
        ...baseStyle.border,
        ...overrides?.border,
      },
    };
  }

  /**
   * Listen for theme changes
   */
  public onChange(listener: (theme: Theme) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove theme change listener
   */
  public offChange(listener: (theme: Theme) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.currentTheme));
  }

  /**
   * Get color for status type
   */
  public getStatusColor(type: 'info' | 'success' | 'warning' | 'error'): Color {
    return this.currentTheme.colors[type];
  }

  /**
   * Convert blessed color string to theme color
   */
  public toBlessedColor(color: Color): string {
    return color;
  }

  /**
   * Create a gradient color array
   */
  public createGradient(start: Color, end: Color, steps: number): Color[] {
    // For terminal colors, we can't create true gradients
    // Return alternating colors as a simple approximation
    const gradient: Color[] = [];
    for (let i = 0; i < steps; i++) {
      gradient.push(i % 2 === 0 ? start : end);
    }
    return gradient;
  }

  /**
   * Check if current theme is dark
   */
  public isDark(): boolean {
    return this.currentTheme.name === 'dark' || this.currentTheme.colors.background === 'black';
  }

  /**
   * Check if current theme is light
   */
  public isLight(): boolean {
    return !this.isDark();
  }

  /**
   * Toggle between dark and light theme
   */
  public toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  /**
   * Reset to default theme
   */
  public reset(): void {
    this.setTheme('dark');
  }
}

/**
 * Get the global theme manager instance
 */
export function getThemeManager(): ThemeManager {
  return ThemeManager.getInstance();
}

/**
 * Convenience function to get current theme
 */
export function getCurrentTheme(): Theme {
  return ThemeManager.getInstance().getTheme();
}

/**
 * Convenience function to get theme color
 */
export function getThemeColor(name: keyof Theme['colors']): Color {
  return ThemeManager.getInstance().getColor(name);
}

/**
 * Convenience function to get theme style
 */
export function getThemeStyle(component: keyof Theme['styles']): StyleConfig {
  return ThemeManager.getInstance().getStyle(component);
}
