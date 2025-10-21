/**
 * Screen.ts
 *
 * A wrapper around blessed screen functionality for consistent screen management
 * in the AIrchitect CLI TUI system.
 */

import * as blessed from 'blessed';

export interface ScreenOptions extends blessed.Widgets.IScreenOptions {
  title?: string;
  width?: string | number;
  height?: string | number;
  theme?: 'default' | 'dark' | 'light';
}

export class Screen {
  protected screen: blessed.Widgets.Screen;
  private initialized: boolean;

  constructor(options: ScreenOptions = {}) {
    this.screen = blessed.screen({
      smartCSR: true,
      title: options.title || 'AIrchitect CLI',
      fullUnicode: true,
      dockBorders: false,
      ignoreLocked: ['mouse'],
      ...options,
    });

    this.initialized = false;
  }

  /**
   * Initialize screen settings and event handlers
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    // Set up the theme
    this.setTheme();

    // Set up event handlers
    this.setupEventHandlers();

    this.initialized = true;
  }

  /**
   * Set the screen theme
   */
  private setTheme(): void {
    // Default theme settings
    (this.screen as any).setTheme({
      fg: 'white',
      bg: 'black',
      bold: 'white',
      focus: {
        border: {
          fg: 'green',
        },
      },
    });
  }

  /**
   * Set up common event handlers
   */
  private setupEventHandlers(): void {
    // Handle exit on escape or control+c
    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });

    // Handle window resize
    this.screen.on('resize', () => {
      this.render();
    });
  }

  /**
   * Append a widget to the screen
   */
  public append(widget: blessed.Widgets.BlessedElement): void {
    this.screen.append(widget);
  }

  /**
   * Remove a widget from the screen
   */
  public remove(widget: blessed.Widgets.BlessedElement): void {
    this.screen.remove(widget);
  }

  /**
   * Render the screen
   */
  public render(): void {
    this.screen.render();
  }

  /**
   * Clear the screen
   */
  public clear(): void {
    this.screen.clear();
    this.render();
  }

  /**
   * Destroy the screen and clean up resources
   */
  public destroy(): void {
    this.screen.destroy();
  }

  /**
   * Focus on a specific element
   */
  public focusElement(element: blessed.Widgets.BlessedElement): void {
    element.focus();
    this.render();
  }

  /**
   * Get the underlying blessed screen instance
   */
  public getBlessedScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Get screen dimensions
   */
  public getDimensions(): { width: number; height: number } {
    return {
      width: this.screen.width,
      height: this.screen.height,
    };
  }

  /**
   * Show a message box
   */
  public showMessageBox(
    text: string,
    options?: {
      title?: string;
      height?: number;
      width?: number;
    }
  ): Promise<void> {
    const boxOptions = {
      top: 'center',
      left: 'center',
      width: options?.width || 50,
      height: options?.height || 10,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
      content: text,
      ...options,
    };

    const messageBox = blessed.box(boxOptions);
    this.append(messageBox);

    // Auto-remove after delay
    return new Promise((resolve) => {
      setTimeout(() => {
        this.remove(messageBox);
        this.render();
        resolve();
      }, 3000);
    });
  }

  /**
   * Show a loading indicator
   */
  public showLoading(text: string = 'Loading...'): blessed.Widgets.LoadingElement {
    const loading = blessed.loading({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 20,
      height: 5,
      tags: true,
      content: text,
    });

    loading.load(text);
    this.render();

    return loading;
  }

  /**
   * Hide loading indicator
   */
  public hideLoading(loading: blessed.Widgets.LoadingElement): void {
    loading.stop();
    this.remove(loading as any as blessed.Widgets.BlessedElement);
    this.render();
  }

  /**
   * Get a list of all elements on the screen
   */
  public getElements(): blessed.Widgets.BlessedElement[] {
    return this.screen.children as blessed.Widgets.BlessedElement[];
  }

  /**
   * Check if the screen has been initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}
