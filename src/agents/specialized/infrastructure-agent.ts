/**
 * Infrastructure Agent
 *
 * Specialized agent for infrastructure as code tasks:
 * - Terraform/OpenTofu generation
 * - Cloud resource management
 * - Infrastructure planning
 * - Configuration validation
 *
 * @module agents/specialized/infrastructure-agent
 */

import { BaseAgent } from '../agent-base';
import { AgentConfig, AgentCapability, AgentTask, AgentResult } from '../types';
import { BaseProvider } from '../../providers/provider-base';
import { MessageRole } from '../../providers/types';

interface InfrastructureTask extends AgentTask {
  type: 'generate' | 'validate' | 'plan' | 'analyze';
  input: {
    platform?: 'aws' | 'azure' | 'gcp' | 'cloudflare';
    tool?: 'terraform' | 'opentofu' | 'pulumi';
    resources?: string[];
    existing_code?: string;
    requirements?: string;
  };
}

interface InfrastructureResult extends AgentResult {
  output: {
    code?: string;
    validation_errors?: string[];
    recommendations?: string[];
    estimated_cost?: number;
  };
}

export class InfrastructureAgent extends BaseAgent {
  constructor(provider: BaseProvider, customConfig?: Partial<AgentConfig>) {
    const config: AgentConfig = {
      name: 'InfrastructureAgent',
      description: 'Specialized agent for infrastructure as code tasks',
      capabilities: [
        AgentCapability.INFRASTRUCTURE,
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.ANALYSIS,
      ],
      provider: provider.getName(),
      model: provider.getConfig().default_model || 'gpt-4',
      temperature: 0.3,
      max_tokens: 4000,
      ...customConfig,
    };

    super(config, provider);
  }

  protected async onInitialize(): Promise<void> {
    this.emit('initializing', { agent: this.getName() });

    const systemPrompt = this.createSystemMessage(
      `You are an expert infrastructure engineer specializing in Infrastructure as Code (IaC).

Your expertise includes:
- Terraform and OpenTofu for multi-cloud infrastructure
- AWS, Azure, GCP, and Cloudflare platforms
- Best practices for security, scalability, and cost optimization
- Infrastructure validation and testing
- Cloud architecture design patterns

When generating IaC code:
1. Follow best practices and security guidelines
2. Include proper variable definitions and outputs
3. Add comprehensive comments
4. Consider cost optimization
5. Ensure idempotency and safety
6. Use modules for reusability

Provide clear explanations and recommendations for infrastructure decisions.`
    );

    this.context.conversation_history.push({
      role: systemPrompt.role,
      content: systemPrompt.content,
    });
  }

  protected async processTask(task: AgentTask): Promise<AgentResult> {
    const infraTask = task as InfrastructureTask;

    switch (infraTask.type) {
      case 'generate':
        return await this.generateInfrastructure(infraTask);
      case 'validate':
        return await this.validateInfrastructure(infraTask);
      case 'plan':
        return await this.planInfrastructure(infraTask);
      case 'analyze':
        return await this.analyzeInfrastructure(infraTask);
      default:
        throw new Error(`Unknown infrastructure task type: ${infraTask.type}`);
    }
  }

  private async generateInfrastructure(task: InfrastructureTask): Promise<InfrastructureResult> {
    const { platform = 'aws', tool = 'terraform', resources = [], requirements = '' } = task.input;

    const prompt = `Generate ${tool} code for ${platform} with the following requirements:

Platform: ${platform}
Resources: ${resources.join(', ') || 'Not specified'}
Requirements:
${requirements}

Please provide:
1. Complete ${tool} configuration
2. Variable definitions
3. Output definitions
4. Security best practices
5. Cost optimization recommendations

Generate production-ready code with proper formatting and comments.`;

    const userMessage = this.createUserMessage(prompt);
    const response = await this.generateResponse([userMessage]);

    const code = this.extractCode(response);
    const recommendations = this.extractRecommendations(response);

    return {
      task_id: task.id,
      status: 'success',
      output: {
        code,
        recommendations,
      },
    };
  }

  private async validateInfrastructure(task: InfrastructureTask): Promise<InfrastructureResult> {
    const { existing_code = '', tool = 'terraform' } = task.input;

    if (!existing_code) {
      throw new Error('No code provided for validation');
    }

    const prompt = `Review and validate the following ${tool} code:

\`\`\`${tool}
${existing_code}
\`\`\`

Please check for:
1. Syntax errors
2. Security vulnerabilities
3. Best practice violations
4. Cost optimization opportunities
5. Resource naming conventions
6. Missing required configurations

Provide detailed feedback with specific line numbers where applicable.`;

    const userMessage = this.createUserMessage(prompt);
    const response = await this.generateResponse([userMessage]);

    const validationErrors = this.extractValidationErrors(response);
    const recommendations = this.extractRecommendations(response);

    return {
      task_id: task.id,
      status: validationErrors.length === 0 ? 'success' : 'partial',
      output: {
        validation_errors: validationErrors,
        recommendations,
      },
    };
  }

