/**
 * Main Content Panel Component
 * Scrollable content area with syntax highlighting and search
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { getThemeManager } from '../theme';

/**
 * Main panel configuration
 */
export interface MainPanelOptions {
  top: number;
  height: number | string;
  scrollable?: boolean;
  alwaysScroll?: boolean;
  scrollbar?: boolean;
  mouse?: boolean;
  keys?: boolean;
}

/**
 * Main content panel
 */
export class MainPanel {
  private box: Widgets.BoxElement;
  private screen: Widgets.Screen;
  private content: string;
  private searchTerm: string | null = null;
  private searchMatches: number[] = [];
  private currentMatch: number = 0;

  constructor(screen: Widgets.Screen, options: MainPanelOptions) {
    this.screen = screen;
    this.content = '';

    const theme = getThemeManager();
    const style = theme.getStyle('panel');

    this.box = blessed.box({
      parent: screen,
      top: options.top,
      left: 0,
      width: '100%',
      height: options.height,
      content: '',
      tags: true,
      scrollable: options.scrollable !== false,
      alwaysScroll: options.alwaysScroll !== false,
      scrollbar:
        options.scrollbar !== false
          ? {
              ch: '█',
              track: {
                bg: 'gray',
              },
              style: {
                bg: theme.getColor('primary'),
              },
            }
          : undefined,
      mouse: options.mouse !== false,
      keys: options.keys !== false,
      vi: true,
      style: {
        fg: style.fg,
        bg: style.bg,
        border: style.border
          ? {
              fg: style.border.fg,
            }
          : undefined,
        scrollbar: {
          bg: theme.getColor('primary'),
        },
      },
      border: style.border
        ? {
            type: 'line',
          }
        : undefined,
    });

    // Listen for theme changes
    theme.onChange(() => this.applyTheme());

    // Setup keyboard handlers
    this.setupKeyHandlers();
  }

  /**
   * Set panel content
   */
  public setContent(content: string): void {
    this.content = content;
    this.updateDisplay();
  }

  /**
   * Append content to panel
   */
  public append(content: string): void {
    this.content += content;
    this.updateDisplay();
    this.scrollToBottom();
  }

  /**
   * Prepend content to panel
   */
  public prepend(content: string): void {
    this.content = content + this.content;
    this.updateDisplay();
  }

  /**
   * Clear panel content
   */
  public clear(): void {
    this.content = '';
    this.clearSearch();
    this.updateDisplay();
  }

  /**
   * Get current content
   */
  public getContent(): string {
    return this.content;
  }

