/**
 * LabelManager.ts
 *
 * Manages Linear issue labels with pattern-based assignment, AI-powered suggestions,
 * hierarchical organization, and color coordination for consistent categorization.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface Label {
  id: string;
  name: string;
  description?: string;
  color: string; // Hex color code
  parentId?: string; // For hierarchical labels
  children?: Label[]; // Child labels
  usageCount: number; // Number of issues using this label
  createdAt: Date;
  updatedAt: Date;
}

export interface LabelPattern {
  id: string;
  name: string;
  description?: string;
  pattern: string; // Regular expression pattern
  labelId: string; // ID of the label to apply
  enabled: boolean;
  priority: number; // Higher priority patterns are evaluated first
  caseSensitive: boolean;
  matchType: 'title' | 'description' | 'comments' | 'all';
  createdAt: Date;
  updatedAt: Date;
}

export interface LabelHierarchy {
  id: string;
  name: string;
  description?: string;
  rootLabels: string[]; // IDs of root labels in this hierarchy
  createdAt: Date;
  updatedAt: Date;
}

export interface LabelSuggestion {
  issueId: string;
  suggestedLabels: Array<{
    labelId: string;
    labelName: string;
    confidence: number; // 0-100 percentage
    reason: string;
  }>;
  aiGenerated: boolean;
  createdAt: Date;
}

export interface LabelColorPalette {
  name: string;
  colors: Array<{
    name: string;
    hex: string;
    usage: 'feature' | 'bug' | 'enhancement' | 'documentation' | 'priority' | 'status' | 'custom';
  }>;
}

export class LabelManager {
  private linearClient: LinearClient;
  private labels: Map<string, Label>;
  private patterns: Map<string, LabelPattern>;
  private hierarchies: Map<string, LabelHierarchy>;
  private suggestions: Map<string, LabelSuggestion>;
  private colorPalettes: LabelColorPalette[];
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.labels = new Map();
    this.patterns = new Map();
    this.hierarchies = new Map();
    this.suggestions = new Map();
    this.colorPalettes = [];
    this.logger = new Logger('LabelManager');

    // Initialize with default color palettes
    this.initializeDefaultColorPalettes();
  }

  /**
   * Initialize default color palettes
   */
  private initializeDefaultColorPalettes(): void {
    try {
      this.logger.info('Initializing default color palettes');

      // Standard issue type palette
      this.colorPalettes.push({
        name: 'Standard Issue Types',
        colors: [
          { name: 'Bug', hex: '#e11d21', usage: 'bug' },
          { name: 'Feature', hex: '#0052cc', usage: 'feature' },
          { name: 'Enhancement', hex: '#84b6eb', usage: 'enhancement' },
          { name: 'Documentation', hex: '#fbc02d', usage: 'documentation' },
          { name: 'Task', hex: '#cccccc', usage: 'custom' },
          { name: 'Story', hex: '#009688', usage: 'feature' },
          { name: 'Epic', hex: '#6f42c1', usage: 'feature' },
        ],
      });

      // Priority palette
      this.colorPalettes.push({
        name: 'Priority Levels',
        colors: [
          { name: 'Critical', hex: '#e11d21', usage: 'priority' },
          { name: 'High', hex: '#eb6420', usage: 'priority' },
          { name: 'Medium', hex: '#fbc02d', usage: 'priority' },
          { name: 'Low', hex: '#009688', usage: 'priority' },
        ],
      });

      // Status palette
      this.colorPalettes.push({
        name: 'Status Indicators',
        colors: [
          { name: 'Blocked', hex: '#e11d21', usage: 'status' },
          { name: 'In Progress', hex: '#0052cc', usage: 'status' },
          { name: 'Review', hex: '#fbc02d', usage: 'status' },
          { name: 'Done', hex: '#009688', usage: 'status' },
          { name: 'Backlog', hex: '#cccccc', usage: 'status' },
        ],
      });

      this.logger.info('Default color palettes initialized');
    } catch (error) {
      this.logger.error('Failed to initialize default color palettes', error);
      throw error;
    }
  }

  /**
   * Refresh labels from Linear
   */
  public async refreshLabels(): Promise<void> {
    try {
      this.logger.info('Refreshing labels from Linear');

      // In a real implementation, this would fetch actual labels from Linear
      // For now, we'll create sample data

      this.logger.info('Labels refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh labels', error);
      throw error;
    }
  }

  /**
   * Add a new label
   */
  public async createLabel(input: {
    name: string;
    description?: string;
    color: string;
    parentId?: string;
  }): Promise<Label> {
    try {
      this.logger.info(`Creating label: ${input.name}`);

      // In a real implementation, this would create the label in Linear
      // For now, we'll create a mock label
      const label: Label = {
        id: `label_${Date.now()}`,
        name: input.name,
        description: input.description,
        color: input.color,
        parentId: input.parentId,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.labels.set(label.id, label);

      this.logger.info(`Label created successfully: ${label.name}`);
      return label;
    } catch (error) {
      this.logger.error(`Failed to create label: ${input.name}`, error);
      throw error;
    }
  }

  /**
   * Update an existing label
   */
  public async updateLabel(
    labelId: string,
    updates: Partial<Pick<Label, 'name' | 'description' | 'color' | 'parentId'>>
  ): Promise<Label | null> {
    try {
      this.logger.info(`Updating label: ${labelId}`);

      const label = this.labels.get(labelId);
      if (!label) {
        this.logger.warn(`Label not found: ${labelId}`);
        return null;
      }

      // Update the label
      Object.assign(label, updates, { updatedAt: new Date() });

      // Update in map
      this.labels.set(labelId, label);

      this.logger.info(`Label updated successfully: ${label.name}`);
      return label;
    } catch (error) {
      this.logger.error(`Failed to update label: ${labelId}`, error);
      throw error;
    }
  }

  /**
   * Delete a label
   */
  public async deleteLabel(labelId: string): Promise<boolean> {
    try {
      this.logger.info(`Deleting label: ${labelId}`);

      const label = this.labels.get(labelId);
      if (!label) {
        this.logger.warn(`Label not found: ${labelId}`);
        return false;
      }

      // Remove child labels first
      const childLabels = this.getChildLabels(labelId);
      for (const child of childLabels) {
        this.labels.delete(child.id);
      }

      // Remove the label
      const deleted = this.labels.delete(labelId);

      if (deleted) {
        this.logger.info(`Label deleted successfully: ${label.name}`);
      } else {
        this.logger.warn(`Failed to delete label: ${label.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to delete label: ${labelId}`, error);
      throw error;
    }
  }

  /**
   * Get a label by ID
   */
  public getLabel(labelId: string): Label | undefined {
    return this.labels.get(labelId);
  }

  /**
   * Get all labels
   */
  public getAllLabels(): Label[] {
    return Array.from(this.labels.values());
  }

  /**
   * Get child labels of a parent label
   */
  public getChildLabels(parentId: string): Label[] {
    return Array.from(this.labels.values()).filter((label) => label.parentId === parentId);
  }

  /**
   * Get root labels (labels without parents)
   */
  public getRootLabels(): Label[] {
    return Array.from(this.labels.values()).filter((label) => !label.parentId);
  }

  /**
   * Add a new label pattern for automatic assignment
   */
  public addLabelPattern(pattern: LabelPattern): void {
    try {
      this.logger.info(`Adding label pattern: ${pattern.name}`);

      this.patterns.set(pattern.id, pattern);

      this.logger.info(`Label pattern added successfully: ${pattern.name}`);
    } catch (error) {
      this.logger.error(`Failed to add label pattern: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a label pattern
   */
  public removeLabelPattern(patternId: string): boolean {
    try {
      this.logger.info(`Removing label pattern: ${patternId}`);

      const pattern = this.patterns.get(patternId);
      if (!pattern) {
        this.logger.warn(`Label pattern not found: ${patternId}`);
        return false;
      }

      const deleted = this.patterns.delete(patternId);
      if (deleted) {
        this.logger.info(`Label pattern removed successfully: ${pattern.name}`);
      } else {
        this.logger.warn(`Failed to remove label pattern: ${pattern.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove label pattern: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * Update a label pattern
   */
  public updateLabelPattern(
    patternId: string,
    updates: Partial<Omit<LabelPattern, 'id' | 'createdAt'>>
  ): boolean {
    try {
      this.logger.info(`Updating label pattern: ${patternId}`);

      const pattern = this.patterns.get(patternId);
      if (!pattern) {
        this.logger.warn(`Label pattern not found: ${patternId}`);
        return false;
      }

      // Update the pattern
      Object.assign(pattern, updates, { updatedAt: new Date() });

      // Update in map
      this.patterns.set(patternId, pattern);

      this.logger.info(`Label pattern updated successfully: ${pattern.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update label pattern: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * Get all label patterns
   */
  public getAllPatterns(): LabelPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Evaluate patterns against an issue and return matching labels
   */
  public async evaluatePatterns(issue: LinearIssue): Promise<Label[]> {
    try {
      this.logger.info(`Evaluating patterns for issue: ${issue.id}`);

      const matchedLabels: Label[] = [];
      const matchedLabelIds = new Set<string>();

      // Sort patterns by priority (higher first)
      const sortedPatterns = Array.from(this.patterns.values())
        .filter((pattern) => pattern.enabled)
        .sort((a, b) => b.priority - a.priority);

      // Evaluate each pattern
      for (const pattern of sortedPatterns) {
        try {
          const matches = this.evaluatePattern(pattern, issue);
          if (matches) {
            const label = this.labels.get(pattern.labelId);
            if (label && !matchedLabelIds.has(label.id)) {
              matchedLabels.push(label);
              matchedLabelIds.add(label.id);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to evaluate pattern: ${pattern.name}`, error);
        }
      }

      this.logger.info(`Found ${matchedLabels.length} matching labels for issue: ${issue.id}`);
      return matchedLabels;
    } catch (error) {
      this.logger.error(`Failed to evaluate patterns for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single pattern against an issue
   */
  private evaluatePattern(pattern: LabelPattern, issue: LinearIssue): boolean {
    try {
      this.logger.info(`Evaluating pattern: ${pattern.name}`);

      let textToMatch = '';

      // Determine which text to match against
      switch (pattern.matchType) {
        case 'title':
          textToMatch = issue.title;
          break;
        case 'description':
          textToMatch = issue.description || '';
          break;
        case 'comments':
          // In a real implementation, we'd fetch comments
          textToMatch = '';
          break;
        case 'all':
          textToMatch = `${issue.title} ${issue.description || ''}`;
          break;
      }

      // Create RegExp with appropriate flags
      const flags = pattern.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern.pattern, flags);

      // Test for match
      const matches = regex.test(textToMatch);

      this.logger.info(`Pattern ${pattern.name} ${matches ? 'matches' : 'does not match'}`);
      return matches;
    } catch (error) {
      this.logger.error(`Failed to evaluate pattern: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Apply matching labels to an issue
   */
  public async applyMatchingLabels(issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Applying matching labels to issue: ${issue.id}`);

      // Evaluate patterns
      const matchingLabels = await this.evaluatePatterns(issue);

      if (matchingLabels.length === 0) {
        this.logger.info(`No matching labels found for issue: ${issue.id}`);
        return true;
      }

      // Get current labels
      const currentLabelIds = issue.labels?.map((label) => label.id) || [];

      // Determine which labels to add
      const labelsToAdd = matchingLabels
        .filter((label) => !currentLabelIds.includes(label.id))
        .map((label) => label.id);

      if (labelsToAdd.length === 0) {
        this.logger.info(`All matching labels already applied to issue: ${issue.id}`);
        return true;
      }

      // In a real implementation, we'd update the issue with new labels
      // For now, we'll just log the action
      this.logger.info(`Would add labels ${labelsToAdd.join(', ')} to issue: ${issue.id}`);

      // Update label usage counts
      for (const label of matchingLabels) {
        label.usageCount++;
        this.labels.set(label.id, label);
      }

      this.logger.info(`Applied matching labels to issue: ${issue.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply matching labels to issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Create an AI-powered label suggestion
   */
  public async generateLabelSuggestions(issue: LinearIssue): Promise<LabelSuggestion> {
    try {
      this.logger.info(`Generating label suggestions for issue: ${issue.id}`);

      // In a real implementation, this would use AI/ML to analyze the issue
      // and suggest relevant labels with confidence scores
      // For now, we'll create a mock suggestion

      const suggestion: LabelSuggestion = {
        issueId: issue.id,
        suggestedLabels: [],
        aiGenerated: true,
        createdAt: new Date(),
      };

      // Add some mock suggestions based on issue content
      if (
        issue.title.toLowerCase().includes('bug') ||
        issue.title.toLowerCase().includes('error')
      ) {
        const bugLabel = Array.from(this.labels.values()).find((l) =>
          l.name.toLowerCase().includes('bug')
        );
        if (bugLabel) {
          suggestion.suggestedLabels.push({
            labelId: bugLabel.id,
            labelName: bugLabel.name,
            confidence: 85,
            reason: 'Issue title contains "bug" or "error"',
          });
        }
      }

      if (
        issue.title.toLowerCase().includes('feature') ||
        issue.title.toLowerCase().includes('enhancement')
      ) {
        const featureLabel = Array.from(this.labels.values()).find((l) =>
          l.name.toLowerCase().includes('feature')
        );
        if (featureLabel) {
          suggestion.suggestedLabels.push({
            labelId: featureLabel.id,
            labelName: featureLabel.name,
            confidence: 90,
            reason: 'Issue title contains "feature" or "enhancement"',
          });
        }
      }

      // Store the suggestion
      this.suggestions.set(issue.id, suggestion);

      this.logger.info(
        `Generated ${suggestion.suggestedLabels.length} label suggestions for issue: ${issue.id}`
      );
      return suggestion;
    } catch (error) {
      this.logger.error(`Failed to generate label suggestions for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Apply AI-generated label suggestions to an issue
   */
  public async applyLabelSuggestions(
    issue: LinearIssue,
    minConfidence: number = 70
  ): Promise<boolean> {
    try {
      this.logger.info(
        `Applying label suggestions to issue: ${issue.id} (min confidence: ${minConfidence}%)`
      );

      // Get existing suggestions
      const suggestion = this.suggestions.get(issue.id);
      if (!suggestion) {
        this.logger.info(`No suggestions found for issue: ${issue.id}`);
        return false;
      }

      // Filter suggestions by confidence
      const highConfidenceSuggestions = suggestion.suggestedLabels.filter(
        (s) => s.confidence >= minConfidence
      );

      if (highConfidenceSuggestions.length === 0) {
        this.logger.info(`No high-confidence suggestions for issue: ${issue.id}`);
        return true;
      }

      // Get current labels
      const currentLabelIds = issue.labels?.map((label) => label.id) || [];

      // Determine which labels to add
      const labelsToAdd = highConfidenceSuggestions
        .filter((s) => !currentLabelIds.includes(s.labelId))
        .map((s) => s.labelId);

      if (labelsToAdd.length === 0) {
        this.logger.info(`All suggested labels already applied to issue: ${issue.id}`);
        return true;
      }

      // In a real implementation, we'd update the issue with new labels
      // For now, we'll just log the action
      this.logger.info(
        `Would add suggested labels ${labelsToAdd.join(', ')} to issue: ${issue.id}`
      );

      // Update label usage counts
      for (const suggestionItem of highConfidenceSuggestions) {
        const label = this.labels.get(suggestionItem.labelId);
        if (label) {
          label.usageCount++;
          this.labels.set(label.id, label);
        }
      }

      this.logger.info(`Applied label suggestions to issue: ${issue.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply label suggestions to issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Get all label suggestions for an issue
   */
  public getLabelSuggestions(issueId: string): LabelSuggestion | undefined {
    return this.suggestions.get(issueId);
  }

  /**
   * Create a label hierarchy
   */
  public createLabelHierarchy(hierarchy: LabelHierarchy): void {
    try {
      this.logger.info(`Creating label hierarchy: ${hierarchy.name}`);

      this.hierarchies.set(hierarchy.id, hierarchy);

      this.logger.info(`Label hierarchy created successfully: ${hierarchy.name}`);
    } catch (error) {
      this.logger.error(`Failed to create label hierarchy: ${hierarchy.name}`, error);
      throw error;
    }
  }

  /**
   * Get a label hierarchy by ID
   */
  public getLabelHierarchy(hierarchyId: string): LabelHierarchy | undefined {
    return this.hierarchies.get(hierarchyId);
  }

  /**
   * Get all label hierarchies
   */
  public getAllHierarchies(): LabelHierarchy[] {
    return Array.from(this.hierarchies.values());
  }

  /**
   * Remove a label hierarchy
   */
  public removeLabelHierarchy(hierarchyId: string): boolean {
    try {
      this.logger.info(`Removing label hierarchy: ${hierarchyId}`);

      const hierarchy = this.hierarchies.get(hierarchyId);
      if (!hierarchy) {
        this.logger.warn(`Label hierarchy not found: ${hierarchyId}`);
        return false;
      }

      const deleted = this.hierarchies.delete(hierarchyId);
      if (deleted) {
        this.logger.info(`Label hierarchy removed successfully: ${hierarchy.name}`);
      } else {
        this.logger.warn(`Failed to remove label hierarchy: ${hierarchy.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove label hierarchy: ${hierarchyId}`, error);
      throw error;
    }
  }

  /**
   * Get labels in a hierarchy with their full paths
   */
  public getLabelsInHierarchy(hierarchyId: string): Array<{ label: Label; path: string[] }> {
    try {
      this.logger.info(`Getting labels in hierarchy: ${hierarchyId}`);

      const hierarchy = this.hierarchies.get(hierarchyId);
      if (!hierarchy) {
        this.logger.warn(`Label hierarchy not found: ${hierarchyId}`);
        return [];
      }

      const result: Array<{ label: Label; path: string[] }> = [];

      // For each root label in the hierarchy
      for (const rootLabelId of hierarchy.rootLabels) {
        const rootLabel = this.labels.get(rootLabelId);
        if (rootLabel) {
          // Add root label
          result.push({ label: rootLabel, path: [rootLabel.name] });

          // Add child labels recursively
          this.addChildLabelsToHierarchy(rootLabel, [rootLabel.name], result);
        }
      }

      this.logger.info(`Found ${result.length} labels in hierarchy: ${hierarchy.name}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get labels in hierarchy: ${hierarchyId}`, error);
      throw error;
    }
  }

  /**
   * Recursively add child labels to hierarchy result
   */
  private addChildLabelsToHierarchy(
    parentLabel: Label,
    currentPath: string[],
    result: Array<{ label: Label; path: string[] }>
  ): void {
    try {
      const childLabels = this.getChildLabels(parentLabel.id);

      for (const childLabel of childLabels) {
        const newPath = [...currentPath, childLabel.name];
        result.push({ label: childLabel, path: newPath });

        // Recursively add grandchildren
        this.addChildLabelsToHierarchy(childLabel, newPath, result);
      }
    } catch (error) {
      this.logger.error(`Failed to add child labels to hierarchy for: ${parentLabel.name}`, error);
      throw error;
    }
  }

  /**
   * Get a color from a palette by usage type
   */
  public getColorFromPalette(
    usage: 'feature' | 'bug' | 'enhancement' | 'documentation' | 'priority' | 'status' | 'custom',
    paletteName?: string
  ): string | null {
    try {
      this.logger.info(`Getting color from palette for usage: ${usage}`);

      // Find the appropriate palette
      let palette = this.colorPalettes.find((p) => p.name === paletteName);
      if (!palette) {
        // Use default palette
        palette =
          this.colorPalettes.find((p) => p.name === 'Standard Issue Types') ||
          this.colorPalettes[0];
      }

      if (!palette) {
        this.logger.warn('No color palettes available');
        return null;
      }

      // Find color by usage
      const color = palette.colors.find((c) => c.usage === usage);
      if (color) {
        this.logger.info(`Found color: ${color.hex} for usage: ${usage}`);
        return color.hex;
      }

      this.logger.warn(`No color found for usage: ${usage} in palette: ${palette.name}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to get color from palette for usage: ${usage}`, error);
      throw error;
    }
  }

  /**
   * Add a custom color palette
   */
  public addColorPalette(palette: LabelColorPalette): void {
    try {
      this.logger.info(`Adding color palette: ${palette.name}`);

      // Check if palette already exists
      const existingIndex = this.colorPalettes.findIndex((p) => p.name === palette.name);
      if (existingIndex >= 0) {
        // Update existing palette
        this.colorPalettes[existingIndex] = palette;
        this.logger.info(`Updated existing color palette: ${palette.name}`);
      } else {
        // Add new palette
        this.colorPalettes.push(palette);
        this.logger.info(`Added new color palette: ${palette.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to add color palette: ${palette.name}`, error);
      throw error;
    }
  }

  /**
   * Get all color palettes
   */
  public getColorPalettes(): LabelColorPalette[] {
    return [...this.colorPalettes];
  }

  /**
   * Remove a color palette
   */
  public removeColorPalette(paletteName: string): boolean {
    try {
      this.logger.info(`Removing color palette: ${paletteName}`);

      const initialLength = this.colorPalettes.length;
      this.colorPalettes = this.colorPalettes.filter((palette) => palette.name !== paletteName);

      const removed = this.colorPalettes.length < initialLength;
      if (removed) {
        this.logger.info(`Color palette removed successfully: ${paletteName}`);
      } else {
        this.logger.warn(`Color palette not found: ${paletteName}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove color palette: ${paletteName}`, error);
      throw error;
    }
  }

  /**
   * Bulk apply labels to multiple issues
   */
  public async bulkApplyLabels(
    issues: LinearIssue[],
    labelIds: string[]
  ): Promise<Array<{ issueId: string; success: boolean; error?: string }>> {
    try {
      this.logger.info(`Bulk applying ${labelIds.length} labels to ${issues.length} issues`);

      const results: Array<{ issueId: string; success: boolean; error?: string }> = [];

      for (const issue of issues) {
        try {
          // In a real implementation, we'd update each issue with the labels
          // For now, we'll just simulate the operation

          // Update label usage counts
          for (const labelId of labelIds) {
            const label = this.labels.get(labelId);
            if (label) {
              label.usageCount++;
              this.labels.set(labelId, label);
            }
          }

          results.push({
            issueId: issue.id,
            success: true,
          });
        } catch (error) {
          this.logger.error(`Failed to apply labels to issue: ${issue.id}`, error);
          results.push({
            issueId: issue.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successful = results.filter((r) => r.success).length;
      this.logger.info(
        `Bulk label application completed: ${successful}/${issues.length} successful`
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to bulk apply labels', error);
      throw error;
    }
  }

  /**
   * Get label usage statistics
   */
  public getLabelStats(): {
    totalLabels: number;
    totalUsage: number;
    mostUsedLabels: Array<{ label: Label; usage: number }>;
    unusedLabels: Label[];
    averageUsage: number;
  } {
    try {
      this.logger.info('Generating label statistics');

      const labels = Array.from(this.labels.values());

      // Calculate total usage
      const totalUsage = labels.reduce((sum, label) => sum + label.usageCount, 0);

      // Find most used labels (top 10)
      const sortedLabels = [...labels].sort((a, b) => b.usageCount - a.usageCount);
      const mostUsedLabels = sortedLabels.slice(0, 10).map((label) => ({
        label,
        usage: label.usageCount,
      }));

      // Find unused labels
      const unusedLabels = labels.filter((label) => label.usageCount === 0);

      // Calculate average usage
      const averageUsage = labels.length > 0 ? totalUsage / labels.length : 0;

      const stats = {
        totalLabels: labels.length,
        totalUsage,
        mostUsedLabels,
        unusedLabels,
        averageUsage,
      };

      this.logger.info('Label statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate label statistics', error);
      throw error;
    }
  }

  /**
   * Find duplicate labels by name
   */
  public findDuplicateLabels(): Array<{ name: string; labels: Label[] }> {
    try {
      this.logger.info('Finding duplicate labels');

      const labelMap = new Map<string, Label[]>();

      // Group labels by name
      for (const label of this.labels.values()) {
        const nameLower = label.name.toLowerCase();
        if (!labelMap.has(nameLower)) {
          labelMap.set(nameLower, []);
        }
        labelMap.get(nameLower)!.push(label);
      }

      // Find duplicates (names with more than one label)
      const duplicates: Array<{ name: string; labels: Label[] }> = [];

      for (const [name, labels] of labelMap.entries()) {
        if (labels.length > 1) {
          duplicates.push({ name, labels });
        }
      }

      this.logger.info(`Found ${duplicates.length} duplicate label names`);
      return duplicates;
    } catch (error) {
      this.logger.error('Failed to find duplicate labels', error);
      throw error;
    }
  }

  /**
   * Merge duplicate labels
   */
  public async mergeDuplicateLabels(duplicateGroup: {
    name: string;
    labels: Label[];
  }): Promise<Label | null> {
    try {
      this.logger.info(`Merging duplicate labels with name: ${duplicateGroup.name}`);

      if (duplicateGroup.labels.length < 2) {
        this.logger.warn(`Not enough labels to merge: ${duplicateGroup.labels.length}`);
        return null;
      }

      // Sort by usage count (keep the most used)
      const sortedLabels = [...duplicateGroup.labels].sort((a, b) => b.usageCount - a.usageCount);
      const keepLabel = sortedLabels[0];
      const removeLabels = sortedLabels.slice(1);

      // In a real implementation, we'd:
      // 1. Move all issues from removeLabels to keepLabel
      // 2. Delete removeLabels
      // 3. Update any references to removeLabels

      // For now, we'll just simulate removing the duplicates
      for (const labelToRemove of removeLabels) {
        this.labels.delete(labelToRemove.id);
      }

      this.logger.info(
        `Merged ${removeLabels.length + 1} duplicate labels into: ${keepLabel.name}`
      );
      return keepLabel;
    } catch (error) {
      this.logger.error(`Failed to merge duplicate labels: ${duplicateGroup.name}`, error);
      throw error;
    }
  }

  /**
   * Export labels to a standardized format
   */
  public exportLabels(): {
    labels: Array<Omit<Label, 'children'>>;
    patterns: LabelPattern[];
    hierarchies: LabelHierarchy[];
    colorPalettes: LabelColorPalette[];
  } {
    try {
      this.logger.info('Exporting labels and configuration');

      const exportData = {
        labels: Array.from(this.labels.values()).map((label) => {
          // Omit children property to avoid circular references
          const { children, ...labelWithoutChildren } = label;
          return labelWithoutChildren;
        }),
        patterns: Array.from(this.patterns.values()),
        hierarchies: Array.from(this.hierarchies.values()),
        colorPalettes: [...this.colorPalettes],
      };

      this.logger.info('Labels and configuration exported successfully');
      return exportData;
    } catch (error) {
      this.logger.error('Failed to export labels and configuration', error);
      throw error;
    }
  }

  /**
   * Import labels from a standardized format
   */
  public importLabels(data: {
    labels: Label[];
    patterns: LabelPattern[];
    hierarchies: LabelHierarchy[];
    colorPalettes: LabelColorPalette[];
  }): void {
    try {
      this.logger.info('Importing labels and configuration');

      // Clear existing data
      this.labels.clear();
      this.patterns.clear();
      this.hierarchies.clear();
      this.colorPalettes = [];

      // Import labels
      for (const label of data.labels) {
        this.labels.set(label.id, label);
      }

      // Import patterns
      for (const pattern of data.patterns) {
        this.patterns.set(pattern.id, pattern);
      }

      // Import hierarchies
      for (const hierarchy of data.hierarchies) {
        this.hierarchies.set(hierarchy.id, hierarchy);
      }

      // Import color palettes
      this.colorPalettes = [...data.colorPalettes];

      this.logger.info('Labels and configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import labels and configuration', error);
      throw error;
    }
  }
}
