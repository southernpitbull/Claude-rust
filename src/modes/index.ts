/**
 * Planning and Work Modes System
 *
 * This module implements the dual-mode system for AIrchitect CLI,
 * providing distinct contexts for strategic planning and hands-on implementation.
 */

import { ProjectMemory } from '../memory';
import { AgentOrchestrator } from '../agents';

/**
 * Interface for mode configuration
 */
export interface ModeConfig {
  name: 'planning' | 'work';
  description: string;
  allowedOperations: string[];
  fileModificationAllowed: boolean;
  aiProviderAccess: string[];
  agentAccess: string[];
  securityLevel: 'high' | 'medium' | 'low';
}

/**
 * Interface for mode transition
 */
export interface ModeTransition {
  from: 'planning' | 'work';
  to: 'planning' | 'work';
  timestamp: Date;
  reason?: string;
  success: boolean;
  error?: string;
}

/**
 * Interface for mode state
 */
export interface ModeState {
  currentMode: 'planning' | 'work';
  lastTransition: ModeTransition | null;
  transitionHistory: ModeTransition[];
  locked: boolean;
  lockReason?: string;
}

/**
 * Planning and Work Modes Manager
 */
export class ModeManager {
  private currentState: ModeState;
  private projectMemory: ProjectMemory;
  private agentOrchestrator: AgentOrchestrator;
  private modeConfigs: Map<'planning' | 'work', ModeConfig>;
  private modeValidators: Map<'planning' | 'work', (state: ModeState) => boolean>;

  constructor(projectMemory: ProjectMemory, agentOrchestrator: AgentOrchestrator) {
    this.projectMemory = projectMemory;
    this.agentOrchestrator = agentOrchestrator;

    // Initialize mode state
    this.currentState = {
      currentMode: 'planning',
      lastTransition: null,
      transitionHistory: [],
      locked: false,
    };

    // Set up mode configurations
    this.modeConfigs = new Map();
    this.initializeModeConfigs();

    // Set up mode validators
    this.modeValidators = new Map();
    this.initializeModeValidators();
  }

  /**
   * Initialize mode configurations
   */
  private initializeModeConfigs(): void {
    // Planning mode configuration
    this.modeConfigs.set('planning', {
      name: 'planning',
      description: 'Strategic planning and architecture design mode',
      allowedOperations: [
        'read_files',
        'ai_interaction',
        'create_documents',
        'analyze_data',
        'generate_reports',
        'create_diagrams',
        'model_systems',
        'plan_features',
        'assess_risks',
        'evaluate_options',
      ],
      fileModificationAllowed: false,
      aiProviderAccess: ['openai', 'anthropic', 'google', 'qwen'],
      agentAccess: [
        'planning-agent',
        'architecture-agent',
        'requirements-agent',
        'risk-assessment-agent',
        'market-analysis-agent',
      ],
      securityLevel: 'high',
    });

    // Work mode configuration
    this.modeConfigs.set('work', {
      name: 'work',
      description: 'Implementation and development mode',
      allowedOperations: [
        'read_files',
        'write_files',
        'execute_commands',
        'ai_interaction',
        'run_tests',
        'build_project',
        'deploy_code',
        'debug_code',
        'refactor_code',
        'generate_code',
        'manage_dependencies',
        'configure_ci_cd',
        'monitor_systems',
      ],
      fileModificationAllowed: true,
      aiProviderAccess: ['openai', 'anthropic', 'google', 'qwen', 'ollama', 'lmstudio', 'vllm'],
      agentAccess: [
        'code-generation-agent',
        'testing-agent',
        'debugging-agent',
        'refactoring-agent',
        'deployment-agent',
        'security-agent',
        'performance-agent',
        'documentation-agent',
      ],
      securityLevel: 'medium',
    });
  }

  /**
   * Initialize mode validators
   */
  private initializeModeValidators(): void {
    // Planning mode validator
    this.modeValidators.set('planning', (state: ModeState): boolean => {
      // Planning mode has fewer restrictions
      return !state.locked;
    });

    // Work mode validator
    this.modeValidators.set('work', (state: ModeState): boolean => {
      // Work mode requires additional validation
      if (state.locked) {
        return false;
      }

      // In a real implementation, we might check:
      // - Project initialization status
      // - Required tools availability
      // - Environment readiness
      // - Permission levels

      return true;
    });
  }

  /**
   * Switch to planning mode
   */
  public async switchToPlanningMode(reason?: string): Promise<boolean> {
    return await this.switchMode('planning', reason);
  }

  /**
   * Switch to work mode
   */
  public async switchToWorkMode(reason?: string): Promise<boolean> {
    return await this.switchMode('work', reason);
  }

