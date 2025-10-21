/**
 * InitCommand.ts
 *
 * Implements the 'init' command for initializing a new AIrchitect project.
 * Sets up project configuration, credentials, and initial structure.
 */

import { Command } from '../core/cli/Command';
import { ValidationService } from '../core/cli/ValidationService';
import { ConfigManager } from '../config/ConfigManager';
import { ProjectMemory } from '../memory/ProjectMemory';
import { Logger } from '../utils/Logger';

export class InitCommand extends Command {
  public name = 'init';
  public description = 'Initialize a new AIrchitect project';

  public options = [
    {
      flags: '-n, --name <name>',
      description: 'Project name',
      defaultValue: 'my-airchitect-project',
    },
    {
      flags: '-d, --dir <directory>',
      description: 'Project directory',
      defaultValue: './',
    },
    {
      flags: '-t, --template <template>',
      description: 'Project template to use',
      defaultValue: 'default',
    },
    {
      flags: '--skip-creds',
      description: 'Skip credential setup',
      required: false,
    },
  ];

  private validationService: ValidationService;
  private configManager: ConfigManager;
  private projectMemory: ProjectMemory;
  private logger: Logger;

  constructor() {
    super();
    this.validationService = new ValidationService();
    this.configManager = new ConfigManager();
    this.projectMemory = new ProjectMemory();
    this.logger = new Logger('info');
  }

  public async execute(...args: any[]): Promise<void> {
    // Extract options passed to the command
    const options: any = args[args.length - 1] || {};

    const projectName = options.name || 'my-airchitect-project';
    const projectDir = options.dir || './';
    const template = options.template || 'default';
    const skipCreds = options.skipCreds || false;

    this.logger.info(`Initializing AIrchitect project: ${projectName}`);
    this.logger.info(`Directory: ${projectDir}`);
    this.logger.info(`Template: ${template}`);

    try {
      // Pre-execute validation
      if (this.preExecute) {
        await this.preExecute();
      }

      // Initialize project directory
      await this.initializeProjectDirectory(projectDir);

      // Create initial configuration
      await this.createInitialConfig(projectName, projectDir, template);

      // Set up project memory
      await this.setupProjectMemory(projectDir);

      // Optionally set up credentials
      if (!skipCreds) {
        await this.setupCredentials();
      }

      // Create initial project structure
      await this.createProjectStructure(projectDir, template);

      // Finalize initialization
      await this.finalizeInitialization(projectDir);

      this.logger.info(`AIrchitect project '${projectName}' initialized successfully!`);
      this.logger.info(`Navigate to ${projectDir} and run 'airchitect help' to get started.`);

      // Post-execute actions
      if (this.postExecute) {
        await this.postExecute();
      }
    } catch (error) {
      this.logger.error('Failed to initialize project:', error);
      throw error;
    }
  }

  public getHelp(): string {
    return `
The init command creates a new AIrchitect project with all necessary configuration.

Examples:
  airchitect init                    # Initialize with default settings
  airchitect init -n my-project      # Initialize with project name
  airchitect init -d ./mydir         # Initialize in specific directory
  airchitect init -t react           # Initialize with specific template
  airchitect init --skip-creds       # Initialize without setting up credentials
    `;
  }

  /**
   * Validate command arguments
   * @param args - Arguments passed to the command
   * @returns Boolean indicating if arguments are valid
   */
  public validate(...args: any[]): boolean {
    // Extract options
    const options: any = args[args.length - 1] || {};

    // Validate project name if provided
    if (options.name) {
      const nameResult = this.validationService.runCustomValidation(
        options.name,
        (name) => typeof name === 'string' && name.trim().length > 0,
        'Project name must be a non-empty string'
      );

      if (!nameResult.success) {
        console.error(nameResult.errors.join(', '));
        return false;
      }
    }

    // Validate directory if provided
    if (options.dir) {
      const dirResult = this.validationService.runCustomValidation(
        options.dir,
        (dir) => typeof dir === 'string' && dir.trim().length > 0,
        'Directory must be a non-empty string'
      );

      if (!dirResult.success) {
        console.error(dirResult.errors.join(', '));
        return false;
      }
    }

    return true;
  }

  private async initializeProjectDirectory(projectDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create project directory if it doesn't exist
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
      this.logger.info(`Created project directory: ${projectDir}`);
    } else {
      this.logger.info(`Project directory already exists: ${projectDir}`);
    }

    // Create necessary subdirectories
    const subdirs = [
      path.join(projectDir, 'src'),
      path.join(projectDir, 'docs'),
      path.join(projectDir, 'config'),
      path.join(projectDir, 'data'),
      path.join(projectDir, 'temp'),
    ];

    for (const dir of subdirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info(`Created directory: ${dir}`);
      }
    }
  }

  private async createInitialConfig(
    projectName: string,
    projectDir: string,
    template: string
  ): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create a basic configuration file
    const configPath = path.join(projectDir, 'airchitect.config.json');
    const config = {
      project: {
        name: projectName,
        description: `AIrchitect project: ${projectName}`,
        version: '0.1.0',
        template: template,
        created: new Date().toISOString(),
      },
      ai: {
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
      },
      memory: {
        enabled: true,
        storage: 'local',
      },
      features: {
        checkpoint: true,
        agentFramework: true,
        pluginSystem: true,
      },
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    this.logger.info(`Created configuration file: ${configPath}`);
  }

  private async setupProjectMemory(projectDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Initialize project memory system
    const memoryDir = path.join(projectDir, '.airchitect', 'memory');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
      this.logger.info(`Initialized project memory: ${memoryDir}`);
    }

    // Create initial memory files
    const initialMemory = {
      createdAt: new Date().toISOString(),
      entries: [],
      metadata: {
        project: projectDir,
      },
    };

    const memoryFile = path.join(memoryDir, 'initial_memory.json');
    fs.writeFileSync(memoryFile, JSON.stringify(initialMemory, null, 2));
    this.logger.info(`Created initial memory file: ${memoryFile}`);
  }

  private async setupCredentials(): Promise<void> {
    this.logger.info('Setting up credentials...');

    // In a real implementation, this would guide the user through credential setup
    // For now, we'll just log what would happen
    this.logger.info('Please run "airchitect creds add" to set up your AI provider credentials');
  }

  private async createProjectStructure(projectDir: string, template: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create template-specific files based on template
    switch (template.toLowerCase()) {
      case 'default':
        // Create basic files for default template
        const readmePath = path.join(projectDir, 'README.md');
        const readmeContent = `# ${projectDir}\n\nThis is an AIrchitect project.\n\n## Getting Started\n\nRun \`airchitect help\` to see available commands.\n`;
        fs.writeFileSync(readmePath, readmeContent);
        this.logger.info(`Created README.md: ${readmePath}`);
        break;

      case 'react':
        // Create React-specific initial files
        this.logger.info('Setting up React template structure...');
        break;

      case 'node':
        // Create Node.js-specific initial files
        this.logger.info('Setting up Node.js template structure...');
        break;

      default:
        this.logger.info(`Unknown template: ${template}. Using default structure.`);
    }
  }

  private async finalizeInitialization(projectDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Create a .airchitect directory to track project state
    const airchitectDir = path.join(projectDir, '.airchitect');
    if (!fs.existsSync(airchitectDir)) {
      fs.mkdirSync(airchitectDir, { recursive: true });
    }

    // Create initialization marker
    const initMarker = path.join(airchitectDir, 'initialized');
    fs.writeFileSync(initMarker, new Date().toISOString());

    this.logger.info('Initialization completed successfully');
  }
}
