/**
 * TUI Components for AIrchitect CLI
 *
 * This module provides the terminal user interface components
 * for the AIrchitect CLI system.
 */

import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import chalk from 'chalk';
import gradient from 'gradient-string';

/**
 * Interface for TUI component configuration
 */
export interface TUIComponentConfig {
  /**
   * Component name
   */
  name: string;

  /**
   * Component type
   */
  type: 'header' | 'main' | 'footer' | 'sidebar' | 'panel';

  /**
   * Component position
   */
  position: {
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
  };

  /**
   * Component style
   */
  style?: {
    fg?: string;
    bg?: string;
    border?: {
      fg?: string;
    };
  };

  /**
   * Component content
   */
  content?: string;

  /**
   * Whether the component is visible
   */
  visible?: boolean;

  /**
   * Component tags support
   */
  tags?: boolean;

  /**
   * Component border
   */
  border?: {
    type: 'line' | 'bg' | 'none';
  };
}

/**
 * Base TUI component class
 */
export abstract class TUIComponent {
  protected element: blessed.Widgets.BlessedElement;
  protected config: TUIComponentConfig;
  protected parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement;

  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config: TUIComponentConfig
  ) {
    this.parent = parent;
    this.config = config;

    // Create the base element
    this.element = this.createElement();

    // Add to parent
    parent.append(this.element);
  }

  /**
   * Create the blessed element for this component
   */
  protected abstract createElement(): blessed.Widgets.BlessedElement;

  /**
   * Render the component
   */
  public render(): void {
    this.element.render();
  }

  /**
   * Show the component
   */
  public show(): void {
    this.element.show();
  }

  /**
   * Hide the component
   */
  public hide(): void {
    this.element.hide();
  }

  /**
   * Set the component content
   */
  public setContent(content: string): void {
    this.element.setContent(content);
  }

  /**
   * Get the component content
   */
  public getContent(): string {
    return this.element.getContent();
  }

  /**
   * Update the component configuration
   */
  public updateConfig(newConfig: Partial<TUIComponentConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update element properties
    if (newConfig.position) {
      Object.assign(this.element.position, newConfig.position);
    }

    if (newConfig.style) {
      Object.assign(this.element.style, newConfig.style);
    }

    if (newConfig.content !== undefined) {
      this.element.setContent(newConfig.content);
    }

    if (newConfig.visible !== undefined) {
      if (newConfig.visible) {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  /**
   * Get the component element
   */
  public getElement(): blessed.Widgets.BlessedElement {
    return this.element;
  }

  /**
   * Get the component configuration
   */
  public getConfig(): TUIComponentConfig {
    return { ...this.config };
  }

  /**
   * Focus the component
   */
  public focus(): void {
    this.element.focus();
  }

  /**
   * Check if the component is focused
   */
  public isFocused(): boolean {
    return this.element.focused;
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.element.destroy();
  }
}

/**
 * Header component for the TUI
 */
export class HeaderComponent extends TUIComponent {
  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config?: Partial<TUIComponentConfig>
  ) {
    const defaultConfig: TUIComponentConfig = {
      name: 'header',
      type: 'header',
      position: {
        top: 0,
        left: 0,
        width: '100%',
        height: 3,
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
      content: chalk.bold.blue('AIrchitect CLI') + ' v1.0.0',
      tags: true,
      border: {
        type: 'line',
      },
      visible: true,
    };

    super(parent, { ...defaultConfig, ...config });
  }

  protected createElement(): blessed.Widgets.BlessedElement {
    return blessed.box({
      parent: this.parent,
      top: this.config.position.top,
      left: this.config.position.left,
      width: this.config.position.width,
      height: this.config.position.height,
      tags: this.config.tags,
      border: this.config.border,
      style: this.config.style,
      content: this.config.content,
    });
  }

  /**
   * Update the header content with application information
   */
  public updateHeader(appInfo: {
    name: string;
    version: string;
    mode: 'planning' | 'work';
    provider: string;
  }): void {
    const modeText =
      appInfo.mode === 'planning' ? chalk.yellow('[Planning Mode]') : chalk.red('[Work Mode]');

    const content = `${chalk.bold.blue(appInfo.name)} v${appInfo.version} | ${modeText} | Provider: ${appInfo.provider}`;
    this.setContent(content);
  }

  /**
   * Update the mode indicator
   */
  public updateModeIndicator(mode: 'planning' | 'work'): void {
    const modeText =
      mode === 'planning' ? chalk.yellow('[Planning Mode]') : chalk.red('[Work Mode]');

    // Get current content and replace mode indicator
    const currentContent = this.getContent();
    const updatedContent = currentContent.replace(/\[.*Mode\]/, modeText);

    this.setContent(updatedContent);
  }
}

/**
 * Main content component for the TUI
 */
export class MainComponent extends TUIComponent {
  private outputArea: blessed.Widgets.LogElement;
  private inputArea: blessed.Widgets.TextboxElement;

  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config?: Partial<TUIComponentConfig>
  ) {
    const defaultConfig: TUIComponentConfig = {
      name: 'main',
      type: 'main',
      position: {
        top: 3,
        left: 0,
        width: '100%',
        height: '100%-6',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
      tags: true,
      border: {
        type: 'line',
      },
      visible: true,
    };

    super(parent, { ...defaultConfig, ...config });

    // Create output area
    this.outputArea = blessed.log({
      parent: this.element,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      tags: true,
      scrollable: true,
      scrollbar: {
        ch: ' ',
        inverse: true,
      },
      keys: true,
      vi: true,
      mouse: true,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // Create input area
    this.inputArea = blessed.textbox({
      parent: this.element,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      inputOnFocus: true,
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
        focus: {
          border: {
            fg: 'blue',
          },
        },
      },
    });
  }

  protected createElement(): blessed.Widgets.BlessedElement {
    return blessed.box({
      parent: this.parent,
      top: this.config.position.top,
      left: this.config.position.left,
      width: this.config.position.width,
      height: this.config.position.height,
      tags: this.config.tags,
      border: this.config.border,
      style: this.config.style,
    });
  }

  /**
   * Add output to the main area
   */
  public addOutput(text: string): void {
    this.outputArea.add(text);
    this.outputArea.setScrollPerc(100); // Auto-scroll to bottom
  }

  /**
   * Clear the output area
   */
  public clearOutput(): void {
    this.outputArea.setContent('');
  }

  /**
   * Get the input area element
   */
  public getInputArea(): blessed.Widgets.TextboxElement {
    return this.inputArea;
  }

  /**
   * Get the output area element
   */
  public getOutputArea(): blessed.Widgets.LogElement {
    return this.outputArea;
  }

  /**
   * Focus the input area
   */
  public focusInput(): void {
    this.inputArea.focus();
  }

  /**
   * Get input value
   */
  public getInputValue(): string {
    return this.inputArea.getValue();
  }

  /**
   * Set input value
   */
  public setInputValue(value: string): void {
    this.inputArea.setValue(value);
  }

  /**
   * Clear input value
   */
  public clearInput(): void {
    this.inputArea.clearValue();
  }

  /**
   * Show welcome message
   */
  public showWelcome(): void {
    const welcomeText = gradient.pastel.multiline(`
    ░█████╗░██╗██████╗░███████╗░█████╗░██╗  ██╗████████╗
    ██╔══██╗██║██╔══██╗██╔════╝██╔══██╗██║ ██╔╝╚══██╔══╝
    ███████║██║██████╔╝█████╗  ██║  ╚═╝█████═╝    ██║   
    ██╔══██║██║██╔══██╗██╔══╝  ██║  ██╗██╔═██╗    ██║   
    ██║  ██║██║██║  ██║███████╗╚█████╔╝██║ ╚██╗   ██║   
    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝ ╚════╝ ╚═╝  ╚═╝   ╚═╝   
    `);

    this.addOutput(welcomeText);
    this.addOutput(chalk.blue.bold('AIrchitect CLI - Advanced AI-powered development assistant'));
    this.addOutput('');
    this.addOutput(chalk.gray('Type /help for available commands'));
    this.addOutput('');
  }
}

/**
 * Footer component for the TUI
 */
export class FooterComponent extends TUIComponent {
  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config?: Partial<TUIComponentConfig>
  ) {
    const defaultConfig: TUIComponentConfig = {
      name: 'footer',
      type: 'footer',
      position: {
        bottom: 0,
        left: 0,
        width: '100%',
        height: 3,
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
      content: '↑↓ Navigate | Tab: Switch | Ctrl+C: Exit',
      tags: true,
      border: {
        type: 'line',
      },
      visible: true,
    };

    super(parent, { ...defaultConfig, ...config });
  }

  protected createElement(): blessed.Widgets.BlessedElement {
    return blessed.box({
      parent: this.parent,
      bottom: this.config.position.bottom,
      left: this.config.position.left,
      width: this.config.position.width,
      height: this.config.position.height,
      tags: this.config.tags,
      border: this.config.border,
      style: this.config.style,
      content: this.config.content,
    });
  }

  /**
   * Update footer content
   */
  public updateFooter(content: string): void {
    this.setContent(content);
  }

  /**
   * Update mode indicator
   */
  public updateModeIndicator(mode: 'planning' | 'work'): void {
    const modeText =
      mode === 'planning' ? chalk.yellow('[Planning Mode]') : chalk.red('[Work Mode]');

    // Get current content and replace mode indicator
    const currentContent = this.getContent();
    const updatedContent = currentContent.replace(/\[.*Mode\]/, modeText);

    this.setContent(updatedContent);
  }

  /**
   * Show help text
   */
  public showHelp(): void {
    const helpText = '↑↓ Navigate | Tab: Switch | Ctrl+C: Exit | /help: Commands';
    this.setContent(helpText);
  }
}

/**
 * Status bar component for the TUI
 */
export class StatusBarComponent extends TUIComponent {
  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config?: Partial<TUIComponentConfig>
  ) {
    const defaultConfig: TUIComponentConfig = {
      name: 'status-bar',
      type: 'footer',
      position: {
        bottom: 3,
        left: 0,
        width: '100%',
        height: 1,
      },
      style: {
        fg: 'white',
        bg: 'green',
        border: {
          fg: '#f0f0f0',
        },
      },
      content: 'Ready',
      tags: true,
      visible: true,
    };

    super(parent, { ...defaultConfig, ...config });
  }

  protected createElement(): blessed.Widgets.BlessedElement {
    return blessed.box({
      parent: this.parent,
      bottom: this.config.position.bottom,
      left: this.config.position.left,
      width: this.config.position.width,
      height: this.config.position.height,
      tags: this.config.tags,
      style: this.config.style,
      content: this.config.content,
    });
  }

  /**
   * Update status text
   */
  public updateStatus(status: string): void {
    this.setContent(status);
  }

  /**
   * Show success status
   */
  public showSuccess(message: string): void {
    this.element.style.fg = 'white';
    this.element.style.bg = 'green';
    this.setContent(message);
  }

  /**
   * Show warning status
   */
  public showWarning(message: string): void {
    this.element.style.fg = 'white';
    this.element.style.bg = 'yellow';
    this.setContent(message);
  }

  /**
   * Show error status
   */
  public showError(message: string): void {
    this.element.style.fg = 'white';
    this.element.style.bg = 'red';
    this.setContent(message);
  }

  /**
   * Show info status
   */
  public showInfo(message: string): void {
    this.element.style.fg = 'white';
    this.element.style.bg = 'blue';
    this.setContent(message);
  }
}

/**
 * Sidebar component for the TUI
 */
export class SidebarComponent extends TUIComponent {
  private items: string[] = [];
  private selectedItem: number = 0;

  constructor(
    parent: blessed.Widgets.Screen | blessed.Widgets.BoxElement,
    config?: Partial<TUIComponentConfig>
  ) {
    const defaultConfig: TUIComponentConfig = {
      name: 'sidebar',
      type: 'sidebar',
      position: {
        top: 3,
        right: 0,
        width: 25,
        height: '100%-6',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
      tags: true,
      border: {
        type: 'line',
      },
      visible: true,
    };

    super(parent, { ...defaultConfig, ...config });
  }

  protected createElement(): blessed.Widgets.BlessedElement {
    return blessed.box({
      parent: this.parent,
      top: this.config.position.top,
      right: this.config.position.right,
      width: this.config.position.width,
      height: this.config.position.height,
      tags: this.config.tags,
      border: this.config.border,
      style: this.config.style,
    });
  }

  /**
   * Set sidebar items
   */
  public setItems(items: string[]): void {
    this.items = [...items];
    this.selectedItem = 0;
    this.renderItems();
  }

  /**
   * Add an item to the sidebar
   */
  public addItem(item: string): void {
    this.items.push(item);
    this.renderItems();
  }

  /**
   * Remove an item from the sidebar
   */
  public removeItem(item: string): boolean {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
      if (this.selectedItem >= this.items.length) {
        this.selectedItem = Math.max(0, this.items.length - 1);
      }
      this.renderItems();
      return true;
    }
    return false;
  }

  /**
   * Select next item
   */
  public selectNext(): void {
    if (this.items.length > 0) {
      this.selectedItem = (this.selectedItem + 1) % this.items.length;
      this.renderItems();
    }
  }

  /**
   * Select previous item
   */
  public selectPrevious(): void {
    if (this.items.length > 0) {
      this.selectedItem = (this.selectedItem - 1 + this.items.length) % this.items.length;
      this.renderItems();
    }
  }

  /**
   * Get selected item
   */
  public getSelectedItem(): string | null {
    if (this.items.length > 0 && this.selectedItem < this.items.length) {
      return this.items[this.selectedItem];
    }
    return null;
  }

  /**
   * Render items to the sidebar
   */
  private renderItems(): void {
    if (this.items.length === 0) {
      this.setContent('No items');
      return;
    }

    let content = '';
    for (let i = 0; i < this.items.length; i++) {
      if (i === this.selectedItem) {
        content += chalk.bgBlue.white(`> ${this.items[i]}\n`);
      } else {
        content += `  ${this.items[i]}\n`;
      }
    }

    this.setContent(content);
  }

  /**
   * Clear all items
   */
  public clearItems(): void {
    this.items = [];
    this.selectedItem = 0;
    this.setContent('No items');
  }
}

/**
 * Main TUI manager
 */
export class TUIManager {
  private screen: blessed.Widgets.Screen;
  private header: HeaderComponent;
  private main: MainComponent;
  private footer: FooterComponent;
  private statusBar: StatusBarComponent;
  private sidebar: SidebarComponent;
  private initialized: boolean = false;

  constructor() {
    // Create the main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'AIrchitect CLI',
      dockBorders: true,
      fullUnicode: true,
    });

    // Create components
    this.header = new HeaderComponent(this.screen);
    this.main = new MainComponent(this.screen);
    this.footer = new FooterComponent(this.screen);
    this.statusBar = new StatusBarComponent(this.screen);
    this.sidebar = new SidebarComponent(this.screen);

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle screen resize
    this.screen.on('resize', () => {
      this.screen.render();
    });

    // Handle key events
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.exit();
    });

    // Handle tab navigation
    this.screen.key(['tab'], () => {
      // Cycle focus between components
      if (this.main.getInputArea().focused) {
        this.sidebar.getElement().focus();
      } else if (this.sidebar.getElement().focused) {
        this.main.getInputArea().focus();
      } else {
        this.main.getInputArea().focus();
      }
    });

    // Handle arrow keys for sidebar navigation
    this.screen.key(['up'], () => {
      if (this.sidebar.getElement().focused) {
        this.sidebar.selectPrevious();
      }
    });

    this.screen.key(['down'], () => {
      if (this.sidebar.getElement().focused) {
        this.sidebar.selectNext();
      }
    });

    // Handle enter key in input area
    this.main.getInputArea().on('keypress', (ch: string, key: any) => {
      if (key.name === 'enter') {
        const inputValue = this.main.getInputValue().trim();
        if (inputValue) {
          this.handleInput(inputValue);
          this.main.clearInput();
        }
      }
    });
  }

  /**
   * Initialize the TUI
   */
  public async initialize(): Promise<boolean> {
    try {
      // Show welcome message
      this.main.showWelcome();

      // Focus on input area
      this.main.focusInput();

      // Render the screen
      this.screen.render();

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize TUI:', error);
      return false;
    }
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    // Add to output log
    this.main.addOutput(chalk.gray(`> ${input}`));

    // Process the input
    if (input.startsWith('/')) {
      // Handle slash commands
      await this.handleSlashCommand(input.substring(1));
    } else {
      // Handle regular input (would go to AI in a real implementation)
      this.main.addOutput(chalk.cyan(`AI: Processing your input: "${input}"`));
      this.main.addOutput(chalk.cyan('AI: How else can I assist you today?'));
    }

    // Update status
    this.statusBar.showSuccess('Input processed');
  }

  /**
   * Handle slash commands
   */
  private async handleSlashCommand(command: string): Promise<void> {
    const parts = command.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;
      case 'clear':
        this.main.clearOutput();
        this.statusBar.showSuccess('Output cleared');
        break;
      case 'mode':
        if (args.length > 0) {
          const mode = args[0].toLowerCase();
          if (mode === 'planning' || mode === 'work') {
            this.updateMode(mode as 'planning' | 'work');
            this.statusBar.showSuccess(`Switched to ${mode} mode`);
          } else {
            this.main.addOutput(chalk.red('Invalid mode. Use "planning" or "work"'));
            this.statusBar.showError('Invalid mode');
          }
        } else {
          this.main.addOutput(chalk.yellow('Current mode: planning'));
        }
        break;
      case 'providers':
        this.listProviders();
        break;
      case 'agents':
        this.listAgents();
        break;
      default:
        this.main.addOutput(
          chalk.red(`Unknown command: /${cmd}. Type /help for available commands.`)
        );
        this.statusBar.showError('Unknown command');
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    this.main.addOutput(chalk.bold.blue('Available Commands:'));
    this.main.addOutput(chalk.gray('  /help') + ' - Show this help message');
    this.main.addOutput(chalk.gray('  /clear') + ' - Clear the output log');
    this.main.addOutput(chalk.gray('  /mode planning|work') + ' - Switch between modes');
    this.main.addOutput(chalk.gray('  /providers') + ' - List available AI providers');
    this.main.addOutput(chalk.gray('  /agents') + ' - List available AI agents');
    this.main.addOutput('');
    this.main.addOutput(chalk.bold.blue('Navigation:'));
    this.main.addOutput(chalk.gray('  Tab') + ' - Switch between input and sidebar');
    this.main.addOutput(chalk.gray('  ↑/↓') + ' - Navigate sidebar items');
    this.main.addOutput(chalk.gray('  Ctrl+C') + ' - Exit the application');
    this.statusBar.showInfo('Help displayed');
  }

  /**
   * Update application mode
   */
  private updateMode(mode: 'planning' | 'work'): void {
    this.header.updateModeIndicator(mode);
    this.footer.updateModeIndicator(mode);

    // Update sidebar with mode-specific items
    if (mode === 'planning') {
      this.sidebar.setItems([
        'Project Planning',
        'Requirements Analysis',
        'Architecture Design',
        'Task Breakdown',
        'Risk Assessment',
      ]);
    } else {
      this.sidebar.setItems([
        'Code Implementation',
        'Testing',
        'Debugging',
        'Refactoring',
        'Deployment',
      ]);
    }

    this.main.addOutput(chalk.green(`Switched to ${mode} mode`));
  }

  /**
   * List available providers
   */
  private listProviders(): void {
    const providers = [
      'OpenAI (GPT-4, GPT-3.5-turbo)',
      'Anthropic (Claude 3 Opus, Sonnet)',
      'Google (Gemini Pro, Ultra)',
      'Qwen (Alibaba Cloud)',
      'Cloudflare (Workers AI)',
      'Ollama (Local Models)',
      'LM Studio (Local Models)',
      'vLLM (Local/Cloud Inference)',
    ];

    this.main.addOutput(chalk.bold.blue('Available AI Providers:'));
    for (const provider of providers) {
      this.main.addOutput(chalk.gray(`  • ${provider}`));
    }

    this.statusBar.showInfo('Providers listed');
  }

  /**
   * List available agents
   */
  private listAgents(): void {
    const agents = [
      'Planning Agent - Strategic thinking and architecture design',
      'Code Generation Agent - Clean, efficient code generation',
      'Code Review Agent - Quality and security analysis',
      'Testing Agent - Comprehensive test generation and execution',
      'Debugging Agent - Intelligent debugging assistance',
      'Refactoring Agent - Code optimization and improvement',
      'Security Agent - Vulnerability detection and mitigation',
      'Documentation Agent - Comprehensive documentation generation',
    ];

    this.main.addOutput(chalk.bold.blue('Available AI Agents:'));
    for (const agent of agents) {
      this.main.addOutput(chalk.gray(`  • ${agent}`));
    }

    this.statusBar.showInfo('Agents listed');
  }

  /**
   * Exit the application
   */
  public exit(): void {
    this.screen.destroy();
    process.exit(0);
  }

  /**
   * Get the main screen
   */
  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  /**
   * Get the main component
   */
  public getMainComponent(): MainComponent {
    return this.main;
  }

  /**
   * Get the header component
   */
  public getHeaderComponent(): HeaderComponent {
    return this.header;
  }

  /**
   * Get the footer component
   */
  public getFooterComponent(): FooterComponent {
    return this.footer;
  }

  /**
   * Get the status bar component
   */
  public getStatusBarComponent(): StatusBarComponent {
    return this.statusBar;
  }

  /**
   * Get the sidebar component
   */
  public getSidebarComponent(): SidebarComponent {
    return this.sidebar;
  }

  /**
   * Render the TUI
   */
  public render(): void {
    this.screen.render();
  }

  /**
   * Check if TUI is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }
}
