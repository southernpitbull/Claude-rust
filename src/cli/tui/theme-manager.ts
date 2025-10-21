import { LayoutManager } from './layout-manager';

/**
 * ThemeManager handles color schemes and visual themes
 * for the TUI interface
 */
export class ThemeManager {
  private currentTheme: string;
  private themes: Map<string, any>;
  private layoutManager: LayoutManager;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.currentTheme = 'default';
    this.themes = new Map();

    this.initializeThemes();
  }

  private initializeThemes(): void {
    // Default theme
    this.themes.set('default', {
      header: {
        fg: 'white',
        bg: 'blue',
        border: { fg: '#f0f0f0' },
      },
      main: {
        fg: 'white',
        bg: 'black',
        border: { fg: '#f0f0f0' },
      },
      footer: {
        fg: 'white',
        bg: 'blue',
        border: { fg: '#f0f0f0' },
      },
      chat: {
        fg: 'white',
        bg: 'black',
      },
      input: {
        fg: 'white',
        bg: 'black',
        border: { fg: '#f0f0f0' },
      },
      highlight: {
        fg: 'yellow',
        bg: 'black',
      },
      success: {
        fg: 'green',
        bg: 'black',
      },
      warning: {
        fg: 'yellow',
        bg: 'black',
      },
      error: {
        fg: 'red',
        bg: 'black',
      },
    });

    // Dark theme
    this.themes.set('dark', {
      header: {
        fg: '#e0e0e0',
        bg: '#2c2c2c',
        border: { fg: '#5a5a5a' },
      },
      main: {
        fg: '#e0e0e0',
        bg: '#1e1e1e',
        border: { fg: '#5a5a5a' },
      },
      footer: {
        fg: '#e0e0e0',
        bg: '#2c2c2c',
        border: { fg: '#5a5a5a' },
      },
      chat: {
        fg: '#e0e0e0',
        bg: '#1e1e1e',
      },
      input: {
        fg: '#e0e0e0',
        bg: '#2c2c2c',
        border: { fg: '#5a5a5a' },
      },
      highlight: {
        fg: '#ffd700',
        bg: '#1e1e1e',
      },
      success: {
        fg: '#4caf50',
        bg: '#1e1e1e',
      },
      warning: {
        fg: '#ff9800',
        bg: '#1e1e1e',
      },
      error: {
        fg: '#f44336',
        bg: '#1e1e1e',
      },
    });

    // Light theme
    this.themes.set('light', {
      header: {
        fg: '#333333',
        bg: '#f0f0f0',
        border: { fg: '#cccccc' },
      },
      main: {
        fg: '#333333',
        bg: '#ffffff',
        border: { fg: '#cccccc' },
      },
      footer: {
        fg: '#333333',
        bg: '#f0f0f0',
        border: { fg: '#cccccc' },
      },
      chat: {
        fg: '#333333',
        bg: '#ffffff',
      },
      input: {
        fg: '#333333',
        bg: '#f8f8f8',
        border: { fg: '#cccccc' },
      },
      highlight: {
        fg: '#ff9500',
        bg: '#ffffff',
      },
      success: {
        fg: '#43a047',
        bg: '#ffffff',
      },
      warning: {
        fg: '#ff9800',
        bg: '#ffffff',
      },
      error: {
        fg: '#e53935',
        bg: '#ffffff',
      },
    });

    // High contrast theme
    this.themes.set('high-contrast', {
      header: {
        fg: 'yellow',
        bg: 'black',
        border: { fg: 'white' },
      },
      main: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'white' },
      },
      footer: {
        fg: 'yellow',
        bg: 'black',
        border: { fg: 'white' },
      },
      chat: {
        fg: 'white',
        bg: 'black',
      },
      input: {
        fg: 'white',
        bg: 'black',
        border: { fg: 'white' },
      },
      highlight: {
        fg: 'cyan',
        bg: 'black',
      },
      success: {
        fg: 'green',
        bg: 'black',
      },
      warning: {
        fg: 'yellow',
        bg: 'black',
      },
      error: {
        fg: 'red',
        bg: 'black',
      },
    });
  }

  /**
   * Applies the current theme to all UI elements
   */
  public applyCurrentTheme(): void {
    const theme = this.themes.get(this.currentTheme);
    if (!theme) {
      console.error(`Theme '${this.currentTheme}' not found`);
      return;
    }

    // Update header styles
    const header = this.layoutManager.getHeader();
    if (header) {
      header.style.fg = theme.header.fg;
      header.style.bg = theme.header.bg;
      if (header.border) {
        header.border.style.fg = theme.header.border.fg;
      }
    }

    // Update main screen styles
    const mainScreen = this.layoutManager.getMainScreen();
    if (mainScreen) {
      mainScreen.style.fg = theme.main.fg;
      mainScreen.style.bg = theme.main.bg;
      if (mainScreen.border) {
        mainScreen.border.style.fg = theme.main.border.fg;
      }
    }

    // Update footer styles
    const footer = this.layoutManager.getFooter();
    if (footer) {
      footer.style.fg = theme.footer.fg;
      footer.style.bg = theme.footer.bg;
      if (footer.border) {
        footer.border.style.fg = theme.footer.border.fg;
      }
    }

    this.layoutManager.render();
  }

  /**
   * Sets a new theme by name
   */
  public setTheme(themeName: string): boolean {
    if (!this.themes.has(themeName)) {
      return false;
    }

    this.currentTheme = themeName;
    this.applyCurrentTheme();
    return true;
  }

  /**
   * Gets the current theme name
   */
  public getCurrentTheme(): string {
    return this.currentTheme;
  }

  /**
   * Gets all available theme names
   */
  public getAvailableThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Creates a themed text element
   */
  public themedText(
    content: string,
    styleType: 'default' | 'highlight' | 'success' | 'warning' | 'error' = 'default'
  ): string {
    const theme = this.themes.get(this.currentTheme);
    if (!theme) {
      return content;
    }

    const style = theme[styleType];
    if (!style) {
      return content;
    }

    // Using blessed formatting tags
    let formatted = content;
    if (style.fg) {
      formatted = `{${style.fg}}${formatted}{/${style.fg}}`;
    }
    if (style.bg) {
      formatted = `{${style.bg}-bg}${formatted}{/bg}`;
    }

    return formatted;
  }

  /**
   * Updates status information with themed output
   */
  public updateStatus(
    content: string,
    styleType: 'default' | 'highlight' | 'success' | 'warning' | 'error' = 'default'
  ): void {
    const themedContent = this.themedText(content, styleType);
    this.layoutManager.updateHeaderStatus(themedContent);
  }
}
