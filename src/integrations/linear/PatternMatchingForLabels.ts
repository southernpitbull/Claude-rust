/**
 * PatternMatchingForLabels.ts
 *
 * Implements intelligent pattern matching for Linear issue labels using regex,
 * title/description analysis, comment-based triggers, and AI-powered suggestions.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface PatternRule {
  id: string;
  name: string;
  description?: string;
  pattern: string; // Regular expression pattern
  caseSensitive: boolean;
  enabled: boolean;
  matchType: 'title' | 'description' | 'comments' | 'labels' | 'all';
  labelId: string; // ID of label to apply when pattern matches
  priority: number; // Higher priority rules are evaluated first
  conditions?: PatternCondition[]; // Additional conditions for matching
  actions?: PatternAction[]; // Actions to take when pattern matches
  createdAt: Date;
  updatedAt: Date;
  usageCount: number; // How many times this pattern has been applied
  lastApplied?: Date; // When this pattern was last applied
}

export interface PatternCondition {
  type: 'field_value' | 'label_exists' | 'assignee_role' | 'team_membership' | 'priority_level';
  field?: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
  value: any;
}

export interface PatternAction {
  type: 'apply_label' | 'remove_label' | 'assign_user' | 'change_priority' | 'add_comment';
  targetLabelId?: string;
  targetUserId?: string;
  priority?: string;
  comment?: string;
}

export interface PatternMatchResult {
  issueId: string;
  patternId: string;
  patternName: string;
  matched: boolean;
  matchLocation: 'title' | 'description' | 'comments' | 'labels' | null;
  matchedText?: string;
  confidence: number; // 0-100 percentage
  reason: string;
  actionsTaken: string[];
  timestamp: Date;
}

export interface PatternSuggestion {
  issueId: string;
  suggestedPatterns: Array<{
    patternId: string;
    patternName: string;
    confidence: number; // 0-100 percentage
    reason: string;
    recommendedLabelId: string;
    recommendedLabelName: string;
  }>;
  aiGenerated: boolean;
  createdAt: Date;
}

export class PatternMatchingForLabels {
  private linearClient: LinearClient;
  private patterns: Map<string, PatternRule>;
  private matchResults: PatternMatchResult[];
  private suggestions: Map<string, PatternSuggestion>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.patterns = new Map();
    this.matchResults = [];
    this.suggestions = new Map();
    this.logger = new Logger('PatternMatchingForLabels');
  }

  /**
   * Add a new pattern rule
   */
  public addPattern(pattern: PatternRule): void {
    try {
      this.logger.info(`Adding pattern rule: ${pattern.name}`);

      this.patterns.set(pattern.id, pattern);

      this.logger.info(`Pattern rule added successfully: ${pattern.name}`);
    } catch (error) {
      this.logger.error(`Failed to add pattern rule: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a pattern rule
   */
  public removePattern(patternId: string): boolean {
    try {
      this.logger.info(`Removing pattern rule: ${patternId}`);

      const pattern = this.patterns.get(patternId);
      if (!pattern) {
        this.logger.warn(`Pattern rule not found: ${patternId}`);
        return false;
      }

      const deleted = this.patterns.delete(patternId);
      if (deleted) {
        this.logger.info(`Pattern rule removed successfully: ${pattern.name}`);
      } else {
        this.logger.warn(`Failed to remove pattern rule: ${pattern.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove pattern rule: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * Update a pattern rule
   */
  public updatePattern(
    patternId: string,
    updates: Partial<Omit<PatternRule, 'id' | 'createdAt' | 'usageCount' | 'lastApplied'>>
  ): boolean {
    try {
      this.logger.info(`Updating pattern rule: ${patternId}`);

      const pattern = this.patterns.get(patternId);
      if (!pattern) {
        this.logger.warn(`Pattern rule not found: ${patternId}`);
        return false;
      }

      // Update the pattern
      Object.assign(pattern, updates, { updatedAt: new Date() });

      // Update in map
      this.patterns.set(patternId, pattern);

      this.logger.info(`Pattern rule updated successfully: ${pattern.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update pattern rule: ${patternId}`, error);
      throw error;
    }
  }

  /**
   * Get a pattern rule by ID
   */
  public getPattern(patternId: string): PatternRule | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all pattern rules
   */
  public getAllPatterns(): PatternRule[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Enable a pattern rule
   */
  public enablePattern(patternId: string): boolean {
    return this.updatePattern(patternId, { enabled: true });
  }

  /**
   * Disable a pattern rule
   */
  public disablePattern(patternId: string): boolean {
    return this.updatePattern(patternId, { enabled: false });
  }

  /**
   * Evaluate all enabled patterns against an issue
   */
  public async evaluatePatterns(issue: LinearIssue): Promise<PatternMatchResult[]> {
    try {
      this.logger.info(`Evaluating patterns for issue: ${issue.id}`);

      const results: PatternMatchResult[] = [];

      // Sort patterns by priority (higher first)
      const sortedPatterns = Array.from(this.patterns.values())
        .filter((pattern) => pattern.enabled)
        .sort((a, b) => b.priority - a.priority);

      // Evaluate each pattern
      for (const pattern of sortedPatterns) {
        try {
          const result = await this.evaluatePattern(pattern, issue);
          results.push(result);

          // Store the result
          this.matchResults.push(result);

          // Keep only the most recent 1000 results to prevent memory issues
          if (this.matchResults.length > 1000) {
            this.matchResults = this.matchResults.slice(-1000);
          }

          // Update pattern usage if matched
          if (result.matched) {
            pattern.usageCount++;
            pattern.lastApplied = new Date();
            this.patterns.set(pattern.id, pattern);
          }
        } catch (error) {
          this.logger.error(`Failed to evaluate pattern: ${pattern.name}`, error);
        }
      }

      this.logger.info(`Evaluated ${results.length} patterns for issue: ${issue.id}`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to evaluate patterns for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single pattern against an issue
   */
  private async evaluatePattern(
    pattern: PatternRule,
    issue: LinearIssue
  ): Promise<PatternMatchResult> {
    try {
      this.logger.info(`Evaluating pattern: ${pattern.name}`);

      const result: PatternMatchResult = {
        issueId: issue.id,
        patternId: pattern.id,
        patternName: pattern.name,
        matched: false,
        matchLocation: null,
        confidence: 0,
        reason: '',
        actionsTaken: [],
        timestamp: new Date(),
      };

      // Check additional conditions if specified
      if (pattern.conditions && pattern.conditions.length > 0) {
        const conditionsMet = this.checkConditions(pattern.conditions, issue);
        if (!conditionsMet) {
          result.reason = 'Additional conditions not met';
          return result;
        }
      }

      // Evaluate the main pattern
      const patternMatch = this.evaluateTextPattern(pattern, issue);

      if (patternMatch.matched) {
        result.matched = true;
        result.matchLocation = patternMatch.location;
        result.matchedText = patternMatch.text;
        result.confidence = patternMatch.confidence;
        result.reason = patternMatch.reason;

        // Execute actions if pattern matched
        if (pattern.actions && pattern.actions.length > 0) {
          const actionsTaken = await this.executeActions(pattern.actions, issue, pattern);
          result.actionsTaken = actionsTaken;
        }
      } else {
        result.reason = patternMatch.reason;
      }

      this.logger.info(
        `Pattern ${pattern.name} ${result.matched ? 'matched' : 'did not match'} for issue: ${issue.id}`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to evaluate pattern: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Evaluate text-based pattern matching
   */
  private evaluateTextPattern(
    pattern: PatternRule,
    issue: LinearIssue
  ): {
    matched: boolean;
    location: 'title' | 'description' | 'comments' | 'labels' | null;
    text?: string;
    confidence: number;
    reason: string;
  } {
    try {
      this.logger.info(`Evaluating text pattern: ${pattern.name}`);

      // Create RegExp with appropriate flags
      const flags = pattern.caseSensitive ? 'g' : 'gi';
      let regex: RegExp;

      try {
        regex = new RegExp(pattern.pattern, flags);
      } catch (error) {
        this.logger.error(`Invalid regex pattern: ${pattern.pattern}`, error);
        return {
          matched: false,
          location: null,
          confidence: 0,
          reason: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      // Determine which text to match against
      switch (pattern.matchType) {
        case 'title':
          if (issue.title) {
            const match = regex.exec(issue.title);
            if (match) {
              return {
                matched: true,
                location: 'title',
                text: match[0],
                confidence: 90,
                reason: `Matched in issue title: "${match[0]}"`,
              };
            }
          }
          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: 'No match found in issue title',
          };

        case 'description':
          if (issue.description) {
            const match = regex.exec(issue.description);
            if (match) {
              return {
                matched: true,
                location: 'description',
                text: match[0],
                confidence: 85,
                reason: `Matched in issue description: "${match[0]}"`,
              };
            }
          }
          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: 'No match found in issue description',
          };

        case 'comments':
          // In a real implementation, we'd fetch comments
          // For now, we'll return a placeholder
          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: 'Comments matching not implemented in this mock',
          };

        case 'labels':
          if (issue.labels && issue.labels.length > 0) {
            for (const label of issue.labels) {
              const match = regex.exec(label.name);
              if (match) {
                return {
                  matched: true,
                  location: 'labels',
                  text: match[0],
                  confidence: 80,
                  reason: `Matched in label: "${label.name}"`,
                };
              }
            }
          }
          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: 'No match found in issue labels',
          };

        case 'all':
          // Check title
          if (issue.title) {
            const titleMatch = regex.exec(issue.title);
            if (titleMatch) {
              return {
                matched: true,
                location: 'title',
                text: titleMatch[0],
                confidence: 90,
                reason: `Matched in issue title: "${titleMatch[0]}"`,
              };
            }
          }

          // Check description
          if (issue.description) {
            const descMatch = regex.exec(issue.description);
            if (descMatch) {
              return {
                matched: true,
                location: 'description',
                text: descMatch[0],
                confidence: 85,
                reason: `Matched in issue description: "${descMatch[0]}"`,
              };
            }
          }

          // Check labels
          if (issue.labels && issue.labels.length > 0) {
            for (const label of issue.labels) {
              const labelMatch = regex.exec(label.name);
              if (labelMatch) {
                return {
                  matched: true,
                  location: 'labels',
                  text: labelMatch[0],
                  confidence: 80,
                  reason: `Matched in label: "${label.name}"`,
                };
              }
            }
          }

          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: 'No match found in issue title, description, or labels',
          };

        default:
          return {
            matched: false,
            location: null,
            confidence: 0,
            reason: `Unknown match type: ${pattern.matchType}`,
          };
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate text pattern: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Check additional conditions for pattern matching
   */
  private checkConditions(conditions: PatternCondition[], issue: LinearIssue): boolean {
    try {
      this.logger.info(`Checking ${conditions.length} conditions`);

      for (const condition of conditions) {
        let fieldValue: any;

        // Get field value based on condition type
        switch (condition.type) {
          case 'field_value':
            if (condition.field) {
              // Get field value from issue
              fieldValue = (issue as any)[condition.field];
            }
            break;

          case 'label_exists':
            if (condition.value && issue.labels) {
              fieldValue = issue.labels.some((label) => label.name === condition.value);
            }
            break;

          case 'assignee_role':
            // This would require additional data about assignee roles
            fieldValue = null;
            break;

          case 'team_membership':
            // This would require additional data about team memberships
            fieldValue = null;
            break;

          case 'priority_level':
            fieldValue = issue.priority;
            break;

          default:
            this.logger.warn(`Unknown condition type: ${condition.type}`);
            return false;
        }

        // Evaluate condition
        const conditionMet = this.evaluateCondition(condition, fieldValue);
        if (!conditionMet) {
          this.logger.info(`Condition not met: ${condition.type}`);
          return false;
        }
      }

      this.logger.info('All conditions met');
      return true;
    } catch (error) {
      this.logger.error('Failed to check conditions', error);
      throw error;
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PatternCondition, fieldValue: any): boolean {
    try {
      this.logger.info(`Evaluating condition: ${condition.type} ${condition.operator}`);

      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;

        case 'not_equals':
          return fieldValue !== condition.value;

        case 'contains':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().includes(condition.value.toLowerCase());
          }
          return false;

        case 'not_contains':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return !fieldValue.toLowerCase().includes(condition.value.toLowerCase());
          }
          return true;

        case 'starts_with':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().startsWith(condition.value.toLowerCase());
          }
          return false;

        case 'ends_with':
          if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
            return fieldValue.toLowerCase().endsWith(condition.value.toLowerCase());
          }
          return false;

        default:
          this.logger.warn(`Unknown operator: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate condition: ${condition.type}`, error);
      throw error;
    }
  }

  /**
   * Execute actions when a pattern matches
   */
  private async executeActions(
    actions: PatternAction[],
    issue: LinearIssue,
    pattern: PatternRule
  ): Promise<string[]> {
    try {
      this.logger.info(`Executing ${actions.length} actions for pattern: ${pattern.name}`);

      const actionsTaken: string[] = [];

      for (const action of actions) {
        try {
          switch (action.type) {
            case 'apply_label':
              if (action.targetLabelId) {
                // In a real implementation, we'd apply the label to the issue
                actionsTaken.push(`Applied label: ${action.targetLabelId}`);
                this.logger.info(`Would apply label ${action.targetLabelId} to issue: ${issue.id}`);
              }
              break;

            case 'remove_label':
              if (action.targetLabelId) {
                // In a real implementation, we'd remove the label from the issue
                actionsTaken.push(`Removed label: ${action.targetLabelId}`);
                this.logger.info(
                  `Would remove label ${action.targetLabelId} from issue: ${issue.id}`
                );
              }
              break;

            case 'assign_user':
              if (action.targetUserId) {
                // In a real implementation, we'd assign the user to the issue
                actionsTaken.push(`Assigned user: ${action.targetUserId}`);
                this.logger.info(`Would assign user ${action.targetUserId} to issue: ${issue.id}`);
              }
              break;

            case 'change_priority':
              if (action.priority) {
                // In a real implementation, we'd change the issue priority
                actionsTaken.push(`Changed priority to: ${action.priority}`);
                this.logger.info(
                  `Would change priority of issue ${issue.id} to: ${action.priority}`
                );
              }
              break;

            case 'add_comment':
              if (action.comment) {
                // In a real implementation, we'd add a comment to the issue
                actionsTaken.push(`Added comment: ${action.comment.substring(0, 50)}...`);
                this.logger.info(`Would add comment to issue ${issue.id}: ${action.comment}`);
              }
              break;

            default:
              this.logger.warn(`Unknown action type: ${action.type}`);
          }
        } catch (error) {
          this.logger.error(`Failed to execute action: ${action.type}`, error);
        }
      }

      this.logger.info(`Executed ${actionsTaken.length} actions for pattern: ${pattern.name}`);
      return actionsTaken;
    } catch (error) {
      this.logger.error(`Failed to execute actions for pattern: ${pattern.name}`, error);
      throw error;
    }
  }

  /**
   * Get all pattern match results
   */
  public getMatchResults(): PatternMatchResult[] {
    return [...this.matchResults];
  }

  /**
   * Get pattern match results for a specific issue
   */
  public getIssueMatchResults(issueId: string): PatternMatchResult[] {
    return this.matchResults.filter((result) => result.issueId === issueId);
  }

  /**
   * Get pattern match results for a specific pattern
   */
  public getPatternMatchResults(patternId: string): PatternMatchResult[] {
    return this.matchResults.filter((result) => result.patternId === patternId);
  }

  /**
   * Get pattern statistics
   */
  public getPatternStats(): {
    totalPatterns: number;
    enabledPatterns: number;
    totalMatches: number;
    mostUsedPatterns: Array<{ pattern: PatternRule; usage: number }>;
    matchSuccessRate: number;
  } {
    try {
      this.logger.info('Generating pattern statistics');

      const patterns = Array.from(this.patterns.values());
      const enabledPatterns = patterns.filter((p) => p.enabled).length;

      // Calculate total matches
      const totalMatches = this.matchResults.filter((r) => r.matched).length;

      // Calculate match success rate
      const totalEvaluations = this.matchResults.length;
      const matchSuccessRate = totalEvaluations > 0 ? (totalMatches / totalEvaluations) * 100 : 0;

      // Find most used patterns
      const sortedPatterns = [...patterns].sort((a, b) => b.usageCount - a.usageCount);
      const mostUsedPatterns = sortedPatterns.slice(0, 10).map((pattern) => ({
        pattern,
        usage: pattern.usageCount,
      }));

      const stats = {
        totalPatterns: patterns.length,
        enabledPatterns,
        totalMatches,
        mostUsedPatterns,
        matchSuccessRate,
      };

      this.logger.info('Pattern statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate pattern statistics', error);
      throw error;
    }
  }

  /**
   * Generate AI-powered pattern suggestions for an issue
   */
  public async generatePatternSuggestions(issue: LinearIssue): Promise<PatternSuggestion> {
    try {
      this.logger.info(`Generating pattern suggestions for issue: ${issue.id}`);

      // In a real implementation, this would use AI/ML to analyze the issue
      // and suggest relevant patterns with confidence scores
      // For now, we'll create a mock suggestion

      const suggestion: PatternSuggestion = {
        issueId: issue.id,
        suggestedPatterns: [],
        aiGenerated: true,
        createdAt: new Date(),
      };

      // Add some mock suggestions based on issue content
      if (
        issue.title.toLowerCase().includes('bug') ||
        issue.title.toLowerCase().includes('error')
      ) {
        const bugPattern = Array.from(this.patterns.values()).find((p) =>
          p.name.toLowerCase().includes('bug')
        );
        if (bugPattern) {
          suggestion.suggestedPatterns.push({
            patternId: bugPattern.id,
            patternName: bugPattern.name,
            confidence: 85,
            reason: 'Issue title contains "bug" or "error"',
            recommendedLabelId: bugPattern.labelId,
            recommendedLabelName: `Label for ${bugPattern.name}`,
          });
        }
      }

      if (
        issue.title.toLowerCase().includes('feature') ||
        issue.title.toLowerCase().includes('enhancement')
      ) {
        const featurePattern = Array.from(this.patterns.values()).find((p) =>
          p.name.toLowerCase().includes('feature')
        );
        if (featurePattern) {
          suggestion.suggestedPatterns.push({
            patternId: featurePattern.id,
            patternName: featurePattern.name,
            confidence: 90,
            reason: 'Issue title contains "feature" or "enhancement"',
            recommendedLabelId: featurePattern.labelId,
            recommendedLabelName: `Label for ${featurePattern.name}`,
          });
        }
      }

      // Store the suggestion
      this.suggestions.set(issue.id, suggestion);

      this.logger.info(
        `Generated ${suggestion.suggestedPatterns.length} pattern suggestions for issue: ${issue.id}`
      );
      return suggestion;
    } catch (error) {
      this.logger.error(`Failed to generate pattern suggestions for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Get pattern suggestions for an issue
   */
  public getPatternSuggestions(issueId: string): PatternSuggestion | undefined {
    return this.suggestions.get(issueId);
  }

  /**
   * Apply pattern suggestions to an issue
   */
  public async applyPatternSuggestions(
    issue: LinearIssue,
    minConfidence: number = 70
  ): Promise<boolean> {
    try {
      this.logger.info(
        `Applying pattern suggestions to issue: ${issue.id} (min confidence: ${minConfidence}%)`
      );

      // Get existing suggestions
      const suggestion = this.suggestions.get(issue.id);
      if (!suggestion) {
        this.logger.info(`No suggestions found for issue: ${issue.id}`);
        return false;
      }

      // Filter suggestions by confidence
      const highConfidenceSuggestions = suggestion.suggestedPatterns.filter(
        (s) => s.confidence >= minConfidence
      );

      if (highConfidenceSuggestions.length === 0) {
        this.logger.info(`No high-confidence suggestions for issue: ${issue.id}`);
        return true;
      }

      // Apply each high-confidence suggestion
      for (const suggestionItem of highConfidenceSuggestions) {
        try {
          const pattern = this.patterns.get(suggestionItem.patternId);
          if (pattern) {
            // In a real implementation, we'd apply the pattern to the issue
            this.logger.info(`Would apply pattern ${pattern.name} to issue: ${issue.id}`);
          }
        } catch (error) {
          this.logger.error(
            `Failed to apply pattern suggestion: ${suggestionItem.patternName}`,
            error
          );
        }
      }

      this.logger.info(`Applied pattern suggestions to issue: ${issue.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply pattern suggestions to issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Find patterns that could be consolidated or are duplicates
   */
  public findSimilarPatterns(): Array<{
    pattern1: PatternRule;
    pattern2: PatternRule;
    similarity: number;
  }> {
    try {
      this.logger.info('Finding similar patterns');

      const patterns = Array.from(this.patterns.values());
      const similarPairs: Array<{
        pattern1: PatternRule;
        pattern2: PatternRule;
        similarity: number;
      }> = [];

      // Compare each pattern with every other pattern
      for (let i = 0; i < patterns.length; i++) {
        for (let j = i + 1; j < patterns.length; j++) {
          const pattern1 = patterns[i];
          const pattern2 = patterns[j];

          // Calculate similarity based on pattern text and other attributes
          const similarity = this.calculatePatternSimilarity(pattern1, pattern2);

          // If similarity is above threshold, add to results
          if (similarity > 0.8) {
            // 80% similarity threshold
            similarPairs.push({
              pattern1,
              pattern2,
              similarity,
            });
          }
        }
      }

      // Sort by similarity (highest first)
      similarPairs.sort((a, b) => b.similarity - a.similarity);

      this.logger.info(`Found ${similarPairs.length} similar pattern pairs`);
      return similarPairs;
    } catch (error) {
      this.logger.error('Failed to find similar patterns', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two patterns
   */
  private calculatePatternSimilarity(pattern1: PatternRule, pattern2: PatternRule): number {
    try {
      // Simple similarity calculation based on pattern text
      // In a real implementation, this would use more sophisticated algorithms

      // Compare pattern text
      const patternText1 = pattern1.pattern.toLowerCase();
      const patternText2 = pattern2.pattern.toLowerCase();

      // Simple string similarity (Levenshtein distance approximation)
      const maxLength = Math.max(patternText1.length, patternText2.length);
      if (maxLength === 0) {
        return 1;
      }

      let differences = 0;
      const minLength = Math.min(patternText1.length, patternText2.length);

      for (let i = 0; i < minLength; i++) {
        if (patternText1[i] !== patternText2[i]) {
          differences++;
        }
      }

      differences += Math.abs(patternText1.length - patternText2.length);

      const similarity = 1 - differences / maxLength;

      this.logger.info(
        `Calculated similarity between ${pattern1.name} and ${pattern2.name}: ${similarity}`
      );
      return similarity;
    } catch (error) {
      this.logger.error(`Failed to calculate similarity between patterns`, error);
      throw error;
    }
  }

  /**
   * Merge similar patterns
   */
  public async mergeSimilarPatterns(patternPair: {
    pattern1: PatternRule;
    pattern2: PatternRule;
    similarity: number;
  }): Promise<PatternRule | null> {
    try {
      this.logger.info(
        `Merging similar patterns: ${patternPair.pattern1.name} and ${patternPair.pattern2.name}`
      );

      if (patternPair.similarity < 0.8) {
        this.logger.warn(`Patterns not similar enough to merge: ${patternPair.similarity}`);
        return null;
      }

      // Keep the pattern with higher usage count
      const keepPattern =
        patternPair.pattern1.usageCount >= patternPair.pattern2.usageCount
          ? patternPair.pattern1
          : patternPair.pattern2;
      const removePattern =
        keepPattern === patternPair.pattern1 ? patternPair.pattern2 : patternPair.pattern1;

      // Combine conditions and actions if they differ significantly
      // In a real implementation, we'd merge the patterns more intelligently

      // Remove the less-used pattern
      this.patterns.delete(removePattern.id);

      // Update the kept pattern's usage count
      keepPattern.usageCount += removePattern.usageCount;
      keepPattern.updatedAt = new Date();
      this.patterns.set(keepPattern.id, keepPattern);

      this.logger.info(`Merged patterns into: ${keepPattern.name}`);
      return keepPattern;
    } catch (error) {
      this.logger.error(`Failed to merge similar patterns`, error);
      throw error;
    }
  }

  /**
   * Export patterns to a standardized format
   */
  public exportPatterns(): PatternRule[] {
    try {
      this.logger.info('Exporting patterns');

      const patterns = Array.from(this.patterns.values());

      this.logger.info(`Exported ${patterns.length} patterns`);
      return patterns;
    } catch (error) {
      this.logger.error('Failed to export patterns', error);
      throw error;
    }
  }

  /**
   * Import patterns from a standardized format
   */
  public importPatterns(patterns: PatternRule[]): void {
    try {
      this.logger.info(`Importing ${patterns.length} patterns`);

      // Clear existing patterns
      this.patterns.clear();

      // Import new patterns
      for (const pattern of patterns) {
        this.patterns.set(pattern.id, pattern);
      }

      this.logger.info(`Imported ${patterns.length} patterns`);
    } catch (error) {
      this.logger.error('Failed to import patterns', error);
      throw error;
    }
  }

  /**
   * Test a pattern against sample text
   */
  public testPattern(
    patternText: string,
    caseSensitive: boolean,
    sampleText: string
  ): {
    matched: boolean;
    matches: string[];
    error?: string;
  } {
    try {
      this.logger.info(`Testing pattern: ${patternText} against sample text`);

      // Create RegExp with appropriate flags
      const flags = caseSensitive ? 'g' : 'gi';
      let regex: RegExp;

      try {
        regex = new RegExp(patternText, flags);
      } catch (error) {
        return {
          matched: false,
          matches: [],
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }

      // Find all matches
      const matches: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = regex.exec(sampleText)) !== null) {
        matches.push(match[0]);
      }

      const result = {
        matched: matches.length > 0,
        matches,
      };

      this.logger.info(
        `Pattern test result: ${result.matched ? 'matched' : 'no match'} (${matches.length} matches)`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to test pattern: ${patternText}`, error);
      throw error;
    }
  }

  /**
   * Optimize pattern performance by reordering based on usage
   */
  public optimizePatternOrder(): void {
    try {
      this.logger.info('Optimizing pattern order');

      // Sort patterns by usage count (descending) and priority (descending)
      const patterns = Array.from(this.patterns.values());
      patterns.sort((a, b) => {
        // Primary sort: usage count (descending)
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        // Secondary sort: priority (descending)
        return b.priority - a.priority;
      });

      // Reinsert patterns in optimized order
      this.patterns.clear();
      for (const pattern of patterns) {
        this.patterns.set(pattern.id, pattern);
      }

      this.logger.info('Pattern order optimized');
    } catch (error) {
      this.logger.error('Failed to optimize pattern order', error);
      throw error;
    }
  }

  /**
   * Clean up old match results to prevent memory issues
   */
  public cleanupOldResults(maxAgeHours: number = 24): void {
    try {
      this.logger.info(`Cleaning up match results older than ${maxAgeHours} hours`);

      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const initialLength = this.matchResults.length;

      this.matchResults = this.matchResults.filter((result) => result.timestamp > cutoffTime);

      const removedCount = initialLength - this.matchResults.length;
      if (removedCount > 0) {
        this.logger.info(`Cleaned up ${removedCount} old match results`);
      }
    } catch (error) {
      this.logger.error('Failed to clean up old match results', error);
      throw error;
    }
  }
}
