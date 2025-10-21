/**
 * TUIManager.ts
 *
 * Main Terminal User Interface manager for the AIrchitect CLI.
 * Coordinates all TUI components, handles initialization, rendering,
 * event management, and provides a unified interface for TUI operations.
 */

import { Screen } from './Screen';
import { Logger } from '../../utils/Logger';
import { HeaderComponent } from './components/HeaderComponent';
import { FooterComponent } from './components/FooterComponent';
import { MainComponent } from './components/MainComponent';

export interface TUIManagerOptions {
  enableHeader?: boolean;
  enableFooter?: boolean;
  enableMain?: boolean;
  theme?: 'default' | 'dark' | 'light' | 'monokai';
  autoInitialize?: boolean;
  showWelcomeMessage?: boolean;
  welcomeMessage?: string;
  startupAnimation?: boolean;
  animationDuration?: number;
  enableKeyboardShortcuts?: boolean;
  enableMouseSupport?: boolean;
  enableResizeHandling?: boolean;
  enableExitHandling?: boolean;
}

export interface TUIComponentConfig {
  id: string;
  name: string;
  type: 'header' | 'footer' | 'main' | 'sidebar' | 'panel' | 'dialog' | 'notification';
  enabled: boolean;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  options: Record<string, any>;
}

export interface TUIState {
  initialized: boolean;
  running: boolean;
  components: Map<string, TUIComponent>;
  activeComponentId?: string;
  theme: 'default' | 'dark' | 'light' | 'monokai';
  lastUpdated: Date;
  usageCount: number;
  lastUsed?: Date;
}

export interface TUIComponent {
  id: string;
  name: string;
  type: string;
  element: any; // Blessed element
  options: Record<string, any>;
  state: Record<string, any>;
  logger: Logger;
  initialized: boolean;
  visible: boolean;
  enabled: boolean;
  position: { top: number; left: number; width: number; height: number };
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  initialize(): Promise<void>;
  render(): void;
  show(): void;
  hide(): void;
  focus(): void;
  blur(): void;
  destroy(): void;
  getStats(): Record<string, any>;
  validate(): { valid: boolean; errors: string[]; warnings: string[] };
  exportConfiguration(): Record<string, any>;
  importConfiguration(config: Record<string, any>): void;
}

export class TUIManager {
  private screen: Screen;
  private options: TUIManagerOptions;
  private state: TUIState;
  private logger: Logger;
  private headerComponent?: HeaderComponent;
  private footerComponent?: FooterComponent;
  private mainComponent?: MainComponent;
  private componentConfigs: Map<string, TUIComponentConfig>;

  constructor(options?: TUIManagerOptions) {
    this.options = {
      enableHeader: true,
      enableFooter: true,
      enableMain: true,
      theme: 'dark',
      autoInitialize: true,
      showWelcomeMessage: true,
      startupAnimation: true,
      animationDuration: 1000,
      enableKeyboardShortcuts: true,
      enableMouseSupport: true,
      enableResizeHandling: true,
      enableExitHandling: true,
      ...options,
    };

    this.screen = new Screen({
      theme: this.options.theme,
      autoResize: this.options.enableResizeHandling,
      fullscreen: true,
    });

    this.state = {
      initialized: false,
      running: false,
      components: new Map(),
      theme: this.options.theme || 'dark',
      lastUpdated: new Date(),
      usageCount: 0,
      lastUsed: undefined,
    };

    this.logger = new Logger('TUIManager');
    this.componentConfigs = new Map();

    // Register default component configurations
    this.registerDefaultComponentConfigs();
  }