  /**
   * Switch to a specific mode
   */
  private async switchMode(targetMode: 'planning' | 'work', reason?: string): Promise<boolean> {
    // Check if already in target mode
    if (this.currentState.currentMode === targetMode) {
      return true;
    }

    // Check if mode is locked
    if (this.currentState.locked) {
      const transition: ModeTransition = {
        from: this.currentState.currentMode,
        to: targetMode,
        timestamp: new Date(),
        reason,
        success: false,
        error: `Mode locked: ${this.currentState.lockReason || 'Unknown reason'}`,
      };

      this.currentState.lastTransition = transition;
      this.currentState.transitionHistory.push(transition);

      return false;
    }

    // Validate transition
    const validator = this.modeValidators.get(targetMode);
    if (validator && !validator(this.currentState)) {
      const transition: ModeTransition = {
        from: this.currentState.currentMode,
        to: targetMode,
        timestamp: new Date(),
        reason,
        success: false,
        error: 'Mode validation failed',
      };

      this.currentState.lastTransition = transition;
      this.currentState.transitionHistory.push(transition);

      return false;
    }

    // Perform pre-transition actions
    const preTransitionSuccess = await this.executePreTransitionActions(
      this.currentState.currentMode,
      targetMode
    );

    if (!preTransitionSuccess) {
      const transition: ModeTransition = {
        from: this.currentState.currentMode,
        to: targetMode,
        timestamp: new Date(),
        reason,
        success: false,
        error: 'Pre-transition actions failed',
      };

      this.currentState.lastTransition = transition;
      this.currentState.transitionHistory.push(transition);

      return false;
    }

    // Switch mode
    const previousMode = this.currentState.currentMode;
    this.currentState.currentMode = targetMode;

    // Perform post-transition actions
    const postTransitionSuccess = await this.executePostTransitionActions(previousMode, targetMode);

    // Record transition
    const transition: ModeTransition = {
      from: previousMode,
      to: targetMode,
      timestamp: new Date(),
      reason,
      success: postTransitionSuccess,
      error: postTransitionSuccess ? undefined : 'Post-transition actions failed',
    };

    this.currentState.lastTransition = transition;
    this.currentState.transitionHistory.push(transition);

    // Store mode change in project memory
    await this.projectMemory.addToMemory(`Mode changed from ${previousMode} to ${targetMode}`, {
      type: 'mode-change',
      from: previousMode,
      to: targetMode,
      reason,
      timestamp: transition.timestamp.toISOString(),
      success: postTransitionSuccess,
    });

    return postTransitionSuccess;
  }

  /**
   * Execute pre-transition actions
   */
  private async executePreTransitionActions(
    fromMode: 'planning' | 'work',
    toMode: 'planning' | 'work'
  ): Promise<boolean> {
    try {
      // Store current state before transition
      await this.projectMemory.addToMemory(`Preparing transition from ${fromMode} to ${toMode}`, {
        type: 'mode-transition-preparation',
        from: fromMode,
        to: toMode,
        timestamp: new Date().toISOString(),
      });

      // Perform mode-specific pre-transition actions
      if (fromMode === 'work' && toMode === 'planning') {
        // Coming from work mode, going to planning
        // Save any unsaved work
        await this.saveWorkInProgress();
      } else if (fromMode === 'planning' && toMode === 'work') {
        // Coming from planning mode, going to work
        // Prepare development environment
        await this.prepareDevelopmentEnvironment();
      }

      return true;
    } catch (error) {
      console.error('Pre-transition actions failed:', error);
      return false;
    }
  }

