/**
 * Footer Command Palette Component
 * Command input with auto-completion and history
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { getThemeManager } from '../theme';

/**
 * Command suggestion
 */
export interface CommandSuggestion {
  command: string;
  description: string;
  category?: string;
}

/**
 * Footer panel with command palette
 */
export class FooterPanel {
  private box: Widgets.BoxElement;
  private input: Widgets.TextboxElement;
  private suggestionsBox: Widgets.ListElement | null = null;
  private screen: Widgets.Screen;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private suggestions: CommandSuggestion[] = [];
  private onSubmitCallback?: (command: string) => void | Promise<void>;
  private onSuggestCallback?: (partial: string) => Promise<CommandSuggestion[]>;

  constructor(screen: Widgets.Screen) {
    this.screen = screen;

    const theme = getThemeManager();
    const style = theme.getStyle('footer');

    // Create container box
    this.box = blessed.box({
      parent: screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      style: {
        fg: style.fg,
        bg: style.bg,
        border: style.border
          ? {
              fg: style.border.fg,
            }
          : undefined,
      },
      border: style.border
        ? {
            type: 'line',
          }
        : undefined,
    });

    // Create input field
    const inputStyle = theme.getStyle('input');
    this.input = blessed.textbox({
      parent: this.box,
      top: 0,
      left: 1,
      width: '100%-2',
      height: 1,
      inputOnFocus: true,
      tags: true,
      style: {
        fg: inputStyle.fg,
        bg: inputStyle.bg,
      },
    });

    // Listen for theme changes
    theme.onChange(() => this.applyTheme());

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Submit command
    this.input.on('submit', (value: string) => {
      if (value.trim()) {
        this.addToHistory(value);
        this.hideSuggestions();
        if (this.onSubmitCallback) {
          void this.onSubmitCallback(value);
        }
        this.clear();
      }
    });

    // Cancel input
    this.input.key(['escape', 'C-c'], () => {
      this.clear();
      this.hideSuggestions();
      this.blur();
    });

    // History navigation
    this.input.key(['up'], () => {
      this.navigateHistory(-1);
    });

    this.input.key(['down'], () => {
      this.navigateHistory(1);
    });

    // Auto-complete
    this.input.key(['tab'], async () => {
      await this.showSuggestions();
    });

    // Input change - update suggestions
    this.input.on('keypress', async (ch: string, key: { name: string }) => {
      if (!['up', 'down', 'tab', 'enter', 'escape'].includes(key.name)) {
        await this.updateSuggestions();
      }
    });
  }

  /**
   * Set command submit callback
   */
  public onSubmit(callback: (command: string) => void | Promise<void>): void {
    this.onSubmitCallback = callback;
  }

  /**
   * Set suggestion provider callback
   */
  public onSuggest(callback: (partial: string) => Promise<CommandSuggestion[]>): void {
    this.onSuggestCallback = callback;
  }

  /**
   * Focus the input
   */
  public focus(): void {
    this.input.focus();
    this.input.readInput();
  }

  /**
   * Blur the input
   */
  public blur(): void {
    this.input.cancel();
    this.screen.render();
  }

  /**
   * Check if input is focused
   */
  public isFocused(): boolean {
    return this.screen.focused === this.input;
  }

  /**
   * Set input value
   */
  public setValue(value: string): void {
    this.input.setValue(value);
    this.screen.render();
  }

  /**
   * Get input value
   */
  public getValue(): string {
    return this.input.getValue();
  }

  /**
   * Clear input
   */
  public clear(): void {
    this.input.clearValue();
    this.historyIndex = -1;
    this.screen.render();
  }

  /**
   * Set placeholder text
   */
  public setPlaceholder(placeholder: string): void {
    this.input.setValue(`{gray-fg}${placeholder}{/gray-fg}`);
    this.screen.render();
  }

  /**
   * Add command to history
   */
  private addToHistory(command: string): void {
    // Remove duplicates
    this.commandHistory = this.commandHistory.filter((cmd) => cmd !== command);
    // Add to beginning
    this.commandHistory.unshift(command);
    // Limit history size
    if (this.commandHistory.length > 100) {
      this.commandHistory = this.commandHistory.slice(0, 100);
    }
    this.historyIndex = -1;
  }