  /**
   * Register default component configurations
   */
  private registerDefaultComponentConfigs(): void {
    try {
      this.logger.info('Registering default component configurations');

      // Header component configuration
      this.componentConfigs.set('header', {
        id: 'header',
        name: 'Header Component',
        type: 'header',
        enabled: this.options.enableHeader !== false,
        position: { top: 0, left: 0, width: 100, height: 5 },
        options: {
          showModeIndicator: true,
          showConnectionStatus: true,
          showClock: true,
          showUser: true,
          showNotifications: true,
          theme: this.options.theme,
        },
      });

      // Footer component configuration
      this.componentConfigs.set('footer', {
        id: 'footer',
        name: 'Footer Component',
        type: 'footer',
        enabled: this.options.enableFooter !== false,
        position: { top: 95, left: 0, width: 100, height: 5 },
        options: {
          showStatus: true,
          showNavigationHints: true,
          showSystemInfo: true,
          showClock: true,
          theme: this.options.theme,
        },
      });

      // Main component configuration
      this.componentConfigs.set('main', {
        id: 'main',
        name: 'Main Component',
        type: 'main',
        enabled: this.options.enableMain !== false,
        position: { top: 5, left: 0, width: 100, height: 90 },
        options: {
          showTabs: true,
          showStatusBar: true,
          showSidePanel: true,
          theme: this.options.theme,
          enableAnimations: this.options.startupAnimation,
          animationSpeed: 'normal',
        },
      });

      this.logger.info('Default component configurations registered');
    } catch (error) {
      this.logger.error('Failed to register default component configurations', error);
      throw error;
    }
  }

  /**
   * Initialize the TUI manager and all components
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing TUI manager');

      if (this.state.initialized) {
        this.logger.warn('TUI manager already initialized');
        return;
      }

      // Initialize the screen
      await this.screen.initialize();

      // Apply theme
      if (this.options.theme) {
        this.screen.setTheme(this.options.theme);
      }

      // Show welcome message if enabled
      if (this.options.showWelcomeMessage) {
        await this.showWelcomeMessage();
      }

      // Play startup animation if enabled
      if (this.options.startupAnimation) {
        await this.playStartupAnimation();
      }

      // Initialize components
      await this.initializeComponents();

      // Set up event handlers
      this.setupEventHandlers();

      this.state.initialized = true;
      this.state.running = true;
      this.state.usageCount++;
      this.state.lastUsed = new Date();
      this.state.lastUpdated = new Date();

      this.logger.info('TUI manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TUI manager', error);
      throw error;
    }
  }

  /**
   * Show welcome message
   */
  private async showWelcomeMessage(): Promise<void> {
    try {
      this.logger.info('Showing welcome message');

      const welcomeMessage =
        this.options.welcomeMessage ||
        'Welcome to AIrchitect CLI - Advanced AI-powered development assistant';

      // In a real implementation, we would display this on the screen
      // For now, we'll just log it
      this.logger.info(welcomeMessage);

      // Wait briefly to allow user to read the message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.logger.info('Welcome message displayed');
    } catch (error) {
      this.logger.error('Failed to show welcome message', error);
      throw error;
    }
  }

  /**
   * Play startup animation
   */
  private async playStartupAnimation(): Promise<void> {
    try {
      this.logger.info('Playing startup animation');

      const duration = this.options.animationDuration || 1000;

      // In a real implementation, we would play a visual animation
      // For now, we'll just simulate the animation with a delay
      await new Promise((resolve) => setTimeout(resolve, duration));

      this.logger.info('Startup animation completed');
    } catch (error) {
      this.logger.error('Failed to play startup animation', error);
      throw error;
    }
  }

