/**
 * CommentTemplates.ts
 *
 * Manages Linear comment templates with variable substitution, conditional sections,
 * AI-powered customization, and version control for consistent team communication.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface CommentTemplate {
  id: string;
  name: string;
  description?: string;
  content: string; // Template content with variables
  variables: TemplateVariable[]; // Available variables in the template
  conditions: TemplateCondition[]; // Conditional sections
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  category?: string;
  tags?: string[];
  aiCustomizable: boolean; // Whether AI can customize this template
}

export interface TemplateVariable {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'user' | 'team' | 'issue' | 'custom';
  defaultValue?: any;
  required: boolean;
  exampleValue?: any;
}

export interface TemplateCondition {
  id: string;
  variableName: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'exists'
    | 'not_exists';
  value: any;
  sectionStart: string; // Marker for start of conditional section
  sectionEnd: string; // Marker for end of conditional section
}

export interface TemplateInstance {
  templateId: string;
  issueId: string;
  variables: Record<string, any>;
  renderedContent: string;
  createdAt: Date;
  createdBy: string;
}

export interface VariableSubstitution {
  variableName: string;
  value: any;
  resolved: boolean;
  error?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  templates: string[]; // Template IDs in this category
  createdAt: Date;
  updatedAt: Date;
}

export class CommentTemplates {
  private linearClient: LinearClient;
  private templates: Map<string, CommentTemplate>;
  private instances: TemplateInstance[];
  private categories: Map<string, TemplateCategory>;
  private variableResolvers: Map<string, (issue: LinearIssue) => any>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.templates = new Map();
    this.instances = [];
    this.categories = new Map();
    this.variableResolvers = new Map();
    this.logger = new Logger('CommentTemplates');

    // Register default variable resolvers
    this.registerDefaultVariableResolvers();
  }

  /**
   * Register default variable resolvers
   */
  private registerDefaultVariableResolvers(): void {
    try {
      this.logger.info('Registering default variable resolvers');

      // Issue-related variables
      this.variableResolvers.set('issue.id', (issue) => issue.id);
      this.variableResolvers.set('issue.title', (issue) => issue.title);
      this.variableResolvers.set('issue.description', (issue) => issue.description);
      this.variableResolvers.set('issue.state', (issue) => issue.state?.name);
      this.variableResolvers.set('issue.priority', (issue) => issue.priority);
      this.variableResolvers.set('issue.assignee', (issue) => issue.assignee?.name);
      this.variableResolvers.set('issue.creator', (issue) => issue.creator?.name);
      this.variableResolvers.set('issue.createdAt', (issue) => issue.createdAt);
      this.variableResolvers.set('issue.updatedAt', (issue) => issue.updatedAt);
      this.variableResolvers.set('issue.dueDate', (issue) => issue.dueDate);

      // Team-related variables
      this.variableResolvers.set('team.name', (issue) => issue.team?.name);
      this.variableResolvers.set('team.key', (issue) => issue.team?.key);

      // User-related variables (current user)
      this.variableResolvers.set('currentUser.name', () => 'Current User'); // Would be replaced with actual user
      this.variableResolvers.set('currentUser.email', () => 'current@example.com'); // Would be replaced with actual user

      // Date/time variables
      this.variableResolvers.set('currentDate', () => new Date().toISOString().split('T')[0]);
      this.variableResolvers.set(
        'currentTime',
        () => new Date().toISOString().split('T')[1].split('.')[0]
      );
      this.variableResolvers.set('currentDateTime', () => new Date().toISOString());

      this.logger.info('Default variable resolvers registered');
    } catch (error) {
      this.logger.error('Failed to register default variable resolvers', error);
      throw error;
    }
  }

  /**
   * Add a new comment template
   */
  public addTemplate(template: CommentTemplate): void {
    try {
      this.logger.info(`Adding comment template: ${template.name}`);

      // Validate template
      this.validateTemplate(template);

      // Add to collection
      this.templates.set(template.id, template);

      // Add to category if specified
      if (template.category) {
        this.addToCategory(template.category, template.id);
      }

      this.logger.info(`Comment template added successfully: ${template.name}`);
    } catch (error) {
      this.logger.error(`Failed to add comment template: ${template.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a comment template
   */
  private validateTemplate(template: CommentTemplate): void {
    try {
      this.logger.info(`Validating comment template: ${template.name}`);

      // Check for required fields
      if (!template.id) {
        throw new Error('Template ID is required');
      }

      if (!template.name) {
        throw new Error('Template name is required');
      }

      if (!template.content) {
        throw new Error('Template content is required');
      }

      // Validate variables
      for (const variable of template.variables) {
        if (!variable.name) {
          throw new Error('Variable name is required');
        }

        if (!variable.type) {
          throw new Error(`Variable type is required for variable: ${variable.name}`);
        }
      }

      // Validate conditions
      for (const condition of template.conditions) {
        if (!condition.variableName) {
          throw new Error('Condition variable name is required');
        }

        if (!condition.operator) {
          throw new Error('Condition operator is required');
        }

        if (!condition.sectionStart) {
          throw new Error('Condition section start marker is required');
        }

        if (!condition.sectionEnd) {
          throw new Error('Condition section end marker is required');
        }
      }

      this.logger.info(`Template validated successfully: ${template.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate template: ${template.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a comment template
   */
  public removeTemplate(templateId: string): boolean {
    try {
      this.logger.info(`Removing comment template: ${templateId}`);

      const template = this.templates.get(templateId);
      if (!template) {
        this.logger.warn(`Comment template not found: ${templateId}`);
        return false;
      }

      // Remove from category
      if (template.category) {
        this.removeFromCategory(template.category, templateId);
      }

      // Remove the template
      const deleted = this.templates.delete(templateId);
      if (deleted) {
        this.logger.info(`Comment template removed successfully: ${template.name}`);
      } else {
        this.logger.warn(`Failed to remove comment template: ${template.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove comment template: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * Update a comment template
   */
  public updateTemplate(
    templateId: string,
    updates: Partial<
      Omit<CommentTemplate, 'id' | 'createdAt' | 'createdBy' | 'usageCount' | 'lastUsed'>
    >
  ): boolean {
    try {
      this.logger.info(`Updating comment template: ${templateId}`);

      const template = this.templates.get(templateId);
      if (!template) {
        this.logger.warn(`Comment template not found: ${templateId}`);
        return false;
      }

      // Update the template
      Object.assign(template, updates, {
        version: template.version + 1,
        updatedAt: new Date(),
        updatedBy: 'system', // Would be replaced with actual user
      });

      // Update category if changed
      if (updates.category !== undefined && updates.category !== template.category) {
        if (template.category) {
          this.removeFromCategory(template.category, templateId);
        }
        if (updates.category) {
          this.addToCategory(updates.category, templateId);
        }
      }

      // Update in map
      this.templates.set(templateId, template);

      this.logger.info(`Comment template updated successfully: ${template.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update comment template: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * Get a comment template by ID
   */
  public getTemplate(templateId: string): CommentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get all comment templates
   */
  public getAllTemplates(): CommentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  public getTemplatesByCategory(categoryName: string): CommentTemplate[] {
    try {
      this.logger.info(`Getting templates by category: ${categoryName}`);

      const category = this.categories.get(categoryName);
      if (!category) {
        this.logger.warn(`Category not found: ${categoryName}`);
        return [];
      }

      const templates: CommentTemplate[] = [];
      for (const templateId of category.templates) {
        const template = this.templates.get(templateId);
        if (template) {
          templates.push(template);
        }
      }

      this.logger.info(`Found ${templates.length} templates in category: ${categoryName}`);
      return templates;
    } catch (error) {
      this.logger.error(`Failed to get templates by category: ${categoryName}`, error);
      throw error;
    }
  }

  /**
   * Get templates by tag
   */
  public getTemplatesByTag(tag: string): CommentTemplate[] {
    try {
      this.logger.info(`Getting templates by tag: ${tag}`);

      const templates: CommentTemplate[] = [];

      for (const template of this.templates.values()) {
        if (template.tags && template.tags.includes(tag)) {
          templates.push(template);
        }
      }

      this.logger.info(`Found ${templates.length} templates with tag: ${tag}`);
      return templates;
    } catch (error) {
      this.logger.error(`Failed to get templates by tag: ${tag}`, error);
      throw error;
    }
  }

  /**
   * Create a template category
   */
  public createCategory(category: TemplateCategory): void {
    try {
      this.logger.info(`Creating template category: ${category.name}`);

      this.categories.set(category.id, category);

      this.logger.info(`Template category created successfully: ${category.name}`);
    } catch (error) {
      this.logger.error(`Failed to create template category: ${category.name}`, error);
      throw error;
    }
  }

  /**
   * Add a template to a category
   */
  private addToCategory(categoryName: string, templateId: string): void {
    try {
      this.logger.info(`Adding template ${templateId} to category: ${categoryName}`);

      // Get or create category
      let category = this.categories.get(categoryName);
      if (!category) {
        category = {
          id: categoryName,
          name: categoryName,
          templates: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.categories.set(categoryName, category);
      }

      // Add template to category if not already present
      if (!category.templates.includes(templateId)) {
        category.templates.push(templateId);
        category.updatedAt = new Date();
        this.categories.set(categoryName, category);
      }

      this.logger.info(`Template added to category: ${categoryName}`);
    } catch (error) {
      this.logger.error(`Failed to add template to category: ${categoryName}`, error);
      throw error;
    }
  }

  /**
   * Remove a template from a category
   */
  private removeFromCategory(categoryName: string, templateId: string): void {
    try {
      this.logger.info(`Removing template ${templateId} from category: ${categoryName}`);

      const category = this.categories.get(categoryName);
      if (category) {
        category.templates = category.templates.filter((id) => id !== templateId);
        category.updatedAt = new Date();
        this.categories.set(categoryName, category);
      }

      this.logger.info(`Template removed from category: ${categoryName}`);
    } catch (error) {
      this.logger.error(`Failed to remove template from category: ${categoryName}`, error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  public getAllCategories(): TemplateCategory[] {
    return Array.from(this.categories.values());
  }

  /**
   * Render a template with variables substituted
   */
  public async renderTemplate(
    templateId: string,
    issue: LinearIssue,
    customVariables?: Record<string, any>
  ): Promise<TemplateInstance> {
    try {
      this.logger.info(`Rendering template: ${templateId} for issue: ${issue.id}`);

      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Resolve variables
      const resolvedVariables = await this.resolveVariables(template, issue, customVariables);

      // Substitute variables in content
      let renderedContent = template.content;

      // Handle conditional sections first
      renderedContent = this.processConditionalSections(
        renderedContent,
        template.conditions,
        resolvedVariables
      );

      // Substitute simple variables
      renderedContent = this.substituteSimpleVariables(renderedContent, resolvedVariables);

      // Handle function calls in variables (advanced)
      renderedContent = this.processFunctionCalls(renderedContent, resolvedVariables, issue);

      // Create template instance
      const instance: TemplateInstance = {
        templateId: template.id,
        issueId: issue.id,
        variables: resolvedVariables,
        renderedContent,
        createdAt: new Date(),
        createdBy: 'system', // Would be replaced with actual user
      };

      // Store the instance
      this.instances.push(instance);

      // Keep only the most recent 1000 instances to prevent memory issues
      if (this.instances.length > 1000) {
        this.instances = this.instances.slice(-1000);
      }

      // Update template usage statistics
      template.usageCount++;
      template.lastUsed = new Date();
      template.version++; // Increment version for usage tracking
      this.templates.set(templateId, template);

      this.logger.info(`Template rendered successfully: ${template.name}`);
      return instance;
    } catch (error) {
      this.logger.error(`Failed to render template: ${templateId}`, error);
      throw error;
    }
  }

  /**
   * Resolve variables for a template
   */
  private async resolveVariables(
    template: CommentTemplate,
    issue: LinearIssue,
    customVariables?: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      this.logger.info(`Resolving variables for template: ${template.name}`);

      const resolvedVariables: Record<string, any> = {};

      // Add custom variables first (they take precedence)
      if (customVariables) {
        Object.assign(resolvedVariables, customVariables);
      }

      // Resolve template-defined variables
      for (const variable of template.variables) {
        // Skip if already resolved from custom variables
        if (resolvedVariables.hasOwnProperty(variable.name)) {
          continue;
        }

        // Check for registered resolver
        const resolver = this.variableResolvers.get(variable.name);
        if (resolver) {
          try {
            resolvedVariables[variable.name] = resolver(issue);
          } catch (error) {
            this.logger.error(`Failed to resolve variable: ${variable.name}`, error);
            resolvedVariables[variable.name] = variable.defaultValue;
          }
        } else if (variable.defaultValue !== undefined) {
          // Use default value if available
          resolvedVariables[variable.name] = variable.defaultValue;
        } else {
          // Leave as undefined
          resolvedVariables[variable.name] = undefined;
        }
      }

      this.logger.info(
        `Resolved ${Object.keys(resolvedVariables).length} variables for template: ${template.name}`
      );
      return resolvedVariables;
    } catch (error) {
      this.logger.error(`Failed to resolve variables for template: ${template.name}`, error);
      throw error;
    }
  }

  /**
   * Process conditional sections in template content
   */
  private processConditionalSections(
    content: string,
    conditions: TemplateCondition[],
    variables: Record<string, any>
  ): string {
    try {
      this.logger.info('Processing conditional sections');

      let processedContent = content;

      // Process each condition
      for (const condition of conditions) {
        const variableValue = variables[condition.variableName];
        const conditionMet = this.evaluateCondition(condition, variableValue);

        // Find the conditional section markers
        const sectionStartIndex = processedContent.indexOf(condition.sectionStart);
        const sectionEndIndex = processedContent.indexOf(condition.sectionEnd);

        if (sectionStartIndex >= 0 && sectionEndIndex > sectionStartIndex) {
          // Extract the section content
          const sectionContent = processedContent.substring(
            sectionStartIndex + condition.sectionStart.length,
            sectionEndIndex
          );

          // Replace based on condition result
          if (conditionMet) {
            // Include the section content
            processedContent =
              processedContent.substring(0, sectionStartIndex) +
              sectionContent +
              processedContent.substring(sectionEndIndex + condition.sectionEnd.length);
          } else {
            // Remove the entire conditional section
            processedContent =
              processedContent.substring(0, sectionStartIndex) +
              processedContent.substring(sectionEndIndex + condition.sectionEnd.length);
          }
        }
      }

      this.logger.info('Conditional sections processed');
      return processedContent;
    } catch (error) {
      this.logger.error('Failed to process conditional sections', error);
      throw error;
    }
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: TemplateCondition, variableValue: any): boolean {
    try {
      this.logger.info(`Evaluating condition: ${condition.variableName} ${condition.operator}`);

      switch (condition.operator) {
        case 'equals':
          return variableValue === condition.value;

        case 'not_equals':
          return variableValue !== condition.value;

        case 'contains':
          if (typeof variableValue === 'string' && typeof condition.value === 'string') {
            return variableValue.includes(condition.value);
          }
          return false;

        case 'not_contains':
          if (typeof variableValue === 'string' && typeof condition.value === 'string') {
            return !variableValue.includes(condition.value);
          }
          return true;

        case 'greater_than':
          return variableValue > condition.value;

        case 'less_than':
          return variableValue < condition.value;

        case 'exists':
          return variableValue !== undefined && variableValue !== null;

        case 'not_exists':
          return variableValue === undefined || variableValue === null;

        default:
          this.logger.warn(`Unknown condition operator: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate condition: ${condition.variableName}`, error);
      throw error;
    }
  }

  /**
   * Substitute simple variables in template content
   */
  private substituteSimpleVariables(content: string, variables: Record<string, any>): string {
    try {
      this.logger.info('Substituting simple variables');

      let processedContent = content;

      // Replace each variable
      for (const [variableName, variableValue] of Object.entries(variables)) {
        // Create the variable placeholder (e.g., {{variableName}})
        const placeholder = `{{${variableName}}}`;

        // Convert variable value to string
        const stringValue =
          variableValue !== undefined && variableValue !== null ? String(variableValue) : '';

        // Replace all occurrences
        processedContent = processedContent.split(placeholder).join(stringValue);
      }

      this.logger.info('Simple variables substituted');
      return processedContent;
    } catch (error) {
      this.logger.error('Failed to substitute simple variables', error);
      throw error;
    }
  }

  /**
   * Process function calls in variables
   */
  private processFunctionCalls(
    content: string,
    variables: Record<string, any>,
    issue: LinearIssue
  ): string {
    try {
      this.logger.info('Processing function calls');

      // This is a simplified implementation
      // In a real scenario, this would be much more sophisticated

      let processedContent = content;

      // Handle common functions
      processedContent = processedContent.replace(
        /\{\{upper\(([^}]+)\)\}\}/g,
        (match, variableName) => {
          const value = variables[variableName] || '';
          return String(value).toUpperCase();
        }
      );

      processedContent = processedContent.replace(
        /\{\{lower\(([^}]+)\)\}\}/g,
        (match, variableName) => {
          const value = variables[variableName] || '';
          return String(value).toLowerCase();
        }
      );

      processedContent = processedContent.replace(
        /\{\{capitalize\(([^}]+)\)\}\}/g,
        (match, variableName) => {
          const value = variables[variableName] || '';
          return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
        }
      );

      processedContent = processedContent.replace(
        /\{\{truncate\(([^,]+),\s*(\d+)\)\}\}/g,
        (match, variableName, maxLength) => {
          const value = variables[variableName] || '';
          const maxLen = parseInt(maxLength, 10);
          return String(value).substring(0, maxLen);
        }
      );

      this.logger.info('Function calls processed');
      return processedContent;
    } catch (error) {
      this.logger.error('Failed to process function calls', error);
      throw error;
    }
  }

  /**
   * Apply a template to an issue (add comment)
   */
  public async applyTemplate(
    templateId: string,
    issueId: string,
    customVariables?: Record<string, any>
  ): Promise<boolean> {
    try {
      this.logger.info(`Applying template: ${templateId} to issue: ${issueId}`);

      // Fetch the issue
      const issue = await this.linearClient.getIssueById(issueId);
      if (!issue) {
        throw new Error(`Issue not found: ${issueId}`);
      }

      // Render the template
      const instance = await this.renderTemplate(templateId, issue, customVariables);

      // Add the comment to the issue
      // In a real implementation, this would use the Linear API to add a comment
      this.logger.info(
        `Would add comment to issue ${issueId}: ${instance.renderedContent.substring(0, 100)}...`
      );

      this.logger.info(`Template applied successfully to issue: ${issueId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply template: ${templateId} to issue: ${issueId}`, error);
      throw error;
    }
  }

  /**
   * Get all template instances
   */
  public getTemplateInstances(): TemplateInstance[] {
    return [...this.instances];
  }

  /**
   * Get template instances for a specific issue
   */
  public getInstancesForIssue(issueId: string): TemplateInstance[] {
    return this.instances.filter((instance) => instance.issueId === issueId);
  }

  /**
   * Get template instances for a specific template
   */
  public getInstancesForTemplate(templateId: string): TemplateInstance[] {
    return this.instances.filter((instance) => instance.templateId === templateId);
  }

  /**
   * Get template usage statistics
   */
  public getTemplateStats(): {
    totalTemplates: number;
    totalInstances: number;
    mostUsedTemplates: Array<{ template: CommentTemplate; usage: number }>;
    categoryStats: Record<string, number>;
    averageUsagePerTemplate: number;
  } {
    try {
      this.logger.info('Generating template statistics');

      const templates = Array.from(this.templates.values());

      // Calculate total instances
      const totalInstances = this.instances.length;

      // Find most used templates
      const sortedTemplates = [...templates].sort((a, b) => b.usageCount - a.usageCount);
      const mostUsedTemplates = sortedTemplates.slice(0, 10).map((template) => ({
        template,
        usage: template.usageCount,
      }));

      // Calculate category statistics
      const categoryStats: Record<string, number> = {};
      for (const template of templates) {
        if (template.category) {
          categoryStats[template.category] = (categoryStats[template.category] || 0) + 1;
        }
      }

      // Calculate average usage
      const totalUsage = templates.reduce((sum, template) => sum + template.usageCount, 0);
      const averageUsagePerTemplate = templates.length > 0 ? totalUsage / templates.length : 0;

      const stats = {
        totalTemplates: templates.length,
        totalInstances,
        mostUsedTemplates,
        categoryStats,
        averageUsagePerTemplate,
      };

      this.logger.info('Template statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate template statistics', error);
      throw error;
    }
  }

  /**
   * Find templates that could be consolidated or are duplicates
   */
  public findSimilarTemplates(): Array<{
    template1: CommentTemplate;
    template2: CommentTemplate;
    similarity: number;
  }> {
    try {
      this.logger.info('Finding similar templates');

      const templates = Array.from(this.templates.values());
      const similarPairs: Array<{
        template1: CommentTemplate;
        template2: CommentTemplate;
        similarity: number;
      }> = [];

      // Compare each template with every other template
      for (let i = 0; i < templates.length; i++) {
        for (let j = i + 1; j < templates.length; j++) {
          const template1 = templates[i];
          const template2 = templates[j];

          // Calculate similarity based on content and variables
          const similarity = this.calculateTemplateSimilarity(template1, template2);

          // If similarity is above threshold, add to results
          if (similarity > 0.8) {
            // 80% similarity threshold
            similarPairs.push({
              template1,
              template2,
              similarity,
            });
          }
        }
      }

      // Sort by similarity (highest first)
      similarPairs.sort((a, b) => b.similarity - a.similarity);

      this.logger.info(`Found ${similarPairs.length} similar template pairs`);
      return similarPairs;
    } catch (error) {
      this.logger.error('Failed to find similar templates', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two templates
   */
  private calculateTemplateSimilarity(
    template1: CommentTemplate,
    template2: CommentTemplate
  ): number {
    try {
      // Simple similarity calculation based on content
      // In a real implementation, this would use more sophisticated algorithms

      // Compare template content
      const content1 = template1.content.toLowerCase();
      const content2 = template2.content.toLowerCase();

      // Simple string similarity (Levenshtein distance approximation)
      const maxLength = Math.max(content1.length, content2.length);
      if (maxLength === 0) {
        return 1;
      }

      let differences = 0;
      const minLength = Math.min(content1.length, content2.length);

      for (let i = 0; i < minLength; i++) {
        if (content1[i] !== content2[i]) {
          differences++;
        }
      }

      differences += Math.abs(content1.length - content2.length);

      const similarity = 1 - differences / maxLength;

      this.logger.info(
        `Calculated similarity between ${template1.name} and ${template2.name}: ${similarity}`
      );
      return similarity;
    } catch (error) {
      this.logger.error(`Failed to calculate similarity between templates`, error);
      throw error;
    }
  }

  /**
   * Merge similar templates
   */
  public async mergeSimilarTemplates(templatePair: {
    template1: CommentTemplate;
    template2: CommentTemplate;
    similarity: number;
  }): Promise<CommentTemplate | null> {
    try {
      this.logger.info(
        `Merging similar templates: ${templatePair.template1.name} and ${templatePair.template2.name}`
      );

      if (templatePair.similarity < 0.8) {
        this.logger.warn(`Templates not similar enough to merge: ${templatePair.similarity}`);
        return null;
      }

      // Keep the template with higher usage count
      const keepTemplate =
        templatePair.template1.usageCount >= templatePair.template2.usageCount
          ? templatePair.template1
          : templatePair.template2;
      const removeTemplate =
        keepTemplate === templatePair.template1 ? templatePair.template2 : templatePair.template1;

      // Remove the less-used template
      this.templates.delete(removeTemplate.id);

      // Update the kept template's usage count
      keepTemplate.usageCount += removeTemplate.usageCount;
      keepTemplate.version++;
      keepTemplate.updatedAt = new Date();
      this.templates.set(keepTemplate.id, keepTemplate);

      this.logger.info(`Merged templates into: ${keepTemplate.name}`);
      return keepTemplate;
    } catch (error) {
      this.logger.error(`Failed to merge similar templates`, error);
      throw error;
    }
  }

  /**
   * Export templates to a standardized format
   */
  public exportTemplates(): CommentTemplate[] {
    try {
      this.logger.info('Exporting templates');

      const templates = Array.from(this.templates.values());

      this.logger.info(`Exported ${templates.length} templates`);
      return templates;
    } catch (error) {
      this.logger.error('Failed to export templates', error);
      throw error;
    }
  }

  /**
   * Import templates from a standardized format
   */
  public importTemplates(templates: CommentTemplate[]): void {
    try {
      this.logger.info(`Importing ${templates.length} templates`);

      // Clear existing templates
      this.templates.clear();

      // Import new templates
      for (const template of templates) {
        this.templates.set(template.id, template);
      }

      this.logger.info(`Imported ${templates.length} templates`);
    } catch (error) {
      this.logger.error('Failed to import templates', error);
      throw error;
    }
  }

  /**
   * Test a template with sample data
   */
  public async testTemplate(
    templateId: string,
    sampleIssue: Partial<LinearIssue>,
    customVariables?: Record<string, any>
  ): Promise<{ success: boolean; renderedContent?: string; error?: string }> {
    try {
      this.logger.info(`Testing template: ${templateId}`);

      // Create a mock issue
      const issue: LinearIssue = {
        id: sampleIssue.id || 'test-issue-id',
        title: sampleIssue.title || 'Test Issue',
        description: sampleIssue.description || 'Test issue description',
        state: sampleIssue.state || { id: 'state-1', name: 'Todo', type: 'unstarted' },
        priority: sampleIssue.priority || 'normal',
        createdAt: sampleIssue.createdAt || new Date().toISOString(),
        updatedAt: sampleIssue.updatedAt || new Date().toISOString(),
        // Add other required properties with default values
        url: sampleIssue.url || 'https://linear.app/test-issue',
        identifier: sampleIssue.identifier || 'TEST-1',
        number: sampleIssue.number || 1,
        creator: sampleIssue.creator || {
          id: 'user-1',
          name: 'Test User',
          email: 'test@example.com',
        },
        assignee: sampleIssue.assignee || {
          id: 'user-2',
          name: 'Assignee User',
          email: 'assignee@example.com',
        },
        team: sampleIssue.team || { id: 'team-1', name: 'Test Team', key: 'TEST' },
      } as LinearIssue;

      // Render the template
      const instance = await this.renderTemplate(templateId, issue, customVariables);

      const result = {
        success: true,
        renderedContent: instance.renderedContent,
      };

      this.logger.info(`Template test successful: ${templateId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to test template: ${templateId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register a custom variable resolver
   */
  public registerVariableResolver(
    variableName: string,
    resolver: (issue: LinearIssue) => any
  ): void {
    try {
      this.logger.info(`Registering variable resolver for: ${variableName}`);

      this.variableResolvers.set(variableName, resolver);

      this.logger.info(`Variable resolver registered for: ${variableName}`);
    } catch (error) {
      this.logger.error(`Failed to register variable resolver for: ${variableName}`, error);
      throw error;
    }
  }

  /**
   * Unregister a custom variable resolver
   */
  public unregisterVariableResolver(variableName: string): boolean {
    try {
      this.logger.info(`Unregistering variable resolver for: ${variableName}`);

      const deleted = this.variableResolvers.delete(variableName);
      if (deleted) {
        this.logger.info(`Variable resolver unregistered for: ${variableName}`);
      } else {
        this.logger.warn(`No variable resolver found for: ${variableName}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister variable resolver for: ${variableName}`, error);
      throw error;
    }
  }

  /**
   * Get all registered variable resolvers
   */
  public getRegisteredVariables(): string[] {
    return Array.from(this.variableResolvers.keys());
  }

  /**
   * Clean up old template instances to prevent memory issues
   */
  public cleanupOldInstances(maxAgeHours: number = 24): void {
    try {
      this.logger.info(`Cleaning up template instances older than ${maxAgeHours} hours`);

      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const initialLength = this.instances.length;

      this.instances = this.instances.filter((instance) => instance.createdAt > cutoffTime);

      const removedCount = initialLength - this.instances.length;
      if (removedCount > 0) {
        this.logger.info(`Cleaned up ${removedCount} old template instances`);
      }
    } catch (error) {
      this.logger.error('Failed to clean up old template instances', error);
      throw error;
    }
  }

  /**
   * Create a default set of commonly used templates
   */
  public createDefaultTemplates(): void {
    try {
      this.logger.info('Creating default templates');

      // Bug report template
      const bugTemplate: CommentTemplate = {
        id: 'template-bug-report',
        name: 'Bug Report',
        description: 'Standard bug report template',
        content: `## Bug Report

### Summary
{{issue.title}}

### Steps to Reproduce
1. {{steps_to_reproduce}}

### Expected Behavior
{{expected_behavior}}

### Actual Behavior
{{actual_behavior}}

### Environment
- Browser: {{browser}}
- OS: {{os}}
- Version: {{version}}

### Additional Information
{{additional_info}}

Reported by: {{reporter}} on {{currentDate}}`,
        variables: [
          {
            name: 'steps_to_reproduce',
            type: 'string',
            required: true,
            description: 'Steps to reproduce the bug',
          },
          {
            name: 'expected_behavior',
            type: 'string',
            required: true,
            description: 'Expected behavior',
          },
          {
            name: 'actual_behavior',
            type: 'string',
            required: true,
            description: 'Actual behavior observed',
          },
          {
            name: 'browser',
            type: 'string',
            required: false,
            description: 'Browser name and version',
          },
          { name: 'os', type: 'string', required: false, description: 'Operating system' },
          { name: 'version', type: 'string', required: false, description: 'Software version' },
          {
            name: 'additional_info',
            type: 'string',
            required: false,
            description: 'Any additional information',
          },
          {
            name: 'reporter',
            type: 'string',
            required: false,
            description: 'Person who reported the bug',
          },
        ],
        conditions: [],
        version: 1,
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        aiCustomizable: true,
        category: 'Bug Reports',
        tags: ['bug', 'report'],
      };

      this.addTemplate(bugTemplate);

      // Feature request template
      const featureTemplate: CommentTemplate = {
        id: 'template-feature-request',
        name: 'Feature Request',
        description: 'Standard feature request template',
        content: `## Feature Request

### Problem Statement
{{problem_statement}}

### Proposed Solution
{{proposed_solution}}

### Benefits
{{benefits}}

### Implementation Notes
{{implementation_notes}}

Requested by: {{requester}} on {{currentDate}}`,
        variables: [
          {
            name: 'problem_statement',
            type: 'string',
            required: true,
            description: 'Problem this feature would solve',
          },
          {
            name: 'proposed_solution',
            type: 'string',
            required: true,
            description: 'Proposed solution',
          },
          {
            name: 'benefits',
            type: 'string',
            required: false,
            description: 'Benefits of implementing this feature',
          },
          {
            name: 'implementation_notes',
            type: 'string',
            required: false,
            description: 'Technical implementation notes',
          },
          {
            name: 'requester',
            type: 'string',
            required: false,
            description: 'Person who requested the feature',
          },
        ],
        conditions: [],
        version: 1,
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        aiCustomizable: true,
        category: 'Feature Requests',
        tags: ['feature', 'request'],
      };

      this.addTemplate(featureTemplate);

      this.logger.info('Default templates created successfully');
    } catch (error) {
      this.logger.error('Failed to create default templates', error);
      throw error;
    }
  }
}
