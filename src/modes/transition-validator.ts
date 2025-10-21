import * as fs from 'fs/promises';
import * as path from 'path';
import { ModeManager } from './mode-manager';

/**
 * Validator for mode transitions to ensure safe switching between planning and work modes
 */
export class ModeTransitionValidator {
  private modeManager: ModeManager;
  private pendingChanges: Set<string>;

  constructor(modeManager: ModeManager) {
    this.modeManager = modeManager;
    this.pendingChanges = new Set();
  }

  /**
   * Validate transition from planning to work mode
   */
  public async validatePlanningToWork(): Promise<{
    canTransition: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if there are unsaved planning artifacts that should be reviewed
    // In a real implementation, this would check project memory for planning artifacts

    // Check if any files have been modified in planning mode (shouldn't happen)
    // We'll assume that if file modification is not allowed in planning, this is fine

    return {
      canTransition: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Validate transition from work to planning mode
   */
  public async validateWorkToPlanning(): Promise<{
    canTransition: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if there are unsaved changes that should be committed first
    if (this.pendingChanges.size > 0) {
      warnings.push(
        `You have ${this.pendingChanges.size} pending changes that should be saved before switching to planning mode`
      );
    }

    // Check if there are uncommitted changes in version control
    // (This would require running git commands in a real implementation)
    // For now, we'll just add a general warning
    warnings.push('Remember that planning mode does not allow file modifications');

    return {
      canTransition: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Validate any mode transition
   */
  public async validateTransition(targetMode: 'planning' | 'work'): Promise<{
    canTransition: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const currentMode = this.modeManager.getCurrentMode();

    if (currentMode === targetMode) {
      return {
        canTransition: true,
        warnings: [],
        errors: [`Already in ${targetMode} mode`],
      };
    }

    if (currentMode === 'planning' && targetMode === 'work') {
      return await this.validatePlanningToWork();
    } else if (currentMode === 'work' && targetMode === 'planning') {
      return await this.validateWorkToPlanning();
    }

    // This should never happen if the modes are correctly checked
    return {
      canTransition: false,
      warnings: [],
      errors: [`Invalid mode transition from ${currentMode} to ${targetMode}`],
    };
  }

  /**
   * Register a file as having pending changes
   */
  public registerPendingChange(filePath: string): void {
    this.pendingChanges.add(filePath);
  }

  /**
   * Remove a file from pending changes
   */
  public removePendingChange(filePath: string): boolean {
    return this.pendingChanges.delete(filePath);
  }

  /**
   * Clear all pending changes
   */
  public clearPendingChanges(): void {
    this.pendingChanges.clear();
  }

  /**
   * Get all pending changes
   */
  public getPendingChanges(): string[] {
    return Array.from(this.pendingChanges);
  }

  /**
   * Check if there are any pending changes
   */
  public hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  /**
   * Validate and suggest a transition with recommendations
   */
  public async validateWithRecommendations(targetMode: 'planning' | 'work'): Promise<{
    canTransition: boolean;
    warnings: string[];
    errors: string[];
    recommendations: string[];
  }> {
    const result = await this.validateTransition(targetMode);
    const recommendations: string[] = [];

    if (targetMode === 'planning') {
      recommendations.push(
        'In planning mode, focus on design, architecture, and requirements analysis',
        'Use this time to create documentation and specifications',
        'Remember that file modifications are not allowed in planning mode'
      );
    } else if (targetMode === 'work') {
      recommendations.push(
        'In work mode, focus on implementation and development',
        'Make sure to commit your changes regularly',
        'Run tests before making significant changes',
        'Consider creating a backup before major refactoring'
      );
    }

    // Add transition-specific recommendations based on current state
    if (this.hasPendingChanges() && targetMode === 'planning') {
      recommendations.push('Consider saving your work before switching to planning mode');
    }

    return {
      ...result,
      recommendations,
    };
  }

  /**
   * Force transition if validation passes or if forced is true
   */
  public async attemptTransition(
    targetMode: 'planning' | 'work',
    force: boolean = false
  ): Promise<{
    success: boolean;
    warnings: string[];
    errors: string[];
    finalMode: 'planning' | 'work';
  }> {
    const validation = await this.validateWithRecommendations(targetMode);

    // If we're already in the target mode, return success
    if (this.modeManager.getCurrentMode() === targetMode) {
      return {
        success: true,
        warnings: validation.warnings,
        errors: validation.errors,
        finalMode: targetMode,
      };
    }

    // If validation failed and we're not forcing, return the validation results
    if (!validation.canTransition && !force) {
      return {
        success: false,
        warnings: validation.warnings,
        errors: validation.errors,
        finalMode: this.modeManager.getCurrentMode(),
      };
    }

    try {
      let success: boolean;
      if (targetMode === 'planning') {
        success = await this.modeManager.switchToPlanningMode();
      } else {
        success = await this.modeManager.switchToWorkMode();
      }

      if (success) {
        return {
          success: true,
          warnings: validation.warnings,
          errors: [],
          finalMode: targetMode,
        };
      } else {
        return {
          success: false,
          warnings: validation.warnings,
          errors: ['Mode switch failed'],
          finalMode: this.modeManager.getCurrentMode(),
        };
      }
    } catch (error) {
      return {
        success: false,
        warnings: validation.warnings,
        errors: [`Mode switch error: ${(error as Error).message}`],
        finalMode: this.modeManager.getCurrentMode(),
      };
    }
  }
}