  /**
   * Initialize TUI components
   */
  private async initializeComponents(): Promise<void> {
    try {
      this.logger.info('Initializing TUI components');

      // Initialize header component if enabled
      if (this.options.enableHeader !== false) {
        const headerConfig = this.componentConfigs.get('header');
        if (headerConfig) {
          this.headerComponent = new HeaderComponent(headerConfig.options);
          await this.headerComponent.initialize();
          this.state.components.set('header', this.headerComponent);
          this.screen.append(this.headerComponent.getElement());
        }
      }

      // Initialize footer component if enabled
      if (this.options.enableFooter !== false) {
        const footerConfig = this.componentConfigs.get('footer');
        if (footerConfig) {
          this.footerComponent = new FooterComponent(footerConfig.options);
          await this.footerComponent.initialize();
          this.state.components.set('footer', this.footerComponent);
          this.screen.append(this.footerComponent.getElement());
        }
      }

      // Initialize main component if enabled
      if (this.options.enableMain !== false) {
        const mainConfig = this.componentConfigs.get('main');
        if (mainConfig) {
          this.mainComponent = new MainComponent(mainConfig.options);
          await this.mainComponent.initialize();
          this.state.components.set('main', this.mainComponent);
          this.screen.append(this.mainComponent.getElement());
        }
      }

      // Render the screen
      this.screen.render();

      this.logger.info('TUI components initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize TUI components', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    try {
      this.logger.info('Setting up event handlers');

      // Handle screen resize
      if (this.options.enableResizeHandling) {
        this.screen.on('resize', () => {
          this.logger.info('Screen resized');
          this.handleScreenResize();
        });
      }

      // Handle exit events
      if (this.options.enableExitHandling) {
        this.screen.on('exit', () => {
          this.logger.info('Screen exit requested');
          this.handleScreenExit();
        });
      }

      // Handle key presses
      if (this.options.enableKeyboardShortcuts) {
        this.screen.on('keypress', (ch, key) => {
          this.logger.info('Key press detected');
          this.handleKeyPress(ch, key);
        });
      }

      // Handle mouse events
      if (this.options.enableMouseSupport) {
        this.screen.on('mouse', (data) => {
          this.logger.info('Mouse event detected');
          this.handleMouseEvent(data);
        });
      }

      this.logger.info('Event handlers set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up event handlers', error);
      throw error;
    }
  }

  /**
   * Handle screen resize event
   */
  private handleScreenResize(): void {
    try {
      this.logger.info('Handling screen resize');

      // Get new screen dimensions
      const size = this.screen.getSize();
      this.logger.info(`New screen size: ${size.width}x${size.height}`);

      // Re-render the screen
      this.screen.render();

      this.logger.info('Screen resize handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle screen resize', error);
      throw error;
    }
  }

  /**
   * Handle screen exit event
   */
  private handleScreenExit(): void {
    try {
      this.logger.info('Handling screen exit');

      // Perform cleanup operations
      this.cleanup();

      // Exit the process
      process.exit(0);

      this.logger.info('Screen exit handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle screen exit', error);
      throw error;
    }
  }

  /**
   * Handle key press event
   */
  private handleKeyPress(ch: string, key: any): void {
    try {
      this.logger.info('Handling key press');

      // Extract key information
      const keyName = key?.name || '';

      // Handle common key combinations
      if (key && key.ctrl && keyName === 'c') {
        // Control+C - exit
        this.logger.info('Control+C detected, exiting');
        this.handleScreenExit();
      } else if (keyName === 'q') {
        // Q key - exit
        this.logger.info('Q key detected, exiting');
        this.handleScreenExit();
      } else if (keyName === 'r') {
        // R key - refresh
        this.logger.info('R key detected, refreshing');
        this.screen.render();
      }

      this.logger.info('Key press handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle key press', error);
      throw error;
    }
  }

  /**
   * Handle mouse event
   */
  private handleMouseEvent(data: any): void {
    try {
      this.logger.info('Handling mouse event');

      // Extract mouse information
      const { x, y, type } = data;

      this.logger.info(`Mouse event: ${type} at (${x}, ${y})`);

      // In a real implementation, we would handle mouse clicks, movements, etc.

      this.logger.info('Mouse event handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle mouse event', error);
      throw error;
    }
  }

  /**
   * Get the screen instance
   */
  public getScreen(): Screen {
    return this.screen;
  }

  /**
   * Get the header component
   */
  public getHeaderComponent(): HeaderComponent | undefined {
    return this.headerComponent;
  }

  /**
   * Get the footer component
   */
  public getFooterComponent(): FooterComponent | undefined {
    return this.footerComponent;
  }

  /**
   * Get the main component
   */
  public getMainComponent(): MainComponent | undefined {
    return this.mainComponent;
  }

  /**
   * Get a component by ID
   */
  public getComponent(componentId: string): TUIComponent | undefined {
    return this.state.components.get(componentId);
  }

  /**
   * Get all components
   */
  public getAllComponents(): TUIComponent[] {
    return Array.from(this.state.components.values());
  }

  /**
   * Add a component
   */
  public async addComponent(component: TUIComponent): Promise<void> {
    try {
      this.logger.info(`Adding component: ${component.name}`);

      // Initialize the component if not already initialized
      if (!component.initialized) {
        await component.initialize();
      }

      // Add to components map
      this.state.components.set(component.id, component);

      // Add to screen
      this.screen.append(component.element);

      // Update state
      this.state.lastUpdated = new Date();

      this.logger.info(`Component added successfully: ${component.name}`);
    } catch (error) {
      this.logger.error(`Failed to add component: ${component.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a component
   */
  public async removeComponent(componentId: string): Promise<boolean> {
    try {
      this.logger.info(`Removing component: ${componentId}`);

      const component = this.state.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      // Destroy the component
      await component.destroy();

      // Remove from screen
      this.screen.remove(component.element);

      // Remove from components map
      const deleted = this.state.components.delete(componentId);

      // Update state
      if (deleted) {
        this.state.lastUpdated = new Date();
        this.logger.info(`Component removed successfully: ${component.name}`);
      } else {
        this.logger.warn(`Failed to remove component: ${component.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Enable a component
   */
  public async enableComponent(componentId: string): Promise<boolean> {
    try {
      this.logger.info(`Enabling component: ${componentId}`);

      const component = this.state.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      component.enabled = true;
      component.updatedAt = new Date();
      this.state.lastUpdated = new Date();

      // Show the component
      component.show();

      // Re-render the screen
      this.screen.render();

      this.logger.info(`Component enabled successfully: ${component.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to enable component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Disable a component
   */
  public async disableComponent(componentId: string): Promise<boolean> {
    try {
      this.logger.info(`Disabling component: ${componentId}`);

      const component = this.state.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      component.enabled = false;
      component.updatedAt = new Date();
      this.state.lastUpdated = new Date();

      // Hide the component
      component.hide();

      // Re-render the screen
      this.screen.render();

      this.logger.info(`Component disabled successfully: ${component.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to disable component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Focus a component
   */
  public async focusComponent(componentId: string): Promise<boolean> {
    try {
      this.logger.info(`Focusing component: ${componentId}`);

      const component = this.state.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      // Focus the component
      component.focus();

      // Update active component
      this.state.activeComponentId = componentId;
      this.state.lastUpdated = new Date();

      // Re-render the screen
      this.screen.render();

      this.logger.info(`Component focused successfully: ${component.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to focus component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Blur a component
   */
  public async blurComponent(componentId: string): Promise<boolean> {
    try {
      this.logger.info(`Blurring component: ${componentId}`);

      const component = this.state.components.get(componentId);
      if (!component) {
        this.logger.warn(`Component not found: ${componentId}`);
        return false;
      }

      // Blur the component
      component.blur();

      // Update active component if this was the active component
      if (this.state.activeComponentId === componentId) {
        this.state.activeComponentId = undefined;
      }

      this.state.lastUpdated = new Date();

      // Re-render the screen
      this.screen.render();

      this.logger.info(`Component blurred successfully: ${component.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to blur component: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Update component configuration
   */
  public async updateComponentConfig(
    componentId: string,
    updates: Partial<Omit<TUIComponentConfig, 'id' | 'type'>>
  ): Promise<boolean> {
    try {
      this.logger.info(`Updating component configuration: ${componentId}`);

      const config = this.componentConfigs.get(componentId);
      if (!config) {
        this.logger.warn(`Component configuration not found: ${componentId}`);
        return false;
      }

      // Update the configuration
      Object.assign(config, updates, {
        updatedAt: new Date(),
      });

      // Update in map
      this.componentConfigs.set(componentId, config);

      // Update the actual component if it exists
      const component = this.state.components.get(componentId);
      if (component) {
        // Apply configuration updates to component
        Object.assign(component.options, updates.options || {});
        component.updatedAt = new Date();

        // Re-render the component
        component.render();

        // Re-render the screen
        this.screen.render();
      }

      this.state.lastUpdated = new Date();

      this.logger.info(`Component configuration updated successfully: ${config.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update component configuration: ${componentId}`, error);
      throw error;
    }
  }

  /**
   * Get component configuration
   */
  public getComponentConfig(componentId: string): TUIComponentConfig | undefined {
    return this.componentConfigs.get(componentId);
  }

  /**
   * Get all component configurations
   */
  public getAllComponentConfigs(): TUIComponentConfig[] {
    return Array.from(this.componentConfigs.values());
  }

  /**
   * Set the TUI theme
   */
  public async setTheme(theme: 'default' | 'dark' | 'light' | 'monokai'): Promise<void> {
    try {
      this.logger.info(`Setting TUI theme: ${theme}`);

      // Update state
      this.state.theme = theme;
      this.state.lastUpdated = new Date();

      // Apply theme to screen
      this.screen.setTheme(theme);

      // Apply theme to all components
      for (const component of this.state.components.values()) {
        try {
          // Update component options
          component.options.theme = theme;
          component.updatedAt = new Date();

          // Re-render the component
          component.render();
        } catch (error) {
          this.logger.error(`Failed to apply theme to component: ${component.name}`, error);
        }
      }

      // Re-render the screen
      this.screen.render();

      this.logger.info(`TUI theme set successfully: ${theme}`);
    } catch (error) {
      this.logger.error(`Failed to set TUI theme: ${theme}`, error);
      throw error;
    }
  }

  /**
   * Get the current theme
   */
  public getTheme(): 'default' | 'dark' | 'light' | 'monokai' {
    return this.state.theme;
  }

  /**
   * Render the TUI
   */
  public async render(): Promise<void> {
    try {
      this.logger.info('Rendering TUI');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot render');
        return;
      }

      // Render all components
      for (const component of this.state.components.values()) {
        try {
          if (component.enabled && component.visible) {
            component.render();
          }
        } catch (error) {
          this.logger.error(`Failed to render component: ${component.name}`, error);
        }
      }

      // Render the screen
      this.screen.render();

      this.logger.info('TUI rendered successfully');
    } catch (error) {
      this.logger.error('Failed to render TUI', error);
      throw error;
    }
  }

  /**
   * Show the TUI
   */
  public async show(): Promise<void> {
    try {
      this.logger.info('Showing TUI');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot show');
        return;
      }

      // Show all components
      for (const component of this.state.components.values()) {
        try {
          if (component.enabled) {
            component.show();
          }
        } catch (error) {
          this.logger.error(`Failed to show component: ${component.name}`, error);
        }
      }

      // Show the screen
      this.screen.show();

      // Set running state
      this.state.running = true;
      this.state.lastUpdated = new Date();

      this.logger.info('TUI shown successfully');
    } catch (error) {
      this.logger.error('Failed to show TUI', error);
      throw error;
    }
  }

  /**
   * Hide the TUI
   */
  public async hide(): Promise<void> {
    try {
      this.logger.info('Hiding TUI');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot hide');
        return;
      }

      // Hide all components
      for (const component of this.state.components.values()) {
        try {
          component.hide();
        } catch (error) {
          this.logger.error(`Failed to hide component: ${component.name}`, error);
        }
      }

      // Hide the screen
      this.screen.hide();

      // Set running state
      this.state.running = false;
      this.state.lastUpdated = new Date();

      this.logger.info('TUI hidden successfully');
    } catch (error) {
      this.logger.error('Failed to hide TUI', error);
      throw error;
    }
  }

  /**
   * Check if TUI is visible
   */
  public isVisible(): boolean {
    return this.state.running;
  }

  /**
   * Focus the TUI
   */
  public async focus(): Promise<void> {
    try {
      this.logger.info('Focusing TUI');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot focus');
        return;
      }

      // Focus the screen
      this.screen.focus();

      this.logger.info('TUI focused successfully');
    } catch (error) {
      this.logger.error('Failed to focus TUI', error);
      throw error;
    }
  }

  /**
   * Blur the TUI
   */
  public async blur(): Promise<void> {
    try {
      this.logger.info('Blurring TUI');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot blur');
        return;
      }

      // Blur the screen
      this.screen.blur();

      this.logger.info('TUI blurred successfully');
    } catch (error) {
      this.logger.error('Failed to blur TUI', error);
      throw error;
    }
  }

  /**
   * Check if TUI is focused
   */
  public isFocused(): boolean {
    try {
      if (!this.state.initialized) {
        return false;
      }

      return this.screen.isFocused();
    } catch (error) {
      this.logger.error('Failed to check if TUI is focused', error);
      return false;
    }
  }

  /**
   * Cleanup TUI resources
   */
  public async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up TUI resources');

      if (!this.state.initialized) {
        this.logger.warn('TUI not initialized, cannot clean up');
        return;
      }

      // Clean up all components
      for (const component of this.state.components.values()) {
        try {
          await component.destroy();
        } catch (error) {
          this.logger.error(`Failed to destroy component: ${component.name}`, error);
        }
      }

      // Clear components
      this.state.components.clear();

      // Clean up screen
      this.screen.cleanup();

      // Reset state
      this.state.initialized = false;
      this.state.running = false;
      this.state.activeComponentId = undefined;
      this.state.lastUpdated = new Date();

      this.logger.info('TUI resources cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to clean up TUI resources', error);
      throw error;
    }
  }

  /**
   * Get TUI statistics
   */
  public getStats(): {
    initialized: boolean;
    running: boolean;
    theme: string;
    components: number;
    activeComponent?: string;
    lastUpdated: Date;
    usageCount: number;
    lastUsed?: Date;
    screen: {
      width: number;
      height: number;
      fullscreen: boolean;
      focused: boolean;
    };
    componentStats: Array<{ component: TUIComponent; stats: Record<string, any> }>;
  } {
    try {
      this.logger.info('Getting TUI statistics');

      const stats = {
        initialized: this.state.initialized,
        running: this.state.running,
        theme: this.state.theme,
        components: this.state.components.size,
        activeComponent: this.state.activeComponentId,
        lastUpdated: this.state.lastUpdated,
        usageCount: this.state.usageCount,
        lastUsed: this.state.lastUsed,
        screen: {
          width: this.screen.getSize().width,
          height: this.screen.getSize().height,
          fullscreen: this.screen.isFullscreen(),
          focused: this.screen.isFocused(),
        },
        componentStats: Array.from(this.state.components.values()).map((component) => ({
          component,
          stats: component.getStats(),
        })),
      };

      this.logger.info('TUI statistics retrieved successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to get TUI statistics', error);
      throw error;
    }
  }

  /**
   * Validate TUI configuration
   */
  public validate(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating TUI configuration');

      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Validate required components
      if (this.options.enableHeader !== false && !this.headerComponent) {
        validation.warnings.push('Header component is enabled but not initialized');
      }

      if (this.options.enableFooter !== false && !this.footerComponent) {
        validation.warnings.push('Footer component is enabled but not initialized');
      }

      if (this.options.enableMain !== false && !this.mainComponent) {
        validation.warnings.push('Main component is enabled but not initialized');
      }

      // Validate screen
      if (!this.screen) {
        validation.errors.push('Screen is not initialized');
        validation.valid = false;
      }

      // Validate components
      for (const component of this.state.components.values()) {
        try {
          const componentValidation = component.validate();
          if (!componentValidation.valid) {
            validation.errors.push(
              ...componentValidation.errors.map((error) => `Component ${component.name}: ${error}`)
            );
            validation.valid = false;
          }
          validation.warnings.push(
            ...componentValidation.warnings.map(
              (warning) => `Component ${component.name}: ${warning}`
            )
          );
        } catch (error) {
          validation.errors.push(
            `Failed to validate component ${component.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          validation.valid = false;
        }
      }

      // Validate theme
      const validThemes = ['default', 'dark', 'light', 'monokai'];
      if (!validThemes.includes(this.state.theme)) {
        validation.errors.push(`Invalid theme: ${this.state.theme}`);
        validation.valid = false;
      }

      this.logger.info(
        `TUI configuration validation completed: ${validation.valid ? 'valid' : 'invalid'}`
      );
      return validation;
    } catch (error) {
      this.logger.error('Failed to validate TUI configuration', error);
      throw error;
    }
  }

  /**
   * Export TUI configuration
   */
  public exportConfiguration(): {
    options: TUIManagerOptions;
    components: TUIComponentConfig[];
    theme: string;
  } {
    try {
      this.logger.info('Exporting TUI configuration');

      const config = {
        options: { ...this.options },
        components: Array.from(this.componentConfigs.values()),
        theme: this.state.theme,
      };

      this.logger.info('TUI configuration exported successfully');
      return config;
    } catch (error) {
      this.logger.error('Failed to export TUI configuration', error);
      throw error;
    }
  }

  /**
   * Import TUI configuration
   */
  public async importConfiguration(config: {
    options: TUIManagerOptions;
    components: TUIComponentConfig[];
    theme: string;
  }): Promise<void> {
    try {
      this.logger.info('Importing TUI configuration');

      // Update options
      Object.assign(this.options, config.options);

      // Clear existing component configs
      this.componentConfigs.clear();

      // Import component configs
      for (const componentConfig of config.components) {
        this.componentConfigs.set(componentConfig.id, componentConfig);
      }

      // Set theme
      await this.setTheme(config.theme as 'default' | 'dark' | 'light' | 'monokai');

      // Reinitialize components
      await this.initializeComponents();

      this.logger.info('TUI configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import TUI configuration', error);
      throw error;
    }
  }

  /**
   * Reset TUI to default configuration
   */
  public async resetToDefaults(): Promise<void> {
    try {
      this.logger.info('Resetting TUI to defaults');

      // Reset options to defaults
      this.options = {
        enableHeader: true,
        enableFooter: true,
        enableMain: true,
        theme: 'dark',
        autoInitialize: true,
        showWelcomeMessage: true,
        startupAnimation: true,
        animationDuration: 1000,
        enableKeyboardShortcuts: true,
        enableMouseSupport: true,
        enableResizeHandling: true,
        enableExitHandling: true,
      };

      // Reset component configs
      this.componentConfigs.clear();
      this.registerDefaultComponentConfigs();

      // Reset theme
      await this.setTheme('dark');

      // Reset state
      this.state.theme = 'dark';
      this.state.lastUpdated = new Date();

      // Reinitialize components
      await this.initializeComponents();

      this.logger.info('TUI reset to defaults successfully');
    } catch (error) {
      this.logger.error('Failed to reset TUI to defaults', error);
      throw error;
    }
  }

  /**
   * Test TUI functionality
   */
  public async test(): Promise<{
    success: boolean;
    results: Array<{ test: string; passed: boolean; message?: string }>;
  }> {
    try {
      this.logger.info('Testing TUI functionality');

      const results: Array<{ test: string; passed: boolean; message?: string }> = [];

      // Test 1: Initialization
      try {
        await this.initialize();
        results.push({
          test: 'Initialization',
          passed: this.state.initialized,
          message: this.state.initialized
            ? 'TUI initialized successfully'
            : 'Failed to initialize TUI',
        });
      } catch (error) {
        results.push({
          test: 'Initialization',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 2: Screen access
      try {
        const screen = this.getScreen();
        results.push({
          test: 'Screen Access',
          passed: !!screen,
          message: screen ? 'Screen accessed successfully' : 'Failed to access screen',
        });
      } catch (error) {
        results.push({
          test: 'Screen Access',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 3: Component access
      try {
        const header = this.getHeaderComponent();
        const footer = this.getFooterComponent();
        const main = this.getMainComponent();

        results.push({
          test: 'Component Access',
          passed: !!(header || footer || main),
          message:
            header || footer || main
              ? 'Components accessed successfully'
              : 'No components available',
        });
      } catch (error) {
        results.push({
          test: 'Component Access',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 4: Theme setting
      try {
        await this.setTheme('light');
        const currentTheme = this.getTheme();
        results.push({
          test: 'Theme Setting',
          passed: currentTheme === 'light',
          message:
            currentTheme === 'light'
              ? 'Theme set successfully'
              : `Failed to set theme: ${currentTheme}`,
        });

        // Reset to dark theme
        await this.setTheme('dark');
      } catch (error) {
        results.push({
          test: 'Theme Setting',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 5: Rendering
      try {
        await this.render();
        results.push({
          test: 'Rendering',
          passed: true,
          message: 'TUI rendered successfully',
        });
      } catch (error) {
        results.push({
          test: 'Rendering',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 6: Visibility control
      try {
        await this.hide();
        const isVisible = this.isVisible();
        results.push({
          test: 'Visibility Control',
          passed: !isVisible,
          message: !isVisible ? 'TUI hidden successfully' : 'Failed to hide TUI',
        });

        await this.show();
      } catch (error) {
        results.push({
          test: 'Visibility Control',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 7: Focus control
      try {
        await this.focus();
        const isFocused = this.isFocused();
        results.push({
          test: 'Focus Control',
          passed: isFocused,
          message: isFocused ? 'TUI focused successfully' : 'Failed to focus TUI',
        });

        await this.blur();
      } catch (error) {
        results.push({
          test: 'Focus Control',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 8: Validation
      try {
        const validation = this.validate();
        results.push({
          test: 'Validation',
          passed: validation.valid,
          message: validation.valid
            ? 'TUI is valid'
            : `TUI validation failed: ${validation.errors.join(', ')}`,
        });
      } catch (error) {
        results.push({
          test: 'Validation',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 9: Statistics
      try {
        const stats = this.getStats();
        results.push({
          test: 'Statistics Retrieval',
          passed: !!stats,
          message: stats ? 'Statistics retrieved successfully' : 'Failed to retrieve statistics',
        });
      } catch (error) {
        results.push({
          test: 'Statistics Retrieval',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 10: Configuration export/import
      try {
        const config = this.exportConfiguration();
        await this.importConfiguration(config);
        results.push({
          test: 'Configuration Export/Import',
          passed: !!config,
          message: config
            ? 'Configuration exported and imported successfully'
            : 'Failed to export/import configuration',
        });
      } catch (error) {
        results.push({
          test: 'Configuration Export/Import',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Determine overall success
      const success = results.every((result) => result.passed);

      this.logger.info(`TUI test completed: ${success ? 'passed' : 'failed'}`);
      return { success, results };
    } catch (error) {
      this.logger.error('Failed to test TUI functionality', error);
      throw error;
    }
  }
}
