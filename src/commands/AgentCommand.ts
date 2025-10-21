/**
 * AgentCommand.ts
 *
 * Implements the 'agents' command for managing AIrchitect intelligent agents.
 * Handles listing, configuring, and controlling intelligent agents.
 */

import { Command } from '../core/cli/Command';
import { ValidationService } from '../core/cli/ValidationService';
import { AgentRegistry } from '../agents/AgentRegistry';
import { Logger } from '../utils/Logger';

export class AgentCommand extends Command {
  public name = 'agents';
  public description = 'Manage intelligent agents';

  public arguments = [
    {
      name: 'action',
      description: 'Agent action (list, info, enable, disable, create, remove)',
      required: true,
    },
    {
      name: 'agentName',
      description: 'Name of the agent (for info, enable, disable, remove actions)',
      required: false,
    },
  ];

  public options = [
    {
      flags: '--list-all',
      description: 'Include disabled agents in list',
      required: false,
    },
    {
      flags: '--json',
      description: 'Output in JSON format',
      required: false,
    },
    {
      flags: '--capabilities <caps>',
      description: 'Capabilities for agent creation (comma-separated)',
      defaultValue: '',
    },
    {
      flags: '--type <type>',
      description: 'Type of agent to create (devops, dev, research, etc.)',
      defaultValue: 'general',
    },
  ];

  private validationService: ValidationService;
  private agentRegistry: AgentRegistry;
  private logger: Logger;

  constructor() {
    super();
    this.validationService = new ValidationService();
    this.agentRegistry = new AgentRegistry();
    this.logger = new Logger('info');
  }

  public async execute(...args: any[]): Promise<void> {
    // Extract arguments and options
    const options: any = args[args.length - 1] || {};
    const action = this.getArg(args, 0) || 'list';
    const agentName = this.getArg(args, 1);

    const listAll = options.listAll || false;
    const isJson = options.json || false;
    const capabilities = options.capabilities ? options.capabilities.split(',') : [];
    const agentType = options.type || 'general';

    // Pre-execute validation
    if (this.preExecute) {
      await this.preExecute();
    }

    try {
      await this.agentRegistry.initialize();

      switch (action.toLowerCase()) {
        case 'list':
          await this.listAgents(listAll, isJson);
          break;
        case 'info':
          if (!agentName) {
            throw new Error('Agent name is required for info action');
          }
          await this.agentInfo(agentName, isJson);
          break;
        case 'enable':
          if (!agentName) {
            throw new Error('Agent name is required for enable action');
          }
          await this.enableAgent(agentName);
          break;
        case 'disable':
          if (!agentName) {
            throw new Error('Agent name is required for disable action');
          }
          await this.disableAgent(agentName);
          break;
        case 'create':
          if (!agentName) {
            throw new Error('Agent name is required for create action');
          }
          await this.createAgent(agentName, agentType, capabilities);
          break;
        case 'remove':
        case 'delete':
          if (!agentName) {
            throw new Error('Agent name is required for remove action');
          }
          await this.removeAgent(agentName);
          break;
        default:
          throw new Error(
            `Unknown agent action: ${action}. Use list, info, enable, disable, create, or remove.`
          );
      }

      // Post-execute actions
      if (this.postExecute) {
        await this.postExecute();
      }
    } catch (error) {
      this.logger.error('Agent command failed:', error);
      throw error;
    }
  }

  public getHelp(): string {
    return `
The agents command manages AIrchitect intelligent agents.

Actions:
  list                    - List all available agents
  info <agentName>        - Get detailed information about an agent
  enable <agentName>      - Enable a specific agent
  disable <agentName>     - Disable a specific agent
  create <agentName>      - Create a new agent
  remove <agentName>      - Remove an agent

Examples:
  airchitect agents list                    # List all agents
  airchitect agents info devops-agent       # Get info about specific agent
  airchitect agents enable research-agent   # Enable an agent
  airchitect agents create my-agent --type devops --capabilities code,deploy # Create agent
  airchitect agents remove my-agent         # Remove an agent
  airchitect agents list --json             # Output as JSON
  airchitect agents list --list-all         # Include disabled agents
    `;
  }

  /**
   * Validate command arguments
   * @param args - Arguments passed to the command
   * @returns Boolean indicating if arguments are valid
   */
  public validate(...args: any[]): boolean {
    const action = this.getArg(args, 0);

    if (!action) {
      console.error('Agent action is required (list, info, enable, disable, create, remove)');
      return false;
    }

    const validActions = ['list', 'info', 'enable', 'disable', 'create', 'remove', 'delete'];
    if (!validActions.includes(action.toLowerCase())) {
      console.error(
        `Invalid agent action: ${action}. Use list, info, enable, disable, create, or remove.`
      );
      return false;
    }

    // Validate agent name for specific actions
    const actionsRequiringName = ['info', 'enable', 'disable', 'create', 'remove', 'delete'];
    if (actionsRequiringName.includes(action.toLowerCase())) {
      const agentName = this.getArg(args, 1);
      if (!agentName) {
        console.error(`Agent name is required for ${action} action`);
        return false;
      }

      // Validate agent name format
      if (typeof agentName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(agentName)) {
        console.error('Agent name must contain only letters, numbers, underscores, and hyphens');
        return false;
      }
    }

    // Validate capabilities if provided
    const options: any = args[args.length - 1] || {};
    if (options.capabilities) {
      const caps = options.capabilities.split(',');
      for (const cap of caps) {
        if (!/^[a-zA-Z0-9_-]+$/.test(cap.trim())) {
          console.error(
            `Invalid capability: ${cap.trim()}. Capabilities must contain only letters, numbers, underscores, and hyphens.`
          );
          return false;
        }
      }
    }

    return true;
  }