  /**
   * Search for text in content
   */
  public search(term: string): void {
    if (!term) {
      this.clearSearch();
      return;
    }

    this.searchTerm = term;
    this.searchMatches = [];
    this.currentMatch = 0;

    const lines = this.content.split('\n');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(term.toLowerCase())) {
        this.searchMatches.push(index);
      }
    });

    if (this.searchMatches.length > 0) {
      this.scrollToLine(this.searchMatches[0] ?? 0);
    }

    this.updateDisplay();
  }

  /**
   * Go to next search match
   */
  public nextMatch(): void {
    if (this.searchMatches.length === 0) {return;}

    this.currentMatch = (this.currentMatch + 1) % this.searchMatches.length;
    this.scrollToLine(this.searchMatches[this.currentMatch] ?? 0);
    this.updateDisplay();
  }

  /**
   * Go to previous search match
   */
  public previousMatch(): void {
    if (this.searchMatches.length === 0) {return;}

    this.currentMatch =
      (this.currentMatch - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.scrollToLine(this.searchMatches[this.currentMatch] ?? 0);
    this.updateDisplay();
  }

  /**
   * Clear search
   */
  public clearSearch(): void {
    this.searchTerm = null;
    this.searchMatches = [];
    this.currentMatch = 0;
    this.updateDisplay();
  }

  /**
   * Get search info
   */
  public getSearchInfo(): { term: string | null; matches: number; current: number } {
    return {
      term: this.searchTerm,
      matches: this.searchMatches.length,
      current: this.currentMatch,
    };
  }

  /**
   * Update the display with highlighting
   */
  private updateDisplay(): void {
    let displayContent = this.content;

    // Apply search highlighting
    if (this.searchTerm) {
      const lines = displayContent.split('\n');
      displayContent = lines
        .map((line, index) => {
          if (this.searchMatches.includes(index)) {
            const regex = new RegExp(`(${this.escapeRegex(this.searchTerm!)})`, 'gi');
            const isCurrentMatch = this.searchMatches[this.currentMatch] === index;
            const highlightColor = isCurrentMatch ? 'yellow' : 'cyan';
            return line.replace(
              regex,
              `{${highlightColor}-fg}{bold}$1{/bold}{/${highlightColor}-fg}`
            );
          }
          return line;
        })
        .join('\n');
    }

    this.box.setContent(displayContent);
    this.screen.render();
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Scroll to specific line
   */
  public scrollToLine(line: number): void {
    this.box.setScrollPerc(0);
    for (let i = 0; i < line; i++) {
      this.box.scroll(1);
    }
    this.screen.render();
  }

  /**
   * Scroll to top
   */
  public scrollToTop(): void {
    this.box.setScrollPerc(0);
    this.screen.render();
  }

  /**
   * Scroll to bottom
   */
  public scrollToBottom(): void {
    this.box.setScrollPerc(100);
    this.screen.render();
  }

  /**
   * Scroll up by lines
   */
  public scrollUp(lines: number = 1): void {
    this.box.scroll(-lines);
    this.screen.render();
  }

  /**
   * Scroll down by lines
   */
  public scrollDown(lines: number = 1): void {
    this.box.scroll(lines);
    this.screen.render();
  }

  /**
   * Page up
   */
  public pageUp(): void {
    const height = this.box.height as number;
    this.scrollUp(height - 2);
  }

  /**
   * Page down
   */
  public pageDown(): void {
    const height = this.box.height as number;
    this.scrollDown(height - 2);
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyHandlers(): void {
    // Scroll up
    this.box.key(['up', 'k'], () => {
      this.scrollUp(1);
    });

    // Scroll down
    this.box.key(['down', 'j'], () => {
      this.scrollDown(1);
    });

    // Page up
    this.box.key(['pageup', 'C-b'], () => {
      this.pageUp();
    });

    // Page down
    this.box.key(['pagedown', 'C-f'], () => {
      this.pageDown();
    });

    // Go to top
    this.box.key(['g', 'home'], () => {
      this.scrollToTop();
    });

    // Go to bottom
    this.box.key(['G', 'end'], () => {
      this.scrollToBottom();
    });

    // Next search match
    this.box.key(['n'], () => {
      this.nextMatch();
    });

    // Previous search match
    this.box.key(['N'], () => {
      this.previousMatch();
    });
  }

  /**
   * Apply theme to component
   */
  private applyTheme(): void {
    const theme = getThemeManager();
    const style = theme.getStyle('panel');

    this.box.style = {
      fg: style.fg,
      bg: style.bg,
      border: style.border
        ? {
            fg: style.border.fg,
          }
        : undefined,
      scrollbar: {
        bg: theme.getColor('primary'),
      },
    };

    this.updateDisplay();
  }

  /**
   * Focus the panel
   */
  public focus(): void {
    this.box.focus();
  }

  /**
   * Check if panel is focused
   */
  public isFocused(): boolean {
    return this.screen.focused === this.box;
  }

  /**
   * Get the blessed box element
   */
  public getElement(): Widgets.BoxElement {
    return this.box;
  }

  /**
   * Set panel border label
   */
  public setLabel(label: string): void {
    this.box.setLabel(label);
    this.screen.render();
  }

  /**
   * Get panel height
   */
  public getHeight(): number | string {
    return this.box.height;
  }

  /**
   * Set panel height
   */
  public setHeight(height: number | string): void {
    this.box.height = height;
    this.screen.render();
  }

  /**
   * Get line count
   */
  public getLineCount(): number {
    return this.content.split('\n').length;
  }

  /**
   * Get current scroll position
   */
  public getScrollPosition(): number {
    return this.box.getScrollPerc();
  }

  /**
   * Hide the panel
   */
  public hide(): void {
    this.box.hide();
    this.screen.render();
  }

  /**
   * Show the panel
   */
  public show(): void {
    this.box.show();
    this.screen.render();
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.box.destroy();
  }
}
