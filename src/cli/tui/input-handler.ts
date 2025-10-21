import { LayoutManager } from './layout-manager';
import { Renderer } from './renderer';

/**
 * InputHandler processes user input and keyboard events
 * within the TUI interface
 */
export class InputHandler {
  private layoutManager: LayoutManager;
  private renderer: Renderer;
  private inputBuffer: string = '';
  private history: string[] = [];
  private historyIndex: number = -1;

  constructor(layoutManager: LayoutManager, renderer: Renderer) {
    this.layoutManager = layoutManager;
    this.renderer = renderer;
    this.setupInputHandling();
  }

  private setupInputHandling(): void {
    const mainScreen = this.layoutManager.getMainScreen();
    const inputArea = this.renderer.getInputArea();

    // Handle input events
    inputArea.on('submit', (input: string) => {
      this.handleInput(input);
    });

    // Handle special keys
    inputArea.key(['enter'], (ch: string, key: any) => {
      if (key.shift) {
        // Allow new line if shift is pressed
        inputArea.insertLine();
      } else {
        // Submit input
        const value = inputArea.getValue();
        this.handleInput(value);
        inputArea.setValue('');
      }
    });

    // History navigation
    inputArea.key(['up'], (ch: string, key: any) => {
      if (this.history.length > 0) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          const prevInput = this.history[this.history.length - 1 - this.historyIndex];
          inputArea.setValue(prevInput);
        }
      }
    });

    inputArea.key(['down'], (ch: string, key: any) => {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const prevInput = this.history[this.history.length - 1 - this.historyIndex];
        inputArea.setValue(prevInput);
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        inputArea.setValue('');
      }
    });

    // Auto-completion
    inputArea.key(['tab'], (ch: string, key: any) => {
      this.handleAutocomplete(inputArea.getValue());
    });

    // Switch between input and chat area
    mainScreen.key(['tab'], (ch: string, key: any) => {
      // Cycle between elements
      // For simplicity, just focus on input area
      inputArea.focus();
    });
  }

  /**
   * Handles submitted input
   */
  private handleInput(input: string): void {
    if (input.trim() === '') {
      return;
    }

    // Add to history
    this.history.push(input);
    if (this.history.length > 50) {
      // Limit history size
      this.history.shift();
    }
    this.historyIndex = -1; // Reset history index

    // Display user input in chat
    this.renderer.addToChat(input, 'user');

    // Process the command
    this.processCommand(input.trim());
  }

  /**
   * Processes different types of commands
   */
  private processCommand(input: string): void {
    if (input.startsWith('/')) {
      // Slash command
      this.processSlashCommand(input);
    } else {
      // Regular prompt
      this.processPrompt(input);
    }
  }

  /**
   * Processes slash commands
   */
  private processSlashCommand(command: string): void {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;
      case 'clear':
        this.renderer.clearChat();
        break;
      case 'mode':
        this.toggleMode();
        break;
      case 'providers':
        this.listProviders();
        break;
      case 'agents':
        this.listAgents();
        break;
      default:
        this.renderer.addToChat(
          `Unknown command: /${cmd}. Type /help for available commands.`,
          'ai'
        );
    }
  }

  /**
   * Processes regular prompts
   */
  private processPrompt(prompt: string): void {
    // For now, echo back the prompt
    // In a real implementation, this would connect to AI providers
    this.renderer.addToChat(
      `Processing your request: "${prompt}"\n[In a full implementation, this would connect to AI providers]`,
      'ai'
    );
  }

  /**
   * Shows help information
   */
  private showHelp(): void {
    const helpText = `
Available commands:
/help - Show this help message
/clear - Clear the chat history
/mode - Toggle between planning and work modes
/providers - List available AI providers
/agents - List available AI agents
/plan - Enter planning mode
/work - Enter work mode
/github - GitHub integration commands
/linear - Linear integration commands
/config - Configuration management
/creds - Credential management
/agents - Agent management
    `.trim();

    this.renderer.addToChat(helpText, 'ai');
  }

  /**
   * Toggles between planning and work modes
   */
  private toggleMode(): void {
    // This would typically call an external service to change modes
    const currentMode = this.layoutManager.getFooter().getByName('mode')?.content?.includes('Work')
      ? 'work'
      : 'planning';
    const newMode = currentMode === 'work' ? 'planning' : 'work';

    this.layoutManager.updateModeIndicator(newMode);
    this.renderer.addToChat(
      `Switched to ${newMode} mode. In this mode, ${newMode === 'planning' ? 'file modifications are disabled' : 'file modifications are enabled'}.`,
      'ai'
    );
  }

  /**
   * Lists available AI providers
   */
  private listProviders(): void {
    const providers = [
      'OpenAI (GPT-4, GPT-3.5)',
      'Anthropic (Claude 3, Claude 2)',
      'Google (Gemini Pro, Gemini Ultra)',
      'Qwen (Alibaba Cloud)',
      'Cloudflare (Workers AI)',
      'Ollama (Local Models)',
      'LM Studio (Local Models)',
      'vLLM (Local/Cloud Inference)',
    ];

    const providerList = 'Available AI Providers:\n' + providers.map((p) => `• ${p}`).join('\n');
    this.renderer.addToChat(providerList, 'ai');
  }

  /**
   * Lists available AI agents
   */
  private listAgents(): void {
    const agents = [
      'Planning Agent - Assists with project planning and brainstorming',
      'Code Agent - Helps with code generation and refactoring',
      'DevOps Agent - Manages infrastructure and deployment',
      'Security Agent - Performs security analysis and compliance checks',
      'Testing Agent - Assists with test generation and execution',
      'Documentation Agent - Helps create and maintain documentation',
    ];

    const agentList = 'Available AI Agents:\n' + agents.map((a) => `• ${a}`).join('\n');
    this.renderer.addToChat(agentList, 'ai');
  }

  /**
   * Handles auto-completion
   */
  private handleAutocomplete(input: string): void {
    // Simple auto-completion for slash commands
    const slashCommands = [
      '/help',
      '/clear',
      '/mode',
      '/plan',
      '/work',
      '/providers',
      '/agents',
      '/github',
      '/linear',
      '/config',
      '/creds',
      '/lint',
      '/search',
      '/generate',
      '/review',
      '/productivity',
      '/speed',
      '/assistant',
      '/checkpoint',
      '/rollback',
      '/recovery',
    ];

    const matchingCommands = slashCommands.filter((cmd) =>
      cmd.toLowerCase().startsWith(input.toLowerCase())
    );

    if (matchingCommands.length === 1 && input !== matchingCommands[0]) {
      const inputArea = this.renderer.getInputArea();
      inputArea.setValue(matchingCommands[0]);
      this.layoutManager.render();
    } else if (matchingCommands.length > 1) {
      const suggestions = matchingCommands.join(', ');
      this.renderer.addToChat(`Possible completions: ${suggestions}`, 'ai');
    }
  }

  /**
   * Gets the current input area element
   */
  public getInputArea(): any {
    return this.renderer.getInputArea();
  }
}