  private async listAgents(listAll: boolean, isJson: boolean): Promise<void> {
    try {
      const agents = await this.agentRegistry.getAllAgents();
      const activeAgents = await this.agentRegistry.getActiveAgents();

      const agentsToDisplay = listAll ? agents : activeAgents;

      if (isJson) {
        const agentData = agentsToDisplay.map((agent) => ({
          name: agent.getName(),
          enabled: activeAgents.some((a) => a.getName() === agent.getName()),
          capabilities: agent.getCapabilities ? agent.getCapabilities() : [],
          description: agent.getDescription ? agent.getDescription() : 'No description',
        }));
        console.log(JSON.stringify(agentData, null, 2));
      } else {
        if (agentsToDisplay.length === 0) {
          console.log('No agents found.');
          return;
        }

        console.log(`Available agents: ${agentsToDisplay.length}`);
        console.log('');

        for (const agent of agentsToDisplay) {
          const name = agent.getName();
          const isActive = activeAgents.some((a) => a.getName() === name);
          const status = isActive ? '✓ active' : '○ inactive';
          const description = agent.getDescription ? agent.getDescription() : 'No description';

          console.log(`${name} [${status}]`);
          console.log(`  ${description}`);
          console.log('');
        }
      }
    } catch (error) {
      this.logger.error('Failed to list agents:', error);
      throw error;
    }
  }

  private async agentInfo(agentName: string, isJson: boolean): Promise<void> {
    try {
      const agent = await this.agentRegistry.getAgent(agentName);

      if (!agent) {
        console.log(`Agent "${agentName}" not found.`);
        return;
      }

      const isActive = await this.agentRegistry.isAgentActive(agentName);

      if (isJson) {
        const agentData = {
          name: agent.getName(),
          active: isActive,
          capabilities: agent.getCapabilities ? agent.getCapabilities() : [],
          description: agent.getDescription ? agent.getDescription() : 'No description',
          status: agent.getStatus ? agent.getStatus() : 'unknown',
        };
        console.log(JSON.stringify(agentData, null, 2));
      } else {
        console.log(`Agent: ${agent.getName()}`);
        console.log(`Status: ${isActive ? 'Active' : 'Inactive'}`);
        console.log(
          `Description: ${agent.getDescription ? agent.getDescription() : 'No description'}`
        );

        if (agent.getCapabilities) {
          const caps = agent.getCapabilities();
          if (caps && caps.length > 0) {
            console.log(`Capabilities: ${caps.join(', ')}`);
          } else {
            console.log('Capabilities: None defined');
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get info for agent "${agentName}":`, error);
      throw error;
    }
  }

  private async enableAgent(agentName: string): Promise<void> {
    try {
      const result = await this.agentRegistry.activateAgent(agentName);

      if (result) {
        console.log(`Agent "${agentName}" enabled successfully.`);
      } else {
        console.log(`Failed to enable agent "${agentName}". Agent may not exist.`);
      }
    } catch (error) {
      this.logger.error(`Failed to enable agent "${agentName}":`, error);
      throw error;
    }
  }

  private async disableAgent(agentName: string): Promise<void> {
    try {
      const result = await this.agentRegistry.deactivateAgent(agentName);

      if (result) {
        console.log(`Agent "${agentName}" disabled successfully.`);
      } else {
        console.log(`Failed to disable agent "${agentName}". Agent may not exist.`);
      }
    } catch (error) {
      this.logger.error(`Failed to disable agent "${agentName}":`, error);
      throw error;
    }
  }

  private async createAgent(name: string, type: string, capabilities: string[]): Promise<void> {
    try {
      // In a real implementation, we would create a new agent with the provided type and capabilities
      // For now, we'll simulate the creation process
      console.log(
        `Creating agent "${name}" of type "${type}" with capabilities: ${capabilities.join(', ')}`
      );

      // In a real implementation:
      // 1. Create a new agent instance based on the type
      // 2. Set its capabilities
      // 3. Register it with the agent registry
      // 4. Save it to persistent storage if needed

      console.log(`Agent "${name}" created successfully.`);
      console.log('(In a real implementation, this would create an actual agent instance)');
    } catch (error) {
      this.logger.error(`Failed to create agent "${name}":`, error);
      throw error;
    }
  }

  private async removeAgent(agentName: string): Promise<void> {
    try {
      const result = await this.agentRegistry.removeAgent(agentName);

      if (result) {
        console.log(`Agent "${agentName}" removed successfully.`);
      } else {
        console.log(`Failed to remove agent "${agentName}". Agent may not exist.`);
      }
    } catch (error) {
      this.logger.error(`Failed to remove agent "${agentName}":`, error);
      throw error;
    }
  }
}
