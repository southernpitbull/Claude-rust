/**
 * CommandPalette.ts
 *
 * Implements an interactive command palette for the AIrchitect TUI system.
 * Provides fuzzy search, keyboard navigation, and quick command execution
 * with real-time filtering and suggestions.
 */

import { TUIComponent, ComponentOptions } from '../TUIManager';
import { Logger } from '../../utils/Logger';

export interface CommandPaletteOptions extends ComponentOptions {
  placeholder?: string;
  maxResults?: number;
  enableFuzzySearch?: boolean;
  showDescriptions?: boolean;
  showIcons?: boolean;
  theme?: 'default' | 'dark' | 'light' | 'monokai';
}

export interface PaletteCommand {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  enabled: boolean;
  hotkey?: string;
  execute: (...args: any[]) => Promise<void>;
  validate?: (...args: any[]) => boolean;
  getHelp?: () => string;
}

export interface PaletteState {
  isOpen: boolean;
  inputValue: string;
  selectedIndex: number;
  filteredCommands: PaletteCommand[];
  allCommands: PaletteCommand[];
  categories: string[];
  lastUsed: Date;
  usageCount: number;
}

export class CommandPalette implements TUIComponent {
  public id: string;
  public name: string;
  public type: string;
  public element: any; // Blessed element
  public options: CommandPaletteOptions;
  public state: PaletteState;
  public logger: Logger;
  public initialized: boolean;
  public visible: boolean;
  public enabled: boolean;
  public position: { top: number; left: number; width: number; height: number };
  public createdAt: Date;
  public updatedAt: Date;
  public usageCount: number;
  public lastUsed?: Date;

