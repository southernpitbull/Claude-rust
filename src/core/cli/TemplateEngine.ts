/**
 * TUIManager.ts
 *
 * Terminal User Interface manager for AIrchitect CLI with rich components,
 * layout management, theming, and event handling for enhanced developer experience.
 */

import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { Logger } from '../../utils/Logger';

export interface TUIConfig {
  title?: string;
  width?: string | number;
  height?: string | number;
  theme?: 'default' | 'dark' | 'light' | 'monokai' | 'solarized';
  fullscreen?: boolean;
  dockBorders?: boolean;
  ignoreLocked?: string[];
  smartCSR?: boolean;
}

export interface TUIComponent {
  id: string;
  name: string;
  type: string;
  element: blessed.Widgets.BlessedElement;
  position: {
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
  };
  options: Record<string, any>;
  visible: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TUILayout {
  id: string;
  name: string;
  description?: string;
  components: Array<{
    componentId: string;
    position: {
      top?: number | string;
      left?: number | string;
      width?: number | string;
      height?: number | string;
    };
  }>;
  rows: number;
  cols: number;
  spacing: number;
  padding: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TUITheme {
  id: string;
  name: string;
  description?: string;
  colors: {
    fg: string;
    bg: string;
    border: {
      fg: string;
    };
    focus: {
      border: {
        fg: string;
      };
    };
    hover: {
      bg: string;
    };
    scrollbar: {
      fg: string;
      bg: string;
    };
    selected: {
      fg: string;
      bg: string;
    };
    label: string;
    text: string;
    highlight: string;
  };
  styles: {
    bold: boolean;
    underline: boolean;
    italic: boolean;
  };
  borderRadius?: number;
  shadow?: boolean;
  transparency?: number; // 0-100 percentage
}

export interface TUIEvent {
  type: string;
  data?: any;
  timestamp: Date;
  source: string;
}

export class TUIManager {
  private screen: blessed.Widgets.Screen;
  private components: Map<string, TUIComponent>;
  private layouts: Map<string, TUILayout>;
  private themes: Map<string, TUITheme>;
  private currentLayout: TUILayout | null;
  private currentTheme: TUITheme;
  private eventListeners: Map<string, Array<(event: TUIEvent) => void>>;
  private logger: Logger;
  private initialized: boolean;

  constructor(config?: TUIConfig) {
    this.logger = new Logger('TUIManager');

    // Set default configuration
    const defaultConfig: TUIConfig = {
      title: 'AIrchitect CLI',
      width: '100%',
      height: '100%',
      theme: 'dark',
      fullscreen: true,
      dockBorders: false,
      ignoreLocked: ['mouse'],
      smartCSR: true,
      ...config,
    };

    // Create the blessed screen
    this.screen = blessed.screen({
      smartCSR: defaultConfig.smartCSR,
      title: defaultConfig.title,
      fullUnicode: true,
      dockBorders: defaultConfig.dockBorders,
      ignoreLocked: defaultConfig.ignoreLocked,
      ...(defaultConfig.fullscreen ? { fullscreen: true } : {}),
    });

    this.components = new Map();
    this.layouts = new Map();
    this.themes = new Map();
    this.eventListeners = new Map();
    this.currentLayout = null;
    this.currentTheme = this.getDefaultTheme(defaultConfig.theme || 'dark');
    this.initialized = false;

    // Register default themes
    this.registerDefaultThemes();

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize the TUI manager
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing TUI manager');

      if (this.initialized) {
        this.logger.warn('TUI manager already initialized');
        return;
      }

      // Apply theme
      this.applyTheme(this.currentTheme);

      // Set up default layout
      await this.setupDefaultLayout();

      // Set up event listeners
      this.setupInternalEventListeners();

      this.initialized = true;
      this.logger.info('TUI manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TUI manager', error);
      throw error;
    }
  }

  /**
   * Set up default layout
   */
  private async setupDefaultLayout(): Promise<void> {
    try {
      this.logger.info('Setting up default layout');

      // Create a default layout with header, main content, and footer
      const defaultLayout: TUILayout = {
        id: 'layout-default',
        name: 'Default Layout',
        description: 'Three-panel layout with header, main content, and footer',
        components: [],
        rows: 3,
        cols: 1,
        spacing: 1,
        padding: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.layouts.set(defaultLayout.id, defaultLayout);
      this.currentLayout = defaultLayout;

      this.logger.info('Default layout set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up default layout', error);
      throw error;
    }
  }

  /**
   * Set up internal event listeners
   */
  private setupInternalEventListeners(): void {
    try {
      this.logger.info('Setting up internal event listeners');

      // Handle exit on escape or control+c
      this.screen.key(['escape', 'q', 'C-c'], () => {
        this.emitEvent({
          type: 'exit',
          timestamp: new Date(),
          source: 'keyboard',
        });
        process.exit(0);
      });

      // Handle window resize
      this.screen.on('resize', () => {
        this.emitEvent({
          type: 'resize',
          data: {
            width: this.screen.width,
            height: this.screen.height,
          },
          timestamp: new Date(),
          source: 'window',
        });
        this.render();
      });

      this.logger.info('Internal event listeners set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up internal event listeners', error);
      throw error;
    }
  }

  /**
   * Set up global event handlers
   */
  private setupEventHandlers(): void {
    try {
      this.logger.info('Setting up global event handlers');

      // Handle process exit
      process.on('exit', () => {
        this.cleanup();
      });

      // Handle SIGINT (Ctrl+C)
      process.on('SIGINT', () => {
        this.logger.info('Received SIGINT signal');
        this.cleanup();
        process.exit(0);
      });

      // Handle SIGTERM
      process.on('SIGTERM', () => {
        this.logger.info('Received SIGTERM signal');
        this.cleanup();
        process.exit(0);
      });

      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        this.logger.error('Uncaught exception', error);
        this.cleanup();
        process.exit(1);
      });

      // Handle unhandled rejections
      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
        this.cleanup();
        process.exit(1);
      });