  private async planInfrastructure(task: InfrastructureTask): Promise<InfrastructureResult> {
    const { platform = 'aws', requirements = '' } = task.input;

    const prompt = `Create an infrastructure plan for ${platform} based on these requirements:

${requirements}

Provide:
1. High-level architecture overview
2. Required resources and services
3. Network topology
4. Security considerations
5. Estimated monthly cost
6. Scalability strategy
7. Disaster recovery approach

Format the response as a detailed infrastructure plan.`;

    const userMessage = this.createUserMessage(prompt);
    const response = await this.generateResponse([userMessage]);

    const recommendations = this.extractRecommendations(response);
    const estimatedCost = this.extractCost(response);

    return {
      task_id: task.id,
      status: 'success',
      output: {
        code: response,
        recommendations,
        estimated_cost: estimatedCost,
      },
    };
  }

  private async analyzeInfrastructure(task: InfrastructureTask): Promise<InfrastructureResult> {
    const { existing_code = '', platform = 'aws' } = task.input;

    if (!existing_code) {
      throw new Error('No code provided for analysis');
    }

    const prompt = `Analyze the following infrastructure code for ${platform}:

\`\`\`
${existing_code}
\`\`\`

Provide analysis on:
1. Resource utilization
2. Security posture
3. Cost optimization opportunities
4. Scalability limitations
5. Compliance with best practices
6. Potential risks
7. Improvement recommendations

Format the response with clear sections.`;

    const userMessage = this.createUserMessage(prompt);
    const response = await this.generateResponse([userMessage]);

    const recommendations = this.extractRecommendations(response);
    const estimatedCost = this.extractCost(response);

    return {
      task_id: task.id,
      status: 'success',
      output: {
        code: response,
        recommendations,
        estimated_cost: estimatedCost,
      },
    };
  }

  private extractCode(response: string): string {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...response.matchAll(codeBlockRegex)];

    if (matches.length > 0 && matches[0]) {
      return matches[0][1]?.trim() || '';
    }

    return response;
  }

  private extractRecommendations(response: string): string[] {
    const recommendations: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      if (
        line.trim().startsWith('-') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('•') ||
        /^\d+\./.test(line.trim())
      ) {
        const rec = line
          .trim()
          .replace(/^[-*•]\s*/, '')
          .replace(/^\d+\.\s*/, '');
        if (rec.length > 10) {
          recommendations.push(rec);
        }
      }
    }

    return recommendations;
  }

  private extractValidationErrors(response: string): string[] {
    const errors: string[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      if (
        line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('issue') ||
        line.toLowerCase().includes('problem') ||
        line.toLowerCase().includes('warning')
      ) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  private extractCost(response: string): number | undefined {
    const costRegex = /\$(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|monthly|\/month)/i;
    const match = response.match(costRegex);

    if (match && match[1]) {
      return parseFloat(match[1].replace(',', ''));
    }

    return undefined;
  }

  public async generateTerraform(
    platform: string,
    resources: string[],
    requirements: string
  ): Promise<string> {
    const task: InfrastructureTask = {
      id: `terraform-gen-${Date.now()}`,
      type: 'generate',
      description: `Generate Terraform for ${platform}`,
      input: {
        platform: platform as InfrastructureTask['input']['platform'],
        tool: 'terraform',
        resources,
        requirements,
      },
    };

    const result = (await this.executeTask(task)) as InfrastructureResult;

    return result.output.code || '';
  }

  public async validateCode(
    code: string,
    tool: string = 'terraform'
  ): Promise<{
    valid: boolean;
    errors: string[];
    recommendations: string[];
  }> {
    const task: InfrastructureTask = {
      id: `validate-${Date.now()}`,
      type: 'validate',
      description: 'Validate infrastructure code',
      input: {
        existing_code: code,
        tool: tool as InfrastructureTask['input']['tool'],
      },
    };

    const result = (await this.executeTask(task)) as InfrastructureResult;

    return {
      valid: result.status === 'success',
      errors: result.output.validation_errors || [],
      recommendations: result.output.recommendations || [],
    };
  }
}