  /**
   * Navigate command history
   */
  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) {return;}

    this.historyIndex += direction;

    if (this.historyIndex < -1) {
      this.historyIndex = -1;
      this.clear();
      return;
    }

    if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length - 1;
    }

    if (this.historyIndex === -1) {
      this.clear();
    } else {
      const command = this.commandHistory[this.historyIndex];
      if (command) {
        this.setValue(command);
      }
    }
  }

  /**
   * Update suggestions based on input
   */
  private async updateSuggestions(): Promise<void> {
    if (!this.onSuggestCallback) {return;}

    const value = this.getValue();
    if (!value.trim()) {
      this.hideSuggestions();
      return;
    }

    this.suggestions = await this.onSuggestCallback(value);

    if (this.suggestions.length > 0) {
      await this.showSuggestions();
    } else {
      this.hideSuggestions();
    }
  }

  /**
   * Show suggestions box
   */
  private async showSuggestions(): Promise<void> {
    if (this.suggestions.length === 0) {return;}

    // Create suggestions box if it doesn't exist
    if (!this.suggestionsBox) {
      const theme = getThemeManager();
      const style = theme.getStyle('panel');

      this.suggestionsBox = blessed.list({
        parent: this.screen,
        bottom: 3,
        left: 0,
        width: '100%',
        height: Math.min(this.suggestions.length + 2, 10),
        tags: true,
        mouse: true,
        keys: true,
        vi: true,
        style: {
          fg: style.fg,
          bg: style.bg,
          selected: {
            fg: 'black',
            bg: theme.getColor('primary'),
          },
          border: style.border
            ? {
                fg: style.border.fg,
              }
            : undefined,
        },
        border: style.border
          ? {
              type: 'line',
            }
          : undefined,
      });

      // Select suggestion
      this.suggestionsBox.on('select', (item: Widgets.BlessedElement) => {
        const command = item.content.split(' - ')[0];
        if (command) {
          this.setValue(command);
          this.hideSuggestions();
          this.focus();
        }
      });
    }

    // Update suggestions list
    const items = this.suggestions.map((s) => {
      const desc = s.description ? ` - {gray-fg}${s.description}{/gray-fg}` : '';
      const cat = s.category ? ` {blue-fg}[${s.category}]{/blue-fg}` : '';
      return `{bold}${s.command}{/bold}${desc}${cat}`;
    });

    this.suggestionsBox.setItems(items);
    this.suggestionsBox.show();
    this.screen.render();
  }

  /**
   * Hide suggestions box
   */
  private hideSuggestions(): void {
    if (this.suggestionsBox) {
      this.suggestionsBox.hide();
      this.screen.render();
    }
  }

  /**
   * Get command history
   */
  public getHistory(): string[] {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  public clearHistory(): void {
    this.commandHistory = [];
    this.historyIndex = -1;
  }

  /**
   * Set command history
   */
  public setHistory(history: string[]): void {
    this.commandHistory = [...history];
    this.historyIndex = -1;
  }

  /**
   * Apply theme to component
   */
  private applyTheme(): void {
    const theme = getThemeManager();
    const style = theme.getStyle('footer');
    const inputStyle = theme.getStyle('input');

    this.box.style = {
      fg: style.fg,
      bg: style.bg,
      border: style.border
        ? {
            fg: style.border.fg,
          }
        : undefined,
    };

    this.input.style = {
      fg: inputStyle.fg,
      bg: inputStyle.bg,
    };

    if (this.suggestionsBox) {
      const panelStyle = theme.getStyle('panel');
      this.suggestionsBox.style = {
        fg: panelStyle.fg,
        bg: panelStyle.bg,
        selected: {
          fg: 'black',
          bg: theme.getColor('primary'),
        },
        border: panelStyle.border
          ? {
              fg: panelStyle.border.fg,
            }
          : undefined,
      };
    }

    this.screen.render();
  }

  /**
   * Get the blessed box element
   */
  public getElement(): Widgets.BoxElement {
    return this.box;
  }

  /**
   * Get the input element
   */
  public getInput(): Widgets.TextboxElement {
    return this.input;
  }

  /**
   * Get component height
   */
  public getHeight(): number {
    return 3;
  }

  /**
   * Hide the footer
   */
  public hide(): void {
    this.box.hide();
    this.hideSuggestions();
    this.screen.render();
  }

  /**
   * Show the footer
   */
  public show(): void {
    this.box.show();
    this.screen.render();
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    if (this.suggestionsBox) {
      this.suggestionsBox.destroy();
    }
    this.box.destroy();
  }
}