  /**
   * Execute post-transition actions
   */
  private async executePostTransitionActions(
    fromMode: 'planning' | 'work',
    toMode: 'planning' | 'work'
  ): Promise<boolean> {
    try {
      // Update UI to reflect new mode
      this.updateModeInUI(toMode);

      // Perform mode-specific post-transition actions
      if (toMode === 'planning') {
        // Entering planning mode
        await this.initializePlanningMode();
      } else if (toMode === 'work') {
        // Entering work mode
        await this.initializeWorkMode();
      }

      // Store transition completion in project memory
      await this.projectMemory.addToMemory(`Completed transition from ${fromMode} to ${toMode}`, {
        type: 'mode-transition-completion',
        from: fromMode,
        to: toMode,
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      console.error('Post-transition actions failed:', error);
      return false;
    }
  }

  /**
   * Save work in progress before transitioning to planning mode
   */
  private async saveWorkInProgress(): Promise<void> {
    // In a real implementation, this would:
    // 1. Check for unsaved files
    // 2. Save any modified files
    // 3. Create a checkpoint
    // 4. Store work context

    console.log('Saving work in progress...');
    await this.projectMemory.addToMemory(
      'Work in progress saved before transitioning to planning mode',
      {
        type: 'work-save',
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Prepare development environment when transitioning to work mode
   */
  private async prepareDevelopmentEnvironment(): Promise<void> {
    // In a real implementation, this would:
    // 1. Check development tools availability
    // 2. Start necessary services
    // 3. Load project dependencies
    // 4. Prepare testing environment

    console.log('Preparing development environment...');
    await this.projectMemory.addToMemory('Development environment prepared for work mode', {
      type: 'env-prep',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Initialize planning mode
   */
  private async initializePlanningMode(): Promise<void> {
    // Set up planning-specific UI elements
    console.log('Initializing planning mode...');

    // Store mode initialization in project memory
    await this.projectMemory.addToMemory('Planning mode initialized', {
      type: 'mode-initialization',
      mode: 'planning',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Initialize work mode
   */
  private async initializeWorkMode(): Promise<void> {
    // Set up work-specific UI elements
    console.log('Initializing work mode...');

    // Store mode initialization in project memory
    await this.projectMemory.addToMemory('Work mode initialized', {
      type: 'mode-initialization',
      mode: 'work',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Update UI to reflect current mode
   */
  private updateModeInUI(mode: 'planning' | 'work'): void {
    // In a real implementation, this would update the TUI
    // to reflect the current mode with appropriate styling
    console.log(`UI updated to ${mode} mode`);
  }

  /**
   * Get current mode
   */
  public getCurrentMode(): 'planning' | 'work' {
    return this.currentState.currentMode;
  }

  /**
   * Check if an operation is allowed in the current mode
   */
  public isOperationAllowed(operation: string): boolean {
    if (this.currentState.locked) {
      return false;
    }

    const modeConfig = this.modeConfigs.get(this.currentState.currentMode);
    if (!modeConfig) {
      return false;
    }

    return modeConfig.allowedOperations.includes(operation);
  }

  /**
   * Check if file modification is allowed in the current mode
   */
  public isFileModificationAllowed(): boolean {
    if (this.currentState.locked) {
      return false;
    }

    const modeConfig = this.modeConfigs.get(this.currentState.currentMode);
    if (!modeConfig) {
      return false;
    }

    return modeConfig.fileModificationAllowed;
  }

  /**
   * Check if a specific AI provider is accessible in the current mode
   */
  public isProviderAccessible(provider: string): boolean {
    if (this.currentState.locked) {
      return false;
    }

    const modeConfig = this.modeConfigs.get(this.currentState.currentMode);
    if (!modeConfig) {
      return false;
    }

    return modeConfig.aiProviderAccess.includes(provider.toLowerCase());
  }

  /**
   * Check if a specific agent is accessible in the current mode
   */
  public isAgentAccessible(agent: string): boolean {
    if (this.currentState.locked) {
      return false;
    }

    const modeConfig = this.modeConfigs.get(this.currentState.currentMode);
    if (!modeConfig) {
      return false;
    }

    return modeConfig.agentAccess.includes(agent.toLowerCase());
  }

  /**
   * Get mode configuration
   */
  public getModeConfig(): ModeConfig | undefined {
    return this.modeConfigs.get(this.currentState.currentMode);
  }

  /**
   * Get mode state
   */
  public getModeState(): ModeState {
    return { ...this.currentState };
  }

  /**
   * Get mode transition history
   */
  public getTransitionHistory(): ModeTransition[] {
    return [...this.currentState.transitionHistory];
  }

  /**
   * Lock the current mode
   */
  public lockMode(reason: string): void {
    this.currentState.locked = true;
    this.currentState.lockReason = reason;

    // Store lock in project memory
    this.projectMemory.addToMemory(`Mode locked: ${reason}`, {
      type: 'mode-lock',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unlock the current mode
   */
  public unlockMode(): void {
    this.currentState.locked = false;
    this.currentState.lockReason = undefined;

    // Store unlock in project memory
    this.projectMemory.addToMemory('Mode unlocked', {
      type: 'mode-unlock',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if mode is locked
   */
  public isLocked(): boolean {
    return this.currentState.locked;
  }

  /**
   * Get lock reason
   */
  public getLockReason(): string | undefined {
    return this.currentState.lockReason;
  }

  /**
   * Validate an operation against current mode
   */
  public validateOperation(operation: string): { allowed: boolean; reason?: string } {
    if (this.currentState.locked) {
      return {
        allowed: false,
        reason: `Mode locked: ${this.currentState.lockReason || 'Unknown reason'}`,
      };
    }

    const modeConfig = this.modeConfigs.get(this.currentState.currentMode);
    if (!modeConfig) {
      return {
        allowed: false,
        reason: 'Invalid mode configuration',
      };
    }

    if (!modeConfig.allowedOperations.includes(operation)) {
      return {
        allowed: false,
        reason: `Operation '${operation}' not allowed in ${this.currentState.currentMode} mode`,
      };
    }

    return { allowed: true };
  }
}