  constructor(options?: CommandPaletteOptions) {
    this.id = `palette-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = 'Command Palette';
    this.type = 'palette';
    this.options = {
      placeholder: 'Type a command...',
      maxResults: 10,
      enableFuzzySearch: true,
      showDescriptions: true,
      showIcons: true,
      theme: 'default',
      ...options,
    };

    this.state = {
      isOpen: false,
      inputValue: '',
      selectedIndex: 0,
      filteredCommands: [],
      allCommands: [],
      categories: [],
      lastUsed: new Date(),
      usageCount: 0,
    };

    this.logger = new Logger('CommandPalette');
    this.initialized = false;
    this.visible = false;
    this.enabled = true;
    this.position = { top: 0, left: 0, width: 100, height: 100 };
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.usageCount = 0;
    this.lastUsed = undefined;
  }

  /**
   * Initialize the command palette
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing command palette');

      if (this.initialized) {
        this.logger.warn('Command palette already initialized');
        return;
      }

      // Create the blessed element
      this.element = this.createElement();

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize default commands
      this.initializeDefaultCommands();

      // Update categories
      this.updateCategories();

      this.initialized = true;
      this.usageCount++;
      this.lastUsed = new Date();
      this.updatedAt = new Date();

      this.logger.info('Command palette initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize command palette', error);
      throw error;
    }
  }

  /**
   * Create the blessed element for the command palette
   */
  private createElement(): any {
    try {
      this.logger.info('Creating command palette element');

      // In a real implementation, this would create a blessed element
      // For now, we'll return a mock element
      const element = {
        type: 'palette',
        setContent: (content: string) => {
          this.logger.info(`Setting palette content: ${content.substring(0, 50)}...`);
        },
        setLabel: (label: string) => {
          this.logger.info(`Setting palette label: ${label}`);
        },
        show: () => {
          this.visible = true;
          this.logger.info('Palette element shown');
        },
        hide: () => {
          this.visible = false;
          this.logger.info('Palette element hidden');
        },
        destroy: () => {
          this.logger.info('Palette element destroyed');
        },
        focus: () => {
          this.logger.info('Palette element focused');
        },
        blur: () => {
          this.logger.info('Palette element blurred');
        },
        on: (event: string, handler: (...args: any[]) => void) => {
          this.logger.info(`Event handler registered for: ${event}`);
        },
        removeListener: (event: string, handler: (...args: any[]) => void) => {
          this.logger.info(`Event handler removed for: ${event}`);
        },
        emit: (event: string, ...args: any[]) => {
          this.logger.info(`Event emitted: ${event}`);
        },
      };

      this.logger.info('Command palette element created successfully');
      return element;
    } catch (error) {
      this.logger.error('Failed to create command palette element', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    try {
      this.logger.info('Setting up command palette event handlers');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot set up event handlers');
        return;
      }

      // Handle key press events
      this.element.on('keypress', (ch: string, key: any) => {
        this.logger.info('Key press event detected in command palette');
        this.handleKeyPress(ch, key);
      });

      // Handle input change events
      this.element.on('input', (value: string) => {
        this.logger.info('Input change event detected in command palette');
        this.handleInputChange(value);
      });

      // Handle focus events
      this.element.on('focus', () => {
        this.logger.info('Command palette focused');
        this.handleFocus();
      });

      // Handle blur events
      this.element.on('blur', () => {
        this.logger.info('Command palette blurred');
        this.handleBlur();
      });

      this.logger.info('Command palette event handlers set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up command palette event handlers', error);
      throw error;
    }
  }

  /**
   * Initialize default commands
   */
  private initializeDefaultCommands(): void {
    try {
      this.logger.info('Initializing default commands');

      // Add default commands
      const defaultCommands: PaletteCommand[] = [
        {
          id: 'cmd-help',
          name: 'help',
          description: 'Show help information',
          category: 'system',
          icon: '❓',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing help command');
            console.log('Showing help information...');
          },
        },
        {
          id: 'cmd-version',
          name: 'version',
          description: 'Show version information',
          category: 'system',
          icon: 'ℹ️',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing version command');
            console.log('Showing version information...');
          },
        },
        {
          id: 'cmd-clear',
          name: 'clear',
          description: 'Clear the screen',
          category: 'system',
          icon: '🧹',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing clear command');
            console.log('Clearing screen...');
          },
        },
        {
          id: 'cmd-exit',
          name: 'exit',
          description: 'Exit the application',
          category: 'system',
          icon: '🚪',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing exit command');
            console.log('Exiting application...');
            process.exit(0);
          },
        },
        {
          id: 'cmd-chat',
          name: 'chat',
          description: 'Start an interactive chat session',
          category: 'ai',
          icon: '💬',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing chat command');
            console.log('Starting chat session...');
          },
        },
        {
          id: 'cmd-plan',
          name: 'plan',
          description: 'Start a planning session',
          category: 'ai',
          icon: '📝',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing plan command');
            console.log('Starting planning session...');
          },
        },
        {
          id: 'cmd-work',
          name: 'work',
          description: 'Start a work session',
          category: 'ai',
          icon: '🛠️',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing work command');
            console.log('Starting work session...');
          },
        },
        {
          id: 'cmd-config',
          name: 'config',
          description: 'Manage configuration',
          category: 'system',
          icon: '⚙️',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing config command');
            console.log('Managing configuration...');
          },
        },
        {
          id: 'cmd-creds',
          name: 'creds',
          description: 'Manage credentials',
          category: 'system',
          icon: '🔑',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing creds command');
            console.log('Managing credentials...');
          },
        },
        {
          id: 'cmd-memory',
          name: 'memory',
          description: 'Manage project memory',
          category: 'system',
          icon: '🧠',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing memory command');
            console.log('Managing project memory...');
          },
        },
        {
          id: 'cmd-agents',
          name: 'agents',
          description: 'Manage intelligent agents',
          category: 'ai',
          icon: '🤖',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing agents command');
            console.log('Managing agents...');
          },
        },
        {
          id: 'cmd-checkpoint',
          name: 'checkpoint',
          description: 'Manage checkpoints',
          category: 'system',
          icon: '💾',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing checkpoint command');
            console.log('Managing checkpoints...');
          },
        },
        {
          id: 'cmd-plugins',
          name: 'plugins',
          description: 'Manage plugins',
          category: 'system',
          icon: '🔌',
          enabled: true,
          execute: async () => {
            this.logger.info('Executing plugins command');
            console.log('Managing plugins...');
          },
        },
      ];

      this.state.allCommands = defaultCommands;
      this.state.filteredCommands = [...defaultCommands];

      this.logger.info(`Initialized ${defaultCommands.length} default commands`);
    } catch (error) {
      this.logger.error('Failed to initialize default commands', error);
      throw error;
    }
  }

  /**
   * Update command categories
   */
  private updateCategories(): void {
    try {
      this.logger.info('Updating command categories');

      const categories = new Set<string>();

      for (const command of this.state.allCommands) {
        categories.add(command.category);
      }

      this.state.categories = Array.from(categories).sort();

      this.logger.info(`Updated ${this.state.categories.length} command categories`);
    } catch (error) {
      this.logger.error('Failed to update command categories', error);
      throw error;
    }
  }

  /**
   * Handle key press events
   */
  private handleKeyPress(ch: string, key: any): void {
    try {
      this.logger.info(`Handling key press: ${ch} (${key ? key.name : 'unknown'})`);

      // Handle common key combinations
      if (key && key.ctrl && key.name === 'p') {
        // Control+P - open command palette
        this.open();
      } else if (key && key.name === 'escape') {
        // Escape - close command palette
        this.close();
      } else if (key && key.name === 'enter') {
        // Enter - execute selected command
        this.executeSelectedCommand();
      } else if (key && key.name === 'up') {
        // Up arrow - move selection up
        this.moveSelectionUp();
      } else if (key && key.name === 'down') {
        // Down arrow - move selection down
        this.moveSelectionDown();
      } else if (key && key.name === 'tab') {
        // Tab - cycle through suggestions
        this.cycleSuggestions();
      }

      this.logger.info('Key press handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle key press', error);
      throw error;
    }
  }

  /**
   * Handle input change events
   */
  private handleInputChange(value: string): void {
    try {
      this.logger.info(`Handling input change: ${value}`);

      this.state.inputValue = value;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Filter commands based on input
      this.filterCommands();

      // Update the element content
      this.updateContent();

      this.logger.info('Input change handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle input change', error);
      throw error;
    }
  }

  /**
   * Handle focus events
   */
  private handleFocus(): void {
    try {
      this.logger.info('Handling command palette focus');

      // Update state
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // In a real implementation, we'd focus the input element

      this.logger.info('Command palette focus handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle command palette focus', error);
      throw error;
    }
  }

  /**
   * Handle blur events
   */
  private handleBlur(): void {
    try {
      this.logger.info('Handling command palette blur');

      // Update state
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // In a real implementation, we'd blur the input element

      this.logger.info('Command palette blur handled successfully');
    } catch (error) {
      this.logger.error('Failed to handle command palette blur', error);
      throw error;
    }
  }

  /**
   * Filter commands based on input value
   */
  private filterCommands(): void {
    try {
      this.logger.info(`Filtering commands for input: ${this.state.inputValue}`);

      const inputValue = this.state.inputValue.toLowerCase().trim();

      if (!inputValue) {
        // No input, show all commands
        this.state.filteredCommands = [...this.state.allCommands]
          .filter((cmd) => cmd.enabled)
          .slice(0, this.options.maxResults || 10);
        this.state.selectedIndex = 0;
        return;
      }

      // Filter commands based on name, description, and category
      let filtered = this.state.allCommands.filter((cmd) => {
        if (!cmd.enabled) {
          return false;
        }

        const nameMatch = cmd.name.toLowerCase().includes(inputValue);
        const descriptionMatch =
          cmd.description && cmd.description.toLowerCase().includes(inputValue);
        const categoryMatch = cmd.category.toLowerCase().includes(inputValue);

        return nameMatch || descriptionMatch || categoryMatch;
      });

      // If fuzzy search is enabled, sort by relevance
      if (this.options.enableFuzzySearch) {
        filtered = this.sortByRelevance(filtered, inputValue);
      }

      // Limit results
      this.state.filteredCommands = filtered.slice(0, this.options.maxResults || 10);
      this.state.selectedIndex = 0;

      this.logger.info(`Filtered to ${this.state.filteredCommands.length} commands`);
    } catch (error) {
      this.logger.error('Failed to filter commands', error);
      throw error;
    }
  }

  /**
   * Sort commands by relevance to input
   */
  private sortByRelevance(commands: PaletteCommand[], input: string): PaletteCommand[] {
    try {
      this.logger.info(`Sorting ${commands.length} commands by relevance to: ${input}`);

      return [...commands].sort((a, b) => {
        // Calculate relevance scores
        const scoreA = this.calculateRelevanceScore(a, input);
        const scoreB = this.calculateRelevanceScore(b, input);

        // Sort by descending relevance
        return scoreB - scoreA;
      });
    } catch (error) {
      this.logger.error(`Failed to sort commands by relevance to: ${input}`, error);
      throw error;
    }
  }

  /**
   * Calculate relevance score for a command
   */
  private calculateRelevanceScore(command: PaletteCommand, input: string): number {
    try {
      this.logger.info(`Calculating relevance score for: ${command.name} with input: ${input}`);

      let score = 0;

      // Exact match gets highest score
      if (command.name.toLowerCase() === input) {
        score += 100;
      }

      // Prefix match
      if (command.name.toLowerCase().startsWith(input)) {
        score += 80;
      }

      // Contains match
      if (command.name.toLowerCase().includes(input)) {
        score += 60;
      }

      // Description match
      if (command.description && command.description.toLowerCase().includes(input)) {
        score += 40;
      }

      // Category match
      if (command.category.toLowerCase().includes(input)) {
        score += 20;
      }

      // Usage frequency boost
      score += command.usageCount || 0;

      this.logger.info(`Relevance score for ${command.name}: ${score}`);
      return score;
    } catch (error) {
      this.logger.error(`Failed to calculate relevance score for: ${command.name}`, error);
      throw error;
    }
  }

  /**
   * Update the palette content
   */
  public updateContent(): void {
    try {
      this.logger.info('Updating command palette content');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot update content');
        return;
      }

      // Build the content
      let content = '';

      // Add input area
      content += `${this.options.placeholder || 'Type a command...'}\n`;
      content += `${this.state.inputValue}${this.getBlinkingCursor()}\n\n`;

      // Add filtered commands
      if (this.state.filteredCommands.length > 0) {
        for (let i = 0; i < this.state.filteredCommands.length; i++) {
          const command = this.state.filteredCommands[i];
          const isSelected = i === this.state.selectedIndex;
          const marker = isSelected ? '> ' : '  ';
          const icon = this.options.showIcons && command.icon ? `${command.icon} ` : '';
          const description =
            this.options.showDescriptions && command.description ? ` - ${command.description}` : '';

          content += `${marker}${icon}${command.name}${description}\n`;
        }
      } else {
        content += 'No matching commands found\n';
      }

      // Set the content on the element
      this.element.setContent(content);

      this.logger.info('Command palette content updated successfully');
    } catch (error) {
      this.logger.error('Failed to update command palette content', error);
      throw error;
    }
  }

  /**
   * Get blinking cursor representation
   */
  private getBlinkingCursor(): string {
    try {
      // In a real implementation, this would show a blinking cursor
      // For now, we'll just show a static cursor
      return '|';
    } catch (error) {
      this.logger.error('Failed to get blinking cursor', error);
      throw error;
    }
  }

  /**
   * Move selection up
   */
  private moveSelectionUp(): void {
    try {
      this.logger.info('Moving selection up');

      if (this.state.filteredCommands.length === 0) {
        this.logger.warn('No commands to select');
        return;
      }

      this.state.selectedIndex =
        (this.state.selectedIndex - 1 + this.state.filteredCommands.length) %
        this.state.filteredCommands.length;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Update content to reflect new selection
      this.updateContent();

      this.logger.info(`Selection moved to index: ${this.state.selectedIndex}`);
    } catch (error) {
      this.logger.error('Failed to move selection up', error);
      throw error;
    }
  }

  /**
   * Move selection down
   */
  private moveSelectionDown(): void {
    try {
      this.logger.info('Moving selection down');

      if (this.state.filteredCommands.length === 0) {
        this.logger.warn('No commands to select');
        return;
      }

      this.state.selectedIndex =
        (this.state.selectedIndex + 1) % this.state.filteredCommands.length;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Update content to reflect new selection
      this.updateContent();

      this.logger.info(`Selection moved to index: ${this.state.selectedIndex}`);
    } catch (error) {
      this.logger.error('Failed to move selection down', error);
      throw error;
    }
  }

  /**
   * Cycle through suggestions
   */
  private cycleSuggestions(): void {
    try {
      this.logger.info('Cycling through suggestions');

      // In a real implementation, this would cycle through auto-completion suggestions
      // For now, this is a placeholder

      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      this.logger.info('Suggestions cycled successfully');
    } catch (error) {
      this.logger.error('Failed to cycle through suggestions', error);
      throw error;
    }
  }

  /**
   * Execute the selected command
   */
  private async executeSelectedCommand(): Promise<void> {
    try {
      this.logger.info('Executing selected command');

      if (this.state.filteredCommands.length === 0) {
        this.logger.warn('No commands to execute');
        return;
      }

      const selectedCommand = this.state.filteredCommands[this.state.selectedIndex];
      if (!selectedCommand) {
        this.logger.warn(`Selected command not found at index: ${this.state.selectedIndex}`);
        return;
      }

      // Close the palette first
      this.close();

      // Execute the command
      await selectedCommand.execute();

      // Update usage statistics
      selectedCommand.usageCount = (selectedCommand.usageCount || 0) + 1;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      this.logger.info(`Command executed successfully: ${selectedCommand.name}`);
    } catch (error) {
      this.logger.error('Failed to execute selected command', error);
      throw error;
    }
  }

  /**
   * Open the command palette
   */
  public open(): void {
    try {
      this.logger.info('Opening command palette');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot open');
        return;
      }

      this.state.isOpen = true;
      this.state.inputValue = '';
      this.state.selectedIndex = 0;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();
      this.usageCount++;

      // Show the element
      this.element.show();
      this.visible = true;

      // Focus the element
      this.element.focus();

      // Update content
      this.updateContent();

      this.logger.info('Command palette opened successfully');
    } catch (error) {
      this.logger.error('Failed to open command palette', error);
      throw error;
    }
  }

  /**
   * Close the command palette
   */
  public close(): void {
    try {
      this.logger.info('Closing command palette');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot close');
        return;
      }

      this.state.isOpen = false;
      this.state.inputValue = '';
      this.state.selectedIndex = 0;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Hide the element
      this.element.hide();
      this.visible = false;

      // Blur the element
      this.element.blur();

      this.logger.info('Command palette closed successfully');
    } catch (error) {
      this.logger.error('Failed to close command palette', error);
      throw error;
    }
  }

  /**
   * Check if the command palette is open
   */
  public isOpen(): boolean {
    return this.state.isOpen;
  }

  /**
   * Add a command to the palette
   */
  public addCommand(command: PaletteCommand): void {
    try {
      this.logger.info(`Adding command to palette: ${command.name}`);

      // Check if command already exists
      const existingIndex = this.state.allCommands.findIndex((cmd) => cmd.id === command.id);
      if (existingIndex >= 0) {
        // Update existing command
        this.state.allCommands[existingIndex] = command;
        this.logger.info(`Command updated in palette: ${command.name}`);
      } else {
        // Add new command
        this.state.allCommands.push(command);
        this.logger.info(`Command added to palette: ${command.name}`);
      }

      // Update categories
      this.updateCategories();

      // Re-filter commands
      this.filterCommands();

      // Update content
      this.updateContent();

      this.logger.info(`Command added/updated successfully: ${command.name}`);
    } catch (error) {
      this.logger.error(`Failed to add command to palette: ${command.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a command from the palette
   */
  public removeCommand(commandId: string): boolean {
    try {
      this.logger.info(`Removing command from palette: ${commandId}`);

      const initialLength = this.state.allCommands.length;
      this.state.allCommands = this.state.allCommands.filter((cmd) => cmd.id !== commandId);

      const removed = this.state.allCommands.length < initialLength;
      if (removed) {
        this.logger.info(`Command removed from palette: ${commandId}`);

        // Update categories
        this.updateCategories();

        // Re-filter commands
        this.filterCommands();

        // Update content
        this.updateContent();
      } else {
        this.logger.warn(`Command not found in palette: ${commandId}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove command from palette: ${commandId}`, error);
      throw error;
    }
  }

  /**
   * Get a command by ID
   */
  public getCommand(commandId: string): PaletteCommand | undefined {
    return this.state.allCommands.find((cmd) => cmd.id === commandId);
  }

  /**
   * Get all commands
   */
  public getAllCommands(): PaletteCommand[] {
    return [...this.state.allCommands];
  }

  /**
   * Get commands by category
   */
  public getCommandsByCategory(category: string): PaletteCommand[] {
    try {
      this.logger.info(`Getting commands by category: ${category}`);

      const commands = this.state.allCommands.filter((cmd) => cmd.category === category);

      this.logger.info(`Found ${commands.length} commands in category: ${category}`);
      return commands;
    } catch (error) {
      this.logger.error(`Failed to get commands by category: ${category}`, error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  public getAllCategories(): string[] {
    return [...this.state.categories];
  }

  /**
   * Enable a command
   */
  public enableCommand(commandId: string): boolean {
    try {
      this.logger.info(`Enabling command: ${commandId}`);

      const command = this.state.allCommands.find((cmd) => cmd.id === commandId);
      if (!command) {
        this.logger.warn(`Command not found: ${commandId}`);
        return false;
      }

      command.enabled = true;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Re-filter commands
      this.filterCommands();

      // Update content
      this.updateContent();

      this.logger.info(`Command enabled successfully: ${command.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to enable command: ${commandId}`, error);
      throw error;
    }
  }

  /**
   * Disable a command
   */
  public disableCommand(commandId: string): boolean {
    try {
      this.logger.info(`Disabling command: ${commandId}`);

      const command = this.state.allCommands.find((cmd) => cmd.id === commandId);
      if (!command) {
        this.logger.warn(`Command not found: ${commandId}`);
        return false;
      }

      command.enabled = false;
      this.state.lastUsed = new Date();
      this.updatedAt = new Date();

      // Re-filter commands
      this.filterCommands();

      // Update content
      this.updateContent();

      this.logger.info(`Command disabled successfully: ${command.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to disable command: ${commandId}`, error);
      throw error;
    }
  }

  /**
   * Check if a command is enabled
   */
  public isCommandEnabled(commandId: string): boolean {
    try {
      this.logger.info(`Checking if command is enabled: ${commandId}`);

      const command = this.state.allCommands.find((cmd) => cmd.id === commandId);
      if (!command) {
        this.logger.warn(`Command not found: ${commandId}`);
        return false;
      }

      this.logger.info(`Command ${command.name} is ${command.enabled ? 'enabled' : 'disabled'}`);
      return command.enabled;
    } catch (error) {
      this.logger.error(`Failed to check if command is enabled: ${commandId}`, error);
      throw error;
    }
  }

  /**
   * Focus the command palette
   */
  public focus(): void {
    try {
      this.logger.info('Focusing command palette');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot focus');
        return;
      }

      this.element.focus();

      this.logger.info('Command palette focused successfully');
    } catch (error) {
      this.logger.error('Failed to focus command palette', error);
      throw error;
    }
  }

  /**
   * Blur the command palette
   */
  public blur(): void {
    try {
      this.logger.info('Blurring command palette');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot blur');
        return;
      }

      this.element.blur();

      this.logger.info('Command palette blurred successfully');
    } catch (error) {
      this.logger.error('Failed to blur command palette', error);
      throw error;
    }
  }

  /**
   * Check if the command palette is focused
   */
  public isFocused(): boolean {
    try {
      if (!this.element || !this.initialized) {
        return false;
      }

      // In a real implementation, we'd check the element's focus state
      // For now, we'll return false as a placeholder
      return false;
    } catch (error) {
      this.logger.error('Failed to check if command palette is focused', error);
      throw error;
    }
  }

  /**
   * Destroy the command palette
   */
  public destroy(): void {
    try {
      this.logger.info('Destroying command palette');

      if (!this.element || !this.initialized) {
        this.logger.warn('Command palette not initialized, cannot destroy');
        return;
      }

      // Clean up the element
      this.element.destroy();

      // Clean up any intervals or timeouts
      // In a real implementation, we'd clear any intervals or timeouts

      this.initialized = false;

      this.logger.info('Command palette destroyed successfully');
    } catch (error) {
      this.logger.error('Failed to destroy command palette', error);
      throw error;
    }
  }

  /**
   * Get command palette statistics
   */
  public getStats(): {
    id: string;
    name: string;
    type: string;
    initialized: boolean;
    visible: boolean;
    enabled: boolean;
    usageCount: number;
    lastUsed?: Date;
    position: { top: number; left: number; width: number; height: number };
    state: PaletteState;
    options: CommandPaletteOptions;
  } {
    try {
      this.logger.info('Getting command palette statistics');

      const stats = {
        id: this.id,
        name: this.name,
        type: this.type,
        initialized: this.initialized,
        visible: this.visible,
        enabled: this.enabled,
        usageCount: this.usageCount,
        lastUsed: this.lastUsed,
        position: { ...this.position },
        state: { ...this.state },
        options: { ...this.options },
      };

      this.logger.info('Command palette statistics retrieved successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to get command palette statistics', error);
      throw error;
    }
  }

  /**
   * Validate the command palette
   */
  public validate(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating command palette');

      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Validate required properties
      if (!this.id) {
        validation.errors.push('Component ID is required');
        validation.valid = false;
      }

      if (!this.name) {
        validation.errors.push('Component name is required');
        validation.valid = false;
      }

      if (!this.type) {
        validation.errors.push('Component type is required');
        validation.valid = false;
      }

      // Validate state
      if (
        this.state.selectedIndex < 0 ||
        this.state.selectedIndex >= this.state.filteredCommands.length
      ) {
        validation.warnings.push('Selected index is out of bounds');
      }

      if (this.state.inputValue && this.state.inputValue.length > 1000) {
        validation.warnings.push('Input value is unusually long');
      }

      // Validate options
      if (this.options.maxResults !== undefined && this.options.maxResults <= 0) {
        validation.errors.push('Max results must be positive');
        validation.valid = false;
      }

      if (this.options.maxResults !== undefined && this.options.maxResults > 100) {
        validation.warnings.push('Max results is unusually high');
      }

      // Validate position
      if (this.position.top < 0) {
        validation.errors.push('Position top must be non-negative');
        validation.valid = false;
      }

      if (this.position.left < 0) {
        validation.errors.push('Position left must be non-negative');
        validation.valid = false;
      }

      if (this.position.width <= 0) {
        validation.errors.push('Position width must be positive');
        validation.valid = false;
      }

      if (this.position.height <= 0) {
        validation.errors.push('Position height must be positive');
        validation.valid = false;
      }

      this.logger.info(
        `Command palette validation completed: ${validation.valid ? 'valid' : 'invalid'}`
      );
      return validation;
    } catch (error) {
      this.logger.error('Failed to validate command palette', error);
      throw error;
    }
  }

  /**
   * Export the command palette configuration
   */
  public exportConfiguration(): CommandPaletteOptions {
    try {
      this.logger.info('Exporting command palette configuration');

      const config: CommandPaletteOptions = { ...this.options };

      this.logger.info('Command palette configuration exported successfully');
      return config;
    } catch (error) {
      this.logger.error('Failed to export command palette configuration', error);
      throw error;
    }
  }

  /**
   * Import the command palette configuration
   */
  public importConfiguration(config: CommandPaletteOptions): void {
    try {
      this.logger.info('Importing command palette configuration');

      // Update options
      Object.assign(this.options, config);

      // Update content to reflect new configuration
      this.updateContent();

      this.logger.info('Command palette configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import command palette configuration', error);
      throw error;
    }
  }

  /**
   * Find optimization opportunities for the command palette
   */
  public findOptimizationOpportunities(): Array<{
    type: 'command' | 'filter' | 'function' | 'performance';
    id: string;
    name: string;
    suggestion: string;
    confidence: number; // 0-100 percentage
    estimatedPerformanceGain: number; // ms
  }> {
    try {
      this.logger.info('Finding optimization opportunities for command palette');

      const opportunities: Array<{
        type: 'command' | 'filter' | 'function' | 'performance';
        id: string;
        name: string;
        suggestion: string;
        confidence: number;
        estimatedPerformanceGain: number;
      }> = [];

      // Find unused commands
      const unusedCommands = this.state.allCommands.filter((cmd) => !cmd.usageCount);
      for (const command of unusedCommands) {
        opportunities.push({
          type: 'command',
          id: command.id,
          name: command.name,
          suggestion: `Command has never been used. Consider removing it.`,
          confidence: 90,
          estimatedPerformanceGain: 5, // ms
        });
      }

      // Find infrequently used commands
      const infrequentCommands = this.state.allCommands
        .filter((cmd) => cmd.usageCount && cmd.usageCount < 5)
        .sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0))
        .slice(0, 5);

      for (const command of infrequentCommands) {
        opportunities.push({
          type: 'command',
          id: command.id,
          name: command.name,
          suggestion: `Command is rarely used (${command.usageCount} times). Consider hiding it by default.`,
          confidence: 80,
          estimatedPerformanceGain: 3, // ms
        });
      }

      // Sort opportunities by confidence (highest first)
      opportunities.sort((a, b) => b.confidence - a.confidence);

      this.logger.info(
        `Found ${opportunities.length} optimization opportunities for command palette`
      );
      return opportunities;
    } catch (error) {
      this.logger.error('Failed to find optimization opportunities for command palette', error);
      throw error;
    }
  }

  /**
   * Create a test command palette
   */
  public createTestPalette(): string {
    try {
      this.logger.info('Creating test command palette');

      const testPalette = `
# AIrchitect Test Command Palette

## Input Area
{{input.placeholder}}: {{input.value}}{{cursor}}

## Available Commands
{% for command in commands %}
- {{command.icon}} {{command.name}} - {{command.description}}
{% endfor %}

## Categories
{% for category in categories %}
- {{category}}
{% endfor %}

## Statistics
- Total Commands: {{stats.totalCommands}}
- Enabled Commands: {{stats.enabledCommands}}
- Categories: {{stats.categories}}
- Usage Count: {{stats.usageCount}}

Generated on: {{now()|date}}
      `.trim();

      this.logger.info('Test command palette created successfully');
      return testPalette;
    } catch (error) {
      this.logger.error('Failed to create test command palette', error);
      throw error;
    }
  }

  /**
   * Test command palette functionality
   */
  public async test(): Promise<{
    success: boolean;
    results: Array<{ test: string; passed: boolean; message?: string }>;
  }> {
    try {
      this.logger.info('Testing command palette functionality');

      const results: Array<{ test: string; passed: boolean; message?: string }> = [];

      // Test 1: Initialization
      try {
        await this.initialize();
        results.push({
          test: 'Initialization',
          passed: this.initialized,
          message: this.initialized
            ? 'Command palette initialized successfully'
            : 'Failed to initialize command palette',
        });
      } catch (error) {
        results.push({
          test: 'Initialization',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 2: Content update
      try {
        this.updateContent();
        results.push({
          test: 'Content Update',
          passed: true,
          message: 'Content updated successfully',
        });
      } catch (error) {
        results.push({
          test: 'Content Update',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 3: Command addition
      try {
        const testCommand: PaletteCommand = {
          id: 'test-command-123',
          name: 'test',
          description: 'Test command',
          category: 'testing',
          icon: '🧪',
          enabled: true,
          execute: async () => console.log('Test command executed'),
        };

        this.addCommand(testCommand);
        const addedCommand = this.getCommand('test-command-123');
        results.push({
          test: 'Command Addition',
          passed: !!addedCommand,
          message: addedCommand ? 'Command added successfully' : 'Failed to add command',
        });

        // Clean up
        if (addedCommand) {
          this.removeCommand('test-command-123');
        }
      } catch (error) {
        results.push({
          test: 'Command Addition',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 4: Command removal
      try {
        const testCommand: PaletteCommand = {
          id: 'test-command-456',
          name: 'test-remove',
          description: 'Test command for removal',
          category: 'testing',
          icon: '🗑️',
          enabled: true,
          execute: async () => console.log('Test removal command executed'),
        };

        this.addCommand(testCommand);
        const removed = this.removeCommand('test-command-456');
        results.push({
          test: 'Command Removal',
          passed: removed,
          message: removed ? 'Command removed successfully' : 'Failed to remove command',
        });
      } catch (error) {
        results.push({
          test: 'Command Removal',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 5: Command filtering
      try {
        this.state.inputValue = 'help';
        this.filterCommands();
        results.push({
          test: 'Command Filtering',
          passed: true,
          message: 'Commands filtered successfully',
        });
      } catch (error) {
        results.push({
          test: 'Command Filtering',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 6: Command execution
      try {
        // Mock console.log to capture output
        const originalLog = console.log;
        let logOutput = '';
        console.log = (...args) => {
          logOutput += args.join(' ') + '\n';
        };

        await this.executeSelectedCommand();

        // Restore console.log
        console.log = originalLog;

        results.push({
          test: 'Command Execution',
          passed: true,
          message: 'Command executed successfully',
        });
      } catch (error) {
        results.push({
          test: 'Command Execution',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 7: Palette opening
      try {
        this.open();
        const isOpen = this.isOpen();
        results.push({
          test: 'Palette Opening',
          passed: isOpen,
          message: isOpen ? 'Palette opened successfully' : 'Failed to open palette',
        });
      } catch (error) {
        results.push({
          test: 'Palette Opening',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 8: Palette closing
      try {
        this.close();
        const isOpen = this.isOpen();
        results.push({
          test: 'Palette Closing',
          passed: !isOpen,
          message: !isOpen ? 'Palette closed successfully' : 'Failed to close palette',
        });
      } catch (error) {
        results.push({
          test: 'Palette Closing',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 9: Validation
      try {
        const validation = this.validate();
        results.push({
          test: 'Validation',
          passed: validation.valid,
          message: validation.valid
            ? 'Command palette is valid'
            : `Command palette validation failed: ${validation.errors.join(', ')}`,
        });
      } catch (error) {
        results.push({
          test: 'Validation',
          passed: false,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Test 10: Statistics retrieval
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

      // Determine overall success
      const success = results.every((result) => result.passed);

      this.logger.info(`Command palette test completed: ${success ? 'passed' : 'failed'}`);
      return { success, results };
    } catch (error) {
      this.logger.error('Failed to test command palette functionality', error);
      throw error;
    }
  }
}
