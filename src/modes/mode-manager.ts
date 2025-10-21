import { ProjectMemorySystem } from '../memory';

/**
 * Interface for mode configuration
 */
export interface ModeConfig {
  planning: {
    allowedOperations: string[];
    fileModificationAllowed: boolean;
    aiProviderAccess: string[];
  };
  work: {
    allowedOperations: string[];
    fileModificationAllowed: boolean;
    aiProviderAccess: string[];
  };
}

/**
 * Interface for mode state
 */
export interface ModeState {
  currentMode: 'planning' | 'work';
  allowedOperations: string[];
  fileModificationAllowed: boolean;
  aiProviderAccess: string[];
  lastSwitch: Date;
  previousMode: 'planning' | 'work' | null;
}

/**
 * Planning and Work mode manager to provide different operational contexts
 */
export class ModeManager {
  private modeState: ModeState;
  private modeConfig: ModeConfig;
  private projectMemory: ProjectMemorySystem;

  constructor(projectMemory: ProjectMemorySystem, config?: Partial<ModeConfig>) {
    this.projectMemory = projectMemory;

    // Set default configuration
    this.modeConfig = {
      planning: {
        allowedOperations: ['read', 'query', 'analyze', 'plan', 'design', 'research', 'document'],
        fileModificationAllowed: false,
        aiProviderAccess: ['openai', 'anthropic', 'google'], // Limit to cloud providers in planning
      },
      work: {
        allowedOperations: [
          'read',
          'write',
          'execute',
          'build',
          'deploy',
          'test',
          'modify',
          'generate',
        ],
        fileModificationAllowed: true,
        aiProviderAccess: ['openai', 'anthropic', 'google', 'ollama', 'lmstudio', 'vllm'], // Include local providers in work
      },
      ...config,
    };

    // Initialize in planning mode by default
    this.modeState = {
      currentMode: 'planning',
      allowedOperations: this.modeConfig.planning.allowedOperations,
      fileModificationAllowed: this.modeConfig.planning.fileModificationAllowed,
      aiProviderAccess: this.modeConfig.planning.aiProviderAccess,
      lastSwitch: new Date(),
      previousMode: null,
    };
  }

  /**
   * Switch to planning mode
   */
  public async switchToPlanningMode(): Promise<boolean> {
    if (this.modeState.currentMode === 'planning') {
      return true; // Already in planning mode
    }

    const previousMode = this.modeState.currentMode;

    this.modeState = {
      currentMode: 'planning',
      allowedOperations: this.modeConfig.planning.allowedOperations,
      fileModificationAllowed: this.modeConfig.planning.fileModificationAllowed,
      aiProviderAccess: this.modeConfig.planning.aiProviderAccess,
      lastSwitch: new Date(),
      previousMode,
    };

    // Store mode switch in project memory
    await this.projectMemory.store(
      `mode_switch_${Date.now()}`,
      {
        from: previousMode,
        to: 'planning',
        timestamp: this.modeState.lastSwitch.toISOString(),
      },
      {
        type: 'mode-switch',
        timestamp: this.modeState.lastSwitch.toISOString(),
      }
    );

    return true;
  }

  /**
   * Switch to work mode
   */
  public async switchToWorkMode(): Promise<boolean> {
    if (this.modeState.currentMode === 'work') {
      return true; // Already in work mode
    }

    const previousMode = this.modeState.currentMode;

    this.modeState = {
      currentMode: 'work',
      allowedOperations: this.modeConfig.work.allowedOperations,
      fileModificationAllowed: this.modeConfig.work.fileModificationAllowed,
      aiProviderAccess: this.modeConfig.work.aiProviderAccess,
      lastSwitch: new Date(),
      previousMode,
    };

    // Store mode switch in project memory
    await this.projectMemory.store(
      `mode_switch_${Date.now()}`,
      {
        from: previousMode,
        to: 'work',
        timestamp: this.modeState.lastSwitch.toISOString(),
      },
      {
        type: 'mode-switch',
        timestamp: this.modeState.lastSwitch.toISOString(),
      }
    );

    return true;
  }

  /**
   * Check if an operation is allowed in the current mode
   */
  public isOperationAllowed(operation: string): boolean {
    return this.modeState.allowedOperations.includes(operation);
  }

  /**
   * Check if file modification is allowed in the current mode
   */
  public isFileModificationAllowed(): boolean {
    return this.modeState.fileModificationAllowed;
  }

  /**
   * Check if a specific AI provider is accessible in the current mode
   */
  public isProviderAccessible(provider: string): boolean {
    return this.modeState.aiProviderAccess.includes(provider.toLowerCase());
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): 'planning' | 'work' {
    return this.modeState.currentMode;
  }

  /**
   * Get mode state
   */
  public getModeState(): ModeState {
    return { ...this.modeState }; // Return a copy to prevent external modification
  }

  /**
   * Get allowed operations for current mode
   */
  public getAllowedOperations(): string[] {
    return [...this.modeState.allowedOperations];
  }

  /**
   * Execute an operation safely based on current mode
   */
  public async executeWithModeGuard(
    operation: string,
    executor: () => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    // Check if operation is allowed
    if (!this.isOperationAllowed(operation)) {
      return {
        success: false,
        error: `Operation '${operation}' is not allowed in ${this.modeState.currentMode} mode`,
      };
    }

    // Special handling for file modification operations
    if (operation.includes('modify') || operation.includes('write')) {
      if (!this.isFileModificationAllowed()) {
        return {
          success: false,
          error: `File modification is not allowed in ${this.modeState.currentMode} mode`,
        };
      }
    }

    try {
      const result = await executor();
      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get mode-specific recommendations
   */
  public getModeRecommendations(): string[] {
    switch (this.modeState.currentMode) {
      case 'planning':
        return [
          'Use this mode for project planning and analysis',
          'Review project requirements and architecture',
          'Create design documents and specifications',
          'No file modifications allowed in this mode',
          'Use cloud-based AI providers for planning tasks',
        ];
      case 'work':
        return [
          'Use this mode for implementation and development',
          'Modify files and implement features',
          'Run tests and build processes',
          'File modifications are allowed in this mode',
          'Use both cloud and local AI providers',
        ];
      default:
        return [];
    }
  }

  /**
   * Get time since last mode switch
   */
  public getTimeSinceLastSwitch(): number {
    return Date.now() - this.modeState.lastSwitch.getTime();
  }

  /**
   * Check if mode is in a safe state for critical operations
   */
  public isSafeForCriticalOperations(): boolean {
    // Critical operations are safer in work mode where file modifications are allowed
    return this.modeState.currentMode === 'work';
  }

  /**
   * Get mode change history
   */
  public async getModeHistory(): Promise<
    Array<{
      from: 'planning' | 'work';
      to: 'planning' | 'work';
      timestamp: string;
    }>
  > {
    // In a real implementation, this would query the project memory for mode switches
    // For now, we'll return a simplified version based on current state
    const switches = await this.projectMemory.query('mode switch');

    return switches.map((s) => ({
      from: s.metadata.from || 'planning',
      to: s.metadata.to || 'work',
      timestamp: s.metadata.timestamp || new Date().toISOString(),
    }));
  }
}