      this.logger.info('Global event handlers set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up global event handlers', error);
      throw error;
    }
  }

  /**
   * Clean up TUI resources
   */
  public cleanup(): void {
    try {
      this.logger.info('Cleaning up TUI resources');

      // Emit cleanup event
      this.emitEvent({
        type: 'cleanup',
        timestamp: new Date(),
        source: 'system',
      });

      // Destroy all components
      for (const component of this.components.values()) {
        try {
          if (component.element && typeof component.element.destroy === 'function') {
            component.element.destroy();
          }
        } catch (error) {
          this.logger.warn(`Failed to destroy component: ${component.name}`, error);
        }
      }

      // Clear collections
      this.components.clear();
      this.layouts.clear();
      this.themes.clear();
      this.eventListeners.clear();

      // Destroy screen
      if (this.screen && typeof this.screen.destroy === 'function') {
        this.screen.destroy();
      }

      this.initialized = false;
      this.logger.info('TUI resources cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to clean up TUI resources', error);
      throw error;
    }
  }

  /**
   * Get the blessed screen instance
   */
  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Render the TUI
   */
  public render(): void {
    try {
      this.logger.info('Rendering TUI');

      if (!this.initialized) {
        this.logger.warn('TUI not initialized, cannot render');
        return;
      }

      this.screen.render();
      this.logger.info('TUI rendered successfully');
    } catch (error) {
      this.logger.error('Failed to render TUI', error);
      throw error;
    }
  }

  /**
   * Create a component
   */
  public createComponent<T extends blessed.Widgets.BlessedElement>(
    type: string,
    options: Record<string, any> = {}
  ): T {
    try {
      this.logger.info(`Creating component of type: ${type}`);

      let element: T;

      // Create the appropriate element based on type
      switch (type.toLowerCase()) {
        case 'box':
          element = blessed.box(options) as T;
          break;

        case 'text':
          element = blessed.text(options) as T;
          break;

        case 'textarea':
          element = blessed.textarea(options) as T;
          break;

        case 'textbox':
          element = blessed.textbox(options) as T;
          break;

        case 'button':
          element = blessed.button(options) as T;
          break;

        case 'list':
          element = blessed.list(options) as T;
          break;

        case 'listtable':
          element = blessed.listtable(options) as T;
          break;

        case 'table':
          element = blessed.table(options) as T;
          break;

        case 'form':
          element = blessed.form(options) as T;
          break;

        case 'checkbox':
          element = blessed.checkbox(options) as T;
          break;

        case 'radiobutton':
          element = blessed.radiobutton(options) as T;
          break;

        case 'radioset':
          element = blessed.radioset(options) as T;
          break;

        case 'prompt':
          element = blessed.prompt(options) as T;
          break;

        case 'question':
          element = blessed.question(options) as T;
          break;

        case 'message':
          element = blessed.message(options) as T;
          break;

        case 'loading':
          element = blessed.loading(options) as T;
          break;

        case 'listbar':
          element = blessed.listbar(options) as T;
          break;

        case 'log':
          element = blessed.log(options) as T;
          break;

        case 'progressbar':
          element = blessed.progressbar(options) as T;
          break;

        case 'filemanager':
          element = blessed.filemanager(options) as T;
          break;

        case 'terminal':
          element = blessed.terminal(options) as T;
          break;

        case 'ansiimage':
          element = blessed.ansiimage(options) as T;
          break;

        case 'overlayimage':
          element = blessed.overlayimage(options) as T;
          break;

        case 'video':
          element = blessed.video(options) as T;
          break;

        case 'layout':
          element = blessed.layout(options) as T;
          break;

        case 'scrollablebox':
          element = blessed.scrollablebox(options) as T;
          break;

        case 'scrollabletext':
          element = blessed.scrollabletext(options) as T;
          break;

        case 'bigtext':
          element = blessed.bigtext(options) as T;
          break;

        case 'contrib-log':
          element = contrib.log(options) as T;
          break;

        case 'contrib-table':
          element = contrib.table(options) as T;
          break;

        case 'contrib-tree':
          element = contrib.tree(options) as T;
          break;

        case 'contrib-markdown':
          element = contrib.markdown(options) as T;
          break;

        case 'contrib-map':
          element = contrib.map(options) as T;
          break;

        case 'contrib-gauge':
          element = contrib.gauge(options) as T;
          break;

        case 'contrib-donut':
          element = contrib.donut(options) as T;
          break;

        case 'contrib-line':
          element = contrib.line(options) as T;
          break;

        case 'contrib-bar':
          element = contrib.bar(options) as T;
          break;

        case 'contrib-stacked-bar':
          element = contrib.stackedBar(options) as T;
          break;

        case 'contrib-sparkline':
          element = contrib.sparkline(options) as T;
          break;

        case 'contrib-dashboard':
          element = contrib.dashboard(options) as T;
          break;

        case 'contrib-lcd':
          element = contrib.lcd(options) as T;
          break;

        case 'contrib-clock':
          element = contrib.clock(options) as T;
          break;

        case 'contrib-grid':
          element = contrib.grid(options) as T;
          break;

        default:
          // Try to create a generic box as fallback
          element = blessed.box(options) as T;
          this.logger.warn(`Unknown component type: ${type}, created as box`);
      }

      // Add to screen
      this.screen.append(element);

      this.logger.info(`Component created successfully: ${type}`);
      return element;
    } catch (error) {
      this.logger.error(`Failed to create component: ${type}`, error);
      throw error;
    }
  }

  /**
   * Register a component
   */
  public registerComponent(component: TUIComponent): void {
    try {
      this.logger.info(`Registering component: ${component.name}`);

      this.components.set(component.id, component);

      this.logger.info(`Component registered successfully: ${component.name}`);
    } catch (error) {
      this.logger.error(`Failed to register component: ${component.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a component
   */
  public unregisterComponent(componentId: string): boolean {
    try {
      this.logger.info(`Unregistering component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      // Remove from screen
      if (component.element && typeof component.element.detach === 'function') {
        component.element.detach();
      }

      // Destroy the element
      if (component.element && typeof component.element.destroy === 'function') {
        component.element.destroy();
      }

      const deleted = this.components.delete(componentId);
      if (deleted) {
        this.logger.info(`Component unregistered successfully: ${component.name}`);
      } else {
        this.logger.warn(`Failed to unregister component: ${component.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Get a component by ID
   */
  public getComponent<T extends blessed.Widgets.BlessedElement>(
    componentId: string
  ): T | undefined {
    const component = this.components.get(componentId);
    return component ? (component.element as T) : undefined;
  }

  /**
   * Get all components
   */
  public getAllComponents(): TUIComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Show a component
   */
  public showComponent(componentId: string): boolean {
    try {
      this.logger.info(`Showing component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      if (component.element && typeof component.element.show === 'function') {
        component.element.show();
        component.visible = true;
        this.components.set(componentId, component);
        this.render();
        this.logger.info(`Component shown successfully: ${component.name}`);
        return true;
      }

      this.logger.warn(`Component element does not support show: ${component.name}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to show component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Hide a component
   */
  public hideComponent(componentId: string): boolean {
    try {
      this.logger.info(`Hiding component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      if (component.element && typeof component.element.hide === 'function') {
        component.element.hide();
        component.visible = false;
        this.components.set(componentId, component);
        this.render();
        this.logger.info(`Component hidden successfully: ${component.name}`);
        return true;
      }

      this.logger.warn(`Component element does not support hide: ${component.name}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to hide component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Enable a component
   */
  public enableComponent(componentId: string): boolean {
    try {
      this.logger.info(`Enabling component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      if (component.element && typeof component.element.enable === 'function') {
        component.element.enable();
        component.enabled = true;
        this.components.set(componentId, component);
        this.logger.info(`Component enabled successfully: ${component.name}`);
        return true;
      }

      this.logger.warn(`Component element does not support enable: ${component.name}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to enable component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Disable a component
   */
  public disableComponent(componentId: string): boolean {
    try {
      this.logger.info(`Disabling component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      if (component.element && typeof component.element.disable === 'function') {
        component.element.disable();
        component.enabled = false;
        this.components.set(componentId, component);
        this.logger.info(`Component disabled successfully: ${component.name}`);
        return true;
      }

      this.logger.warn(`Component element does not support disable: ${component.name}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to disable component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Focus a component
   */
  public focusComponent(componentId: string): boolean {
    try {
      this.logger.info(`Focusing component: ${componentId}`);

      const component = this.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      if (component.element && typeof component.element.focus === 'function') {
        component.element.focus();
        this.render();
        this.logger.info(`Component focused successfully: ${component.name}`);
        return true;
      }

      this.logger.warn(`Component element does not support focus: ${component.name}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to focus component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Register a layout
   */
  public registerLayout(layout: TUILayout): void {
    try {
      this.logger.info(`Registering layout: ${layout.name}`);

      this.layouts.set(layout.id, layout);

      this.logger.info(`Layout registered successfully: ${layout.name}`);
    } catch (error) {
      this.logger.error(`Failed to register layout: ${layout.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a layout
   */
  public unregisterLayout(layoutId: string): boolean {
    try {
      this.logger.info(`Unregistering layout: ${layoutId}`);

      const layout = this.layouts.get(layoutId);
      if (!layout) {
        this.logger.warn(`Layout not found: ${layoutId}`);
        return false;
      }

      const deleted = this.layouts.delete(layoutId);
      if (deleted) {
        this.logger.info(`Layout unregistered successfully: ${layout.name}`);
      } else {
        this.logger.warn(`Failed to unregister layout: ${layout.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister layout: ${layoutId}`, error);
      throw error;
    }
  }

  /**
   * Get a layout by ID
   */
  public getLayout(layoutId: string): TUILayout | undefined {
    return this.layouts.get(layoutId);
  }

  /**
   * Get all layouts
   */
  public getAllLayouts(): TUILayout[] {
    return Array.from(this.layouts.values());
  }

  /**
   * Apply a layout
   */
  public applyLayout(layoutId: string): boolean {
    try {
      this.logger.info(`Applying layout: ${layoutId}`);

      const layout = this.layouts.get(layoutId);
      if (!layout) {
        this.logger.warn(`Layout not found: ${layoutId}`);
        return false;
      }

      // Apply component positions
      for (const layoutComponent of layout.components) {
        const component = this.components.get(layoutComponent.componentId);
        if (component && component.element) {
          // Update component position
          Object.assign(component.element, layoutComponent.position);

          // Update component in map
          component.position = layoutComponent.position;
          this.components.set(layoutComponent.componentId, component);
        }
      }

      this.currentLayout = layout;
      this.render();

      this.logger.info(`Layout applied successfully: ${layout.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply layout: ${layoutId}`, error);
      throw error;
    }
  }

  /**
   * Register a theme
   */
  public registerTheme(theme: TUITheme): void {
    try {
      this.logger.info(`Registering theme: ${theme.name}`);

      this.themes.set(theme.id, theme);

      this.logger.info(`Theme registered successfully: ${theme.name}`);
    } catch (error) {
      this.logger.error(`Failed to register theme: ${theme.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a theme
   */
  public unregisterTheme(themeId: string): boolean {
    try {
      this.logger.info(`Unregistering theme: ${themeId}`);

      const theme = this.themes.get(themeId);
      if (!theme) {
        this.logger.warn(`Theme not found: ${themeId}`);
        return false;
      }

      const deleted = this.themes.delete(themeId);
      if (deleted) {
        this.logger.info(`Theme unregistered successfully: ${theme.name}`);
      } else {
        this.logger.warn(`Failed to unregister theme: ${theme.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister theme: ${themeId}`, error);
      throw error;
    }
  }

  /**
   * Get a theme by ID
   */
  public getTheme(themeId: string): TUITheme | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Get all themes
   */
  public getAllThemes(): TUITheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Apply a theme
   */
  public applyTheme(theme: TUITheme | string): boolean {
    try {
      this.logger.info(`Applying theme: ${typeof theme === 'string' ? theme : theme.name}`);

      // Get theme if it's an ID
      const themeObj = typeof theme === 'string' ? this.themes.get(theme) : theme;
      if (!themeObj) {
        this.logger.warn(`Theme not found: ${typeof theme === 'string' ? theme : theme.name}`);
        return false;
      }

      // Apply theme to screen
      if (this.screen) {
        const screenTheme: any = {
          fg: themeObj.colors.fg,
          bg: themeObj.colors.bg,
        };

        // Apply theme to screen if available
        if (typeof (this.screen as any).setTheme === 'function') {
          (this.screen as any).setTheme(screenTheme);
        }
      }

      this.currentTheme = themeObj;

      // Apply theme to all components
      for (const component of this.components.values()) {
        if (component.element && typeof component.element.style === 'object') {
          try {
            // Apply theme colors to component
            Object.assign(component.element.style, {
              fg: themeObj.colors.fg,
              bg: themeObj.colors.bg,
              border: themeObj.colors.border,
            });
          } catch (error) {
            this.logger.warn(`Failed to apply theme to component: ${component.name}`, error);
          }
        }
      }

      this.render();

      this.logger.info(`Theme applied successfully: ${themeObj.name}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to apply theme: ${typeof theme === 'string' ? theme : theme.name}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the default theme
   */
  private getDefaultTheme(themeName: string): TUITheme {
    try {
      this.logger.info(`Getting default theme: ${themeName}`);

      const themes: Record<string, TUITheme> = {
        dark: {
          id: 'theme-dark',
          name: 'Dark Theme',
          description: 'Default dark theme with high contrast',
          colors: {
            fg: 'white',
            bg: 'black',
            border: {
              fg: 'cyan',
            },
            focus: {
              border: {
                fg: 'green',
              },
            },
            hover: {
              bg: 'blue',
            },
            scrollbar: {
              fg: 'blue',
              bg: 'black',
            },
            selected: {
              fg: 'white',
              bg: 'blue',
            },
            label: 'white',
            text: 'white',
            highlight: 'yellow',
          },
          styles: {
            bold: true,
            underline: false,
            italic: false,
          },
          borderRadius: 2,
          shadow: true,
          transparency: 0,
        },
        light: {
          id: 'theme-light',
          name: 'Light Theme',
          description: 'Default light theme with soft colors',
          colors: {
            fg: 'black',
            bg: 'white',
            border: {
              fg: 'blue',
            },
            focus: {
              border: {
                fg: 'green',
              },
            },
            hover: {
              bg: 'lightgray',
            },
            scrollbar: {
              fg: 'gray',
              bg: 'white',
            },
            selected: {
              fg: 'white',
              bg: 'blue',
            },
            label: 'black',
            text: 'black',
            highlight: 'red',
          },
          styles: {
            bold: true,
            underline: false,
            italic: false,
          },
          borderRadius: 2,
          shadow: true,
          transparency: 0,
        },
        monokai: {
          id: 'theme-monokai',
          name: 'Monokai Theme',
          description: 'Popular dark theme inspired by Monokai',
          colors: {
            fg: '#f8f8f2',
            bg: '#272822',
            border: {
              fg: '#a6e22e',
            },
            focus: {
              border: {
                fg: '#66d9ef',
              },
            },
            hover: {
              bg: '#3e3d32',
            },
            scrollbar: {
              fg: '#ae81ff',
              bg: '#272822',
            },
            selected: {
              fg: '#f8f8f2',
              bg: '#ae81ff',
            },
            label: '#f8f8f2',
            text: '#f8f8f2',
            highlight: '#f92672',
          },
          styles: {
            bold: true,
            underline: false,
            italic: false,
          },
          borderRadius: 2,
          shadow: true,
          transparency: 0,
        },
        solarized: {
          id: 'theme-solarized',
          name: 'Solarized Theme',
          description: 'Theme based on Solarized color scheme',
          colors: {
            fg: '#839496',
            bg: '#002b36',
            border: {
              fg: '#2aa198',
            },
            focus: {
              border: {
                fg: '#268bd2',
              },
            },
            hover: {
              bg: '#073642',
            },
            scrollbar: {
              fg: '#b58900',
              bg: '#002b36',
            },
            selected: {
              fg: '#eee8d5',
              bg: '#586e75',
            },
            label: '#839496',
            text: '#839496',
            highlight: '#cb4b16',
          },
          styles: {
            bold: true,
            underline: false,
            italic: false,
          },
          borderRadius: 2,
          shadow: true,
          transparency: 0,
        },
      };

      const theme = themes[themeName.toLowerCase()] || themes['dark'];

      this.logger.info(`Default theme retrieved: ${theme.name}`);
      return theme;
    } catch (error) {
      this.logger.error(`Failed to get default theme: ${themeName}`, error);
      throw error;
    }
  }

  /**
   * Register default themes
   */
  private registerDefaultThemes(): void {
    try {
      this.logger.info('Registering default themes');

      const defaultTheme = this.getDefaultTheme('dark');
      this.themes.set(defaultTheme.id, defaultTheme);

      const lightTheme = this.getDefaultTheme('light');
      this.themes.set(lightTheme.id, lightTheme);

      const monokaiTheme = this.getDefaultTheme('monokai');
      this.themes.set(monokaiTheme.id, monokaiTheme);

      const solarizedTheme = this.getDefaultTheme('solarized');
      this.themes.set(solarizedTheme.id, solarizedTheme);

      this.logger.info('Default themes registered');
    } catch (error) {
      this.logger.error('Failed to register default themes', error);
      throw error;
    }
  }

  /**
   * Add an event listener
   */
  public addEventListener(eventType: string, listener: (event: TUIEvent) => void): void {
    try {
      this.logger.info(`Adding event listener for: ${eventType}`);

      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }

      const listeners = this.eventListeners.get(eventType)!;
      listeners.push(listener);
      this.eventListeners.set(eventType, listeners);

      this.logger.info(`Event listener added for: ${eventType}`);
    } catch (error) {
      this.logger.error(`Failed to add event listener for: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(eventType: string, listener: (event: TUIEvent) => void): boolean {
    try {
      this.logger.info(`Removing event listener for: ${eventType}`);

      const listeners = this.eventListeners.get(eventType);
      if (!listeners) {
        this.logger.warn(`No event listeners found for: ${eventType}`);
        return false;
      }

      const initialLength = listeners.length;
      const filteredListeners = listeners.filter((l) => l !== listener);
      const removed = filteredListeners.length < initialLength;

      if (removed) {
        this.eventListeners.set(eventType, filteredListeners);
        this.logger.info(`Event listener removed for: ${eventType}`);
      } else {
        this.logger.warn(`Event listener not found for: ${eventType}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove event listener for: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * Emit an event
   */
  public emitEvent(event: TUIEvent): void {
    try {
      this.logger.info(`Emitting event: ${event.type}`);

      const listeners = this.eventListeners.get(event.type);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(event);
          } catch (error) {
            this.logger.error(`Error in event listener for: ${event.type}`, error);
          }
        }
      }

      this.logger.info(`Event emitted: ${event.type}`);
    } catch (error) {
      this.logger.error(`Failed to emit event: ${event.type}`, error);
      throw error;
    }
  }

  /**
   * Process functions in template
   */
  private processFunctions(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing functions');

      let processed = template;

      // Process function calls (e.g., {{functionName(arg1, arg2)}})
      const functionRegex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = functionRegex.exec(processed)) !== null) {
        const fullMatch = match[0];
        const expression = match[1].trim();

        // Check if it's a function call (contains parentheses)
        if (expression.includes('(') && expression.includes(')')) {
          try {
            const result = this.evaluateFunctionExpression(expression, context);
            const stringValue = result !== null && result !== undefined ? String(result) : '';
            processed = processed.replace(fullMatch, stringValue);
          } catch (error) {
            this.logger.error(`Failed to evaluate function: ${expression}`, error);
            processed = processed.replace(
              fullMatch,
              `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
            );
          }
        }
      }

      this.logger.info('Functions processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process functions', error);
      throw error;
    }
  }

  /**
   * Evaluate a function expression
   */
  private evaluateFunctionExpression(expression: string, context: TemplateContext): any {
    try {
      this.logger.info(`Evaluating function expression: ${expression}`);

      // Parse function name and arguments
      const functionMatch = expression.match(/^(\w+)\((.*)\)$/);
      if (!functionMatch) {
        throw new Error(`Invalid function expression: ${expression}`);
      }

      const functionName = functionMatch[1];
      const argsString = functionMatch[2];

      // Parse arguments
      const args = this.parseFunctionArguments(argsString, context);

      // Find and execute the function
      const func = this.functions.get(functionName);
      if (!func) {
        throw new Error(`Function not found: ${functionName}`);
      }

      const result = func.func(...args);
      this.logger.info(`Function executed successfully: ${functionName}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to evaluate function expression: ${expression}`, error);
      throw error;
    }
  }

  /**
   * Parse function arguments
   */
  private parseFunctionArguments(argsString: string, context: TemplateContext): any[] {
    try {
      this.logger.info(`Parsing function arguments: ${argsString}`);

      if (!argsString.trim()) {
        return [];
      }

      // Split arguments by comma, respecting nested structures
      const args: string[] = [];
      let currentArg = '';
      let inQuotes = false;
      let quoteChar = '';
      let parenDepth = 0;

      for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];

        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = '';
        } else if (char === '(' && !inQuotes) {
          parenDepth++;
        } else if (char === ')' && !inQuotes) {
          parenDepth--;
        } else if (char === ',' && !inQuotes && parenDepth === 0) {
          args.push(currentArg.trim());
          currentArg = '';
          continue;
        }

        currentArg += char;
      }

      // Add the last argument
      if (currentArg.trim()) {
        args.push(currentArg.trim());
      }

      // Evaluate each argument
      const evaluatedArgs = args.map((arg) => this.evaluateArgument(arg, context));

      this.logger.info(`Parsed ${evaluatedArgs.length} function arguments`);
      return evaluatedArgs;
    } catch (error) {
      this.logger.error(`Failed to parse function arguments: ${argsString}`, error);
      throw error;
    }
  }

  /**
   * Evaluate an argument
   */
  private evaluateArgument(arg: string, context: TemplateContext): any {
    try {
      this.logger.info(`Evaluating argument: ${arg}`);

      // Handle string literals
      if (
        (arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))
      ) {
        return arg.slice(1, -1);
      }

      // Handle numbers
      if (/^-?\d+(\.\d+)?$/.test(arg)) {
        return Number(arg);
      }

      // Handle booleans
      if (arg.toLowerCase() === 'true') {
        return true;
      }

      if (arg.toLowerCase() === 'false') {
        return false;
      }

      // Handle null/undefined
      if (arg.toLowerCase() === 'null') {
        return null;
      }

      if (arg.toLowerCase() === 'undefined') {
        return undefined;
      }

      // Handle variables using dot notation
      if (arg.includes('.')) {
        const parts = arg.split('.');
        let currentValue: any = context;

        for (const part of parts) {
          if (currentValue && typeof currentValue === 'object') {
            currentValue = currentValue[part];
          } else {
            return undefined;
          }
        }

        return currentValue;
      }

      // Handle simple variable access
      switch (arg) {
        case 'issue':
          return context.issue;
        case 'user':
          return context.user;
        case 'team':
          return context.team;
        case 'environment':
          return context.environment;
        case 'currentDate':
          return context.environment.currentDate;
        case 'currentTime':
          return context.environment.currentTime;
        default:
          // Check custom variables
          if (context.custom && context.custom.hasOwnProperty(arg)) {
            return context.custom[arg];
          }

          return arg;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate argument: ${arg}`, error);
      throw error;
    }
  }

  /**
   * Process filters in template
   */
  private processFilters(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing filters');

      let processed = template;

      // Process filters (e.g., {{variable|filter}} or {{variable|filter(arg1, arg2)}})
      const filterRegex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = filterRegex.exec(processed)) !== null) {
        const fullMatch = match[0];
        const expression = match[1].trim();

        // Check if it contains a filter (pipe)
        if (expression.includes('|')) {
          try {
            const result = this.evaluateFilterExpression(expression, context);
            const stringValue = result !== null && result !== undefined ? String(result) : '';
            processed = processed.replace(fullMatch, stringValue);
          } catch (error) {
            this.logger.error(`Failed to evaluate filter: ${expression}`, error);
            processed = processed.replace(
              fullMatch,
              `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
            );
          }
        }
      }

      this.logger.info('Filters processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process filters', error);
      throw error;
    }
  }

  /**
   * Evaluate a filter expression
   */
  private evaluateFilterExpression(expression: string, context: TemplateContext): any {
    try {
      this.logger.info(`Evaluating filter expression: ${expression}`);

      // Split by pipes
      const parts = expression.split('|').map((part) => part.trim());
      const variableExpression = parts[0];
      const filters = parts.slice(1);

      // Evaluate the variable first
      let value = this.evaluateVariableExpression(variableExpression, context);

      // Apply each filter
      for (const filterPart of filters) {
        // Parse filter name and arguments
        const filterMatch = filterPart.match(/^(\w+)(?:\((.*)\))?$/);
        if (!filterMatch) {
          throw new Error(`Invalid filter expression: ${filterPart}`);
        }

        const filterName = filterMatch[1];
        const argsString = filterMatch[2] || '';

        // Parse filter arguments
        const filterArgs = argsString ? this.parseFunctionArguments(argsString, context) : [];

        // Apply the filter
        value = this.applyFilter(filterName, value, ...filterArgs);
      }

      this.logger.info(`Filter expression evaluated successfully: ${expression}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to evaluate filter expression: ${expression}`, error);
      throw error;
    }
  }

  /**
   * Apply a filter to a value
   */
  private applyFilter(filterName: string, value: any, ...args: any[]): any {
    try {
      this.logger.info(`Applying filter: ${filterName}`);

      const filter = this.filters.get(filterName);
      if (!filter) {
        throw new Error(`Filter not found: ${filterName}`);
      }

      const result = filter.func(value, ...args);

      this.logger.info(`Filter applied successfully: ${filterName}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to apply filter: ${filterName}`, error);
      throw error;
    }
  }

  /**
   * Process loops in template
   */
  private processLoops(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing loops');

      let processed = template;

      // Process for loops ({% for item in collection %}...{% endfor %})
      const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+([^%}]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;
      let match;

      while ((match = loopRegex.exec(processed)) !== null) {
        const fullMatch = match[0];
        const variableName = match[1].trim();
        const collectionExpression = match[2].trim();
        const loopContent = match[3];

        try {
          // Evaluate the collection
          const collection = this.evaluateVariableExpression(collectionExpression, context);

          if (Array.isArray(collection)) {
            // Process each item in the collection
            let loopResult = '';

            for (const item of collection) {
              // Create a new context with the current item
              const loopContext = {
                ...context,
                custom: {
                  ...context.custom,
                  [variableName]: item,
                },
              };

              // Process the loop content with the item
              const itemContent = this.processTemplateContent(loopContent, loopContext);
              loopResult += itemContent;
            }

            // Replace the loop with the result
            processed = processed.replace(fullMatch, loopResult);
          } else {
            // Not an array, remove the loop
            processed = processed.replace(fullMatch, '');
          }
        } catch (error) {
          this.logger.error(`Failed to process loop: ${collectionExpression}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Loops processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process loops', error);
      throw error;
    }
  }

  /**
   * Process conditions in template
   */
  private processConditions(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing conditions');

      let processed = template;

      // Process if conditions ({% if condition %}...{% endif %})
      const conditionRegex =
        /\{%\s*if\s+([^%}]+)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g;
      let match;

      while ((match = conditionRegex.exec(processed)) !== null) {
        const fullMatch = match[0];
        const conditionExpression = match[1].trim();
        const trueContent = match[2] || '';
        const falseContent = match[3] || '';

        try {
          // Evaluate the condition
          const conditionResult = this.evaluateConditionExpression(conditionExpression, context);

          if (conditionResult) {
            // Include the true content
            const trueResult = this.processTemplateContent(trueContent, context);
            processed = processed.replace(fullMatch, trueResult);
          } else {
            // Include the false content
            const falseResult = this.processTemplateContent(falseContent, context);
            processed = processed.replace(fullMatch, falseResult);
          }
        } catch (error) {
          this.logger.error(`Failed to evaluate condition: ${conditionExpression}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Conditions processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process conditions', error);
      throw error;
    }
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateConditionExpression(expression: string, context: TemplateContext): boolean {
    try {
      this.logger.info(`Evaluating condition expression: ${expression}`);

      // Handle simple equality comparisons
      if (expression.includes('==')) {
        const [left, right] = expression.split('==').map((part) => part.trim());
        const leftValue = this.evaluateVariableExpression(left, context);
        const rightValue = this.evaluateVariableExpression(right, context);
        return leftValue == rightValue; // Allow type coercion
      }

      if (expression.includes('!=')) {
        const [left, right] = expression.split('!=').map((part) => part.trim());
        const leftValue = this.evaluateVariableExpression(left, context);
        const rightValue = this.evaluateVariableExpression(right, context);
        return leftValue != rightValue; // Allow type coercion
      }

      if (expression.includes('>=')) {
        const [left, right] = expression.split('>=').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue >= rightValue;
      }

      if (expression.includes('<=')) {
        const [left, right] = expression.split('<=').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue <= rightValue;
      }

      if (expression.includes('>')) {
        const [left, right] = expression.split('>').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue > rightValue;
      }

      if (expression.includes('<')) {
        const [left, right] = expression.split('<').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue < rightValue;
      }

      // Handle simple truthiness check
      const value = this.evaluateVariableExpression(expression, context);
      return !!value;
    } catch (error) {
      this.logger.error(`Failed to evaluate condition expression: ${expression}`, error);
      throw error;
    }
  }

  /**
   * Process template content recursively
   */
  private processTemplateContent(content: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing template content');

      // Process functions
      content = this.processFunctions(content, context);

      // Process filters
      content = this.processFilters(content, context);

      // Process loops
      content = this.processLoops(content, context);

      // Process conditions
      content = this.processConditions(content, context);

      // Process variables
      content = this.processVariables(content, context);

      this.logger.info('Template content processed');
      return content;
    } catch (error) {
      this.logger.error('Failed to process template content', error);
      throw error;
    }
  }

  /**
   * Get template engine statistics
   */
  public getTemplateStats(): {
    totalComponents: number;
    totalLayouts: number;
    totalThemes: number;
    totalFilters: number;
    totalFunctions: number;
    totalEventListeners: number;
    currentTheme: string;
    currentLayout: string | null;
    mostUsedComponents: Array<{ component: TUIComponent; usage: number }>;
    performanceStats: {
      averageRenderTime: number;
      slowestComponent: { componentId: string; renderTime: number } | null;
      fastestComponent: { componentId: string; renderTime: number } | null;
    };
  } {
    try {
      this.logger.info('Generating template engine statistics');

      const stats = {
        totalComponents: this.components.size,
        totalLayouts: this.layouts.size,
        totalThemes: this.themes.size,
        totalFilters: this.filters.size,
        totalFunctions: this.functions.size,
        totalEventListeners: Array.from(this.eventListeners.values()).reduce(
          (sum, listeners) => sum + listeners.length,
          0
        ),
        currentTheme: this.currentTheme.name,
        currentLayout: this.currentLayout ? this.currentLayout.name : null,
        mostUsedComponents: [] as Array<{ component: TUIComponent; usage: number }>,
        performanceStats: {
          averageRenderTime: 0,
          slowestComponent: null as { componentId: string; renderTime: number } | null,
          fastestComponent: null as { componentId: string; renderTime: number } | null,
        },
      };

      // Find most used components (based on usage count)
      const components = Array.from(this.components.values());
      const sortedComponents = [...components].sort((a, b) => b.usageCount - a.usageCount);
      stats.mostUsedComponents = sortedComponents.slice(0, 10).map((component) => ({
        component,
        usage: component.usageCount,
      }));

      // Calculate performance statistics
      // In a real implementation, we'd track actual render times
      stats.performanceStats.averageRenderTime = 0;
      stats.performanceStats.slowestComponent = null;
      stats.performanceStats.fastestComponent = null;

      this.logger.info('Template engine statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate template engine statistics', error);
      throw error;
    }
  }

  /**
   * Find optimization opportunities
   */
  public findOptimizationOpportunities(): Array<{
    type: 'component' | 'layout' | 'theme' | 'filter' | 'function' | 'event';
    id: string;
    name: string;
    suggestion: string;
    confidence: number; // 0-100 percentage
    estimatedPerformanceGain: number; // ms
  }> {
    try {
      this.logger.info('Finding optimization opportunities');

      const opportunities: Array<{
        type: 'component' | 'layout' | 'theme' | 'filter' | 'function' | 'event';
        id: string;
        name: string;
        suggestion: string;
        confidence: number;
        estimatedPerformanceGain: number;
      }> = [];

      // Find unused components
      const components = Array.from(this.components.values());
      const unusedComponents = components.filter((c) => c.usageCount === 0);

      for (const component of unusedComponents) {
        opportunities.push({
          type: 'component',
          id: component.id,
          name: component.name,
          suggestion: `Component has never been used. Consider removing it.`,
          confidence: 90,
          estimatedPerformanceGain: 5, // ms
        });
      }

      // Find unused layouts
      const layouts = Array.from(this.layouts.values());
      const unusedLayouts = layouts.filter((l) => l.usageCount === 0);

      for (const layout of unusedLayouts) {
        opportunities.push({
          type: 'layout',
          id: layout.id,
          name: layout.name,
          suggestion: `Layout has never been used. Consider removing it.`,
          confidence: 85,
          estimatedPerformanceGain: 2, // ms
        });
      }

      // Find unused themes
      const themes = Array.from(this.themes.values());
      const unusedThemes = themes.filter((t) => t.usageCount === 0);

      for (const theme of unusedThemes) {
        opportunities.push({
          type: 'theme',
          id: theme.id,
          name: theme.name,
          suggestion: `Theme has never been used. Consider removing it.`,
          confidence: 80,
          estimatedPerformanceGain: 1, // ms
        });
      }

      // Find slow components (if we had performance tracking)
      // In a real implementation, we'd look for components with high render times

      // Sort by confidence (highest first)
      opportunities.sort((a, b) => b.confidence - a.confidence);

      this.logger.info(`Found ${opportunities.length} optimization opportunities`);
      return opportunities;
    } catch (error) {
      this.logger.error('Failed to find optimization opportunities', error);
      throw error;
    }
  }

  /**
   * Export template engine configuration
   */
  public exportConfiguration(): {
    components: TUIComponent[];
    layouts: TUILayout[];
    themes: TUITheme[];
    filters: TemplateFilter[];
    functions: TemplateFunction[];
  } {
    try {
      this.logger.info('Exporting template engine configuration');

      const config = {
        components: Array.from(this.components.values()),
        layouts: Array.from(this.layouts.values()),
        themes: Array.from(this.themes.values()),
        filters: Array.from(this.filters.values()),
        functions: Array.from(this.functions.values()),
      };

      this.logger.info('Template engine configuration exported successfully');
      return config;
    } catch (error) {
      this.logger.error('Failed to export template engine configuration', error);
      throw error;
    }
  }

  /**
   * Import template engine configuration
   */
  public importConfiguration(config: {
    components: TUIComponent[];
    layouts: TUILayout[];
    themes: TUITheme[];
    filters: TemplateFilter[];
    functions: TemplateFunction[];
  }): void {
    try {
      this.logger.info('Importing template engine configuration');

      // Clear existing configuration
      this.components.clear();
      this.layouts.clear();
      this.themes.clear();
      this.filters.clear();
      this.functions.clear();

      // Import components
      for (const component of config.components) {
        try {
          this.components.set(component.id, component);
        } catch (error) {
          this.logger.error(`Failed to import component: ${component.name}`, error);
        }
      }

      // Import layouts
      for (const layout of config.layouts) {
        try {
          this.layouts.set(layout.id, layout);
        } catch (error) {
          this.logger.error(`Failed to import layout: ${layout.name}`, error);
        }
      }

      // Import themes
      for (const theme of config.themes) {
        try {
          this.themes.set(theme.id, theme);
        } catch (error) {
          this.logger.error(`Failed to import theme: ${theme.name}`, error);
        }
      }

      // Import filters
      for (const filter of config.filters) {
        try {
          this.filters.set(filter.name, filter);
        } catch (error) {
          this.logger.error(`Failed to import filter: ${filter.name}`, error);
        }
      }

      // Import functions
      for (const func of config.functions) {
        try {
          this.functions.set(func.name, func);
        } catch (error) {
          this.logger.error(`Failed to import function: ${func.name}`, error);
        }
      }

      this.logger.info('Template engine configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import template engine configuration', error);
      throw error;
    }
  }

  /**
   * Create a test template
   */
  public createTestTemplate(): string {
    try {
      this.logger.info('Creating test template');

      const testTemplate = `
# AIrchitect Test Template

## Issue Information
- Title: {{issue.title}}
- Description: {{issue.description|truncate(100)}}
- State: {{issue.state.name}}
- Priority: {{issue.priority|upper}}
- Assignee: {{issue.assignee.name}}
- Created: {{issue.createdAt|date}}

## User Information
- Name: {{user.name}}
- Email: {{user.email}}
- Role: {{user.role|default('Developer')}}

## Team Information
{% if team %}
- Team Name: {{team.name}}
- Team Key: {{team.key}}
{% else %}
- No team assigned
{% endif %}

## Environment
- Current Date: {{environment.currentDate}}
- Current Time: {{environment.currentTime}}
- Timezone: {{environment.timezone}}

## Custom Variables
{% for item in custom.items %}
- Item: {{item.name}} ({{item.value}})
{% endfor %}

## Examples
- Uppercased Title: {{issue.title|upper}}
- Capitalized Team Name: {{team.name|capitalize}}
- Currency Amount: {{custom.amount|currency('$')}}
- Percentage Value: {{custom.percentage|percent(1)}}

## Function Calls
- Current Time: {{now()}}
- Random Number: {{random(1, 100)}}

Generated on: {{now()|datetime}}
      `.trim();

      this.logger.info('Test template created successfully');
      return testTemplate;
    } catch (error) {
      this.logger.error('Failed to create test template', error);
      throw error;
    }
  }

  /**
   * Test template rendering with sample data
   */
  public async testRendering(): Promise<{
    success: boolean;
    renderedTemplate?: string;
    errors: string[];
  }> {
    try {
      this.logger.info('Testing template rendering');

      // Create test context
      const testContext: TemplateContext = {
        issue: {
          id: 'test-issue-123',
          title: 'Test Issue Title',
          description: 'This is a test issue description that is quite long to test truncation.',
          state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
          priority: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: 'https://linear.app/test-issue',
          identifier: 'TEST-1',
          number: 1,
          creator: { id: 'user-1', name: 'Test Creator', email: 'creator@test.com' },
          assignee: { id: 'user-2', name: 'Test Assignee', email: 'assignee@test.com' },
          team: { id: 'team-1', name: 'Test Team', key: 'TEAM' },
        },
        user: {
          id: 'current-user-456',
          name: 'Current User',
          email: 'current@test.com',
          role: 'Developer',
        },
        team: {
          id: 'team-1',
          name: 'Test Team',
          key: 'TEAM',
        },
        environment: {
          currentDate: new Date().toISOString().split('T')[0],
          currentTime: new Date().toISOString().split('T')[1].split('.')[0],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: Date.now(),
        },
        custom: {
          amount: 123.45,
          percentage: 0.75,
          items: [
            { name: 'Item 1', value: 'Value 1' },
            { name: 'Item 2', value: 'Value 2' },
          ],
        },
      };

      // Create test template
      const template = this.createTestTemplate();

      // Render the template
      const renderedTemplate = await this.render(template, testContext);

      this.logger.info('Template rendering test completed successfully');
      return {
        success: true,
        renderedTemplate,
        errors: [],
      };
    } catch (error) {
      this.logger.error('Failed to test template rendering', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create a component with fluent API
   */
  public componentBuilder<T extends blessed.Widgets.BlessedElement>(
    type: string,
    options: Record<string, any> = {}
  ): ComponentBuilder<T> {
    return new ComponentBuilder<T>(this, type, options);
  }

  /**
   * Create a layout with fluent API
   */
  public layoutManager(): LayoutManager {
    return new LayoutManager(this);
  }

  /**
   * Create a theme with fluent API
   */
  public themeBuilder(name: string): ThemeBuilder {
    return new ThemeBuilder(this, name);
  }

  /**
   * Create a filter with fluent API
   */
  public filterBuilder(name: string, description: string): FilterBuilder {
    return new FilterBuilder(this, name, description);
  }

  /**
   * Create a function with fluent API
   */
  public functionBuilder(name: string, description: string): FunctionBuilder {
    return new FunctionBuilder(this, name, description);
  }
}

/**
 * Fluent API for building components
 */
export class ComponentBuilder<T extends blessed.Widgets.BlessedElement> {
  private engine: TemplateEngine;
  private type: string;
  private options: Record<string, any>;

  constructor(engine: TemplateEngine, type: string, options: Record<string, any> = {}) {
    this.engine = engine;
    this.type = type;
    this.options = { ...options };
  }

  /**
   * Set component position
   */
  public position(
    top?: number | string,
    left?: number | string,
    width?: number | string,
    height?: number | string
  ): ComponentBuilder<T> {
    this.options.top = top;
    this.options.left = left;
    this.options.width = width;
    this.options.height = height;
    return this;
  }

  /**
   * Set component style
   */
  public style(style: Record<string, any>): ComponentBuilder<T> {
    this.options.style = { ...this.options.style, ...style };
    return this;
  }

  /**
   * Set component content
   */
  public content(content: string): ComponentBuilder<T> {
    this.options.content = content;
    return this;
  }

  /**
   * Set component label
   */
  public label(label: string): ComponentBuilder<T> {
    this.options.label = label;
    return this;
  }

  /**
   * Set component border
   */
  public border(
    border: boolean | string | { type: string; fg?: string; bg?: string }
  ): ComponentBuilder<T> {
    this.options.border = border;
    return this;
  }

  /**
   * Set component padding
   */
  public padding(
    padding: number | { left?: number; right?: number; top?: number; bottom?: number }
  ): ComponentBuilder<T> {
    this.options.padding = padding;
    return this;
  }

  /**
   * Set component margin
   */
  public margin(
    margin: number | { left?: number; right?: number; top?: number; bottom?: number }
  ): ComponentBuilder<T> {
    this.options.margin = margin;
    return this;
  }

  /**
   * Set component alignment
   */
  public align(alignment: 'left' | 'center' | 'right'): ComponentBuilder<T> {
    this.options.align = alignment;
    return this;
  }

  /**
   * Set component tags support
   */
  public tags(tags: boolean): ComponentBuilder<T> {
    this.options.tags = tags;
    return this;
  }

  /**
   * Set component scrollable
   */
  public scrollable(scrollable: boolean): ComponentBuilder<T> {
    this.options.scrollable = scrollable;
    return this;
  }

  /**
   * Set component draggable
   */
  public draggable(draggable: boolean): ComponentBuilder<T> {
    this.options.draggable = draggable;
    return this;
  }

  /**
   * Set component clickable
   */
  public clickable(clickable: boolean): ComponentBuilder<T> {
    this.options.clickable = clickable;
    return this;
  }

  /**
   * Set component focusable
   */
  public focusable(focusable: boolean): ComponentBuilder<T> {
    this.options.focusable = focusable;
    return this;
  }

  /**
   * Set component keyable
   */
  public keyable(keyable: boolean): ComponentBuilder<T> {
    this.options.keyable = keyable;
    return this;
  }

  /**
   * Set component mouse support
   */
  public mouse(mouse: boolean): ComponentBuilder<T> {
    this.options.mouse = mouse;
    return this;
  }

  /**
   * Set component keyboard support
   */
  public keys(keys: boolean | string[]): ComponentBuilder<T> {
    this.options.keys = keys;
    return this;
  }

  /**
   * Set component shadow
   */
  public shadow(shadow: boolean): ComponentBuilder<T> {
    this.options.shadow = shadow;
    return this;
  }

  /**
   * Set component transparency
   */
  public transparency(transparency: number): ComponentBuilder<T> {
    this.options.transparency = transparency;
    return this;
  }

  /**
   * Set component effects
   */
  public effects(
    effects: Array<'blink' | 'bold' | 'underline' | 'inverse' | 'invisible'>
  ): ComponentBuilder<T> {
    this.options.effects = effects;
    return this;
  }

  /**
   * Set component class
   */
  public class(className: string): ComponentBuilder<T> {
    this.options.class = className;
    return this;
  }

  /**
   * Set component ID
   */
  public id(id: string): ComponentBuilder<T> {
    this.options.id = id;
    return this;
  }

  /**
   * Set component name
   */
  public name(name: string): ComponentBuilder<T> {
    this.options.name = name;
    return this;
  }

  /**
   * Build and create the component
   */
  public build(): T {
    return this.engine.createComponent<T>(this.type, this.options);
  }
}

/**
 * Fluent API for building layouts
 */
export class LayoutManager {
  private engine: TemplateEngine;

  constructor(engine: TemplateEngine) {
    this.engine = engine;
  }

  /**
   * Create a new layout
   */
  public createLayout(name: string, description?: string): LayoutBuilder {
    return new LayoutBuilder(this.engine, name, description);
  }

  /**
   * Get an existing layout
   */
  public getLayout(layoutId: string): TUILayout | undefined {
    return this.engine.getLayout(layoutId);
  }

  /**
   * Get all layouts
   */
  public getAllLayouts(): TUILayout[] {
    return this.engine.getAllLayouts();
  }

  /**
   * Apply a layout
   */
  public applyLayout(layoutId: string): boolean {
    return this.engine.applyLayout(layoutId);
  }

  /**
   * Register a layout
   */
  public registerLayout(layout: TUILayout): void {
    this.engine.registerLayout(layout);
  }

  /**
   * Unregister a layout
   */
  public unregisterLayout(layoutId: string): boolean {
    return this.engine.unregisterLayout(layoutId);
  }
}

/**
 * Fluent API for building layouts
 */
export class LayoutBuilder {
  private engine: TemplateEngine;
  private layout: Omit<TUILayout, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

  constructor(engine: TemplateEngine, name: string, description?: string) {
    this.engine = engine;
    this.layout = {
      name,
      description,
      components: [],
      rows: 1,
      cols: 1,
      spacing: 0,
      padding: 0,
    };
  }

  /**
   * Set layout dimensions
   */
  public dimensions(rows: number, cols: number): LayoutBuilder {
    this.layout.rows = rows;
    this.layout.cols = cols;
    return this;
  }

  /**
   * Set layout spacing
   */
  public spacing(spacing: number): LayoutBuilder {
    this.layout.spacing = spacing;
    return this;
  }

  /**
   * Set layout padding
   */
  public padding(padding: number): LayoutBuilder {
    this.layout.padding = padding;
    return this;
  }

  /**
   * Add a component to the layout
   */
  public addComponent(
    componentId: string,
    position: {
      top?: number | string;
      left?: number | string;
      width?: number | string;
      height?: number | string;
    }
  ): LayoutBuilder {
    this.layout.components.push({
      componentId,
      position,
    });
    return this;
  }

  /**
   * Set layout ID
   */
  public id(id: string): LayoutBuilder {
    this.layout.id = id;
    return this;
  }

  /**
   * Build and register the layout
   */
  public build(): TUILayout {
    const layout: TUILayout = {
      id: this.layout.id || `layout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: this.layout.name,
      description: this.layout.description,
      components: this.layout.components,
      rows: this.layout.rows,
      cols: this.layout.cols,
      spacing: this.layout.spacing,
      padding: this.layout.padding,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.engine.registerLayout(layout);
    return layout;
  }
}

/**
 * Fluent API for building themes
 */
export class ThemeBuilder {
  private engine: TemplateEngine;
  private theme: Omit<TUITheme, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

  constructor(engine: TemplateEngine, name: string) {
    this.engine = engine;
    this.theme = {
      name,
      colors: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan',
        },
        focus: {
          border: {
            fg: 'green',
          },
        },
        hover: {
          bg: 'blue',
        },
        scrollbar: {
          fg: 'blue',
          bg: 'black',
        },
        selected: {
          fg: 'white',
          bg: 'blue',
        },
        label: 'white',
        text: 'white',
        highlight: 'yellow',
      },
      styles: {
        bold: true,
        underline: false,
        italic: false,
      },
    };
  }

  /**
   * Set theme colors
   */
  public colors(colors: Partial<TUITheme['colors']>): ThemeBuilder {
    this.theme.colors = { ...this.theme.colors, ...colors };
    return this;
  }

  /**
   * Set theme styles
   */
  public styles(styles: Partial<TUITheme['styles']>): ThemeBuilder {
    this.theme.styles = { ...this.theme.styles, ...styles };
    return this;
  }

  /**
   * Set border radius
   */
  public borderRadius(radius: number): ThemeBuilder {
    this.theme.borderRadius = radius;
    return this;
  }

  /**
   * Set shadow
   */
  public shadow(shadow: boolean): ThemeBuilder {
    this.theme.shadow = shadow;
    return this;
  }

  /**
   * Set transparency
   */
  public transparency(transparency: number): ThemeBuilder {
    this.theme.transparency = transparency;
    return this;
  }

  /**
   * Set theme description
   */
  public description(description: string): ThemeBuilder {
    this.theme.description = description;
    return this;
  }

  /**
   * Set theme ID
   */
  public id(id: string): ThemeBuilder {
    this.theme.id = id;
    return this;
  }

  /**
   * Build and register the theme
   */
  public build(): TUITheme {
    const theme: TUITheme = {
      id: this.theme.id || `theme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: this.theme.name,
      description: this.theme.description,
      colors: this.theme.colors,
      styles: this.theme.styles,
      borderRadius: this.theme.borderRadius,
      shadow: this.theme.shadow,
      transparency: this.theme.transparency,
    };

    this.engine.registerTheme(theme);
    return theme;
  }
}

/**
 * Fluent API for building filters
 */
export class FilterBuilder {
  private engine: TemplateEngine;
  private filter: TemplateFilter;

  constructor(engine: TemplateEngine, name: string, description: string) {
    this.engine = engine;
    this.filter = {
      name,
      description,
      func: (value: any) => value,
    };
  }

  /**
   * Set filter function
   */
  public implementation(func: (value: any, ...args: any[]) => any): FilterBuilder {
    this.filter.func = func;
    return this;
  }

  /**
   * Build and register the filter
   */
  public build(): TemplateFilter {
    this.engine.registerFilter(this.filter);
    return this.filter;
  }
}

/**
 * Fluent API for building functions
 */
export class FunctionBuilder {
  private engine: TemplateEngine;
  private func: TemplateFunction;

  constructor(engine: TemplateEngine, name: string, description: string) {
    this.engine = engine;
    this.func = {
      name,
      description,
      func: () => undefined,
    };
  }

  /**
   * Set function implementation
   */
  public implementation(func: (...args: any[]) => any): FunctionBuilder {
    this.func.func = func;
    return this;
  }

  /**
   * Build and register the function
   */
  public build(): TemplateFunction {
    this.engine.registerFunction(this.func);
    return this.func;
  }
}
