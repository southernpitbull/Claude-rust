import { BaseAgent, AgentConfig, AgentResult, AgentState } from './langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Code Generation Agent
 * Specializes in generating clean, efficient, and well-structured code
 */
export class CodeGenerationAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'code-generation-agent',
      description:
        config?.description ||
        'Specializes in generating clean, efficient, and well-structured code',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.2, // Lower temperature for more deterministic code
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software developer specializing in code generation.
Your primary responsibilities include:
1. Generating clean, efficient, and well-structured code
2. Following best practices and coding standards
3. Writing code with appropriate comments and documentation
4. Ensuring code is maintainable and readable
5. Considering performance and security implications
6. Providing code examples with explanations

When generating code:
- Always follow the language's best practices
- Include necessary imports/dependencies
- Add appropriate comments for complex logic
- Write unit tests when appropriate
- Consider edge cases and error handling
- Optimize for readability and maintainability`,
      capabilities: config?.capabilities || [
        'coding',
        'code-generation',
        'refactoring',
        'optimization',
        'testing',
        'documentation',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('needs review') || content.includes('code review')) {
        next = 'code-review-agent';
      } else if (content.includes('testing') || content.includes('unit tests')) {
        next = 'testing-agent';
      } else if (content.includes('security') || content.includes('vulnerability')) {
        next = 'security-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Code Review Agent
 * Analyzes and reviews code for quality, security, and best practices
 */
export class CodeReviewAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'code-review-agent',
      description:
        config?.description ||
        'Analyzes and reviews code for quality, security, and best practices',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert code reviewer specializing in code quality, security, and best practices.
Your primary responsibilities include:
1. Analyzing code for quality issues
2. Identifying security vulnerabilities
3. Checking for adherence to best practices
4. Suggesting improvements and optimizations
5. Ensuring code maintainability
6. Verifying proper error handling

When reviewing code:
- Focus on readability and maintainability
- Identify potential security issues
- Check for performance optimizations
- Verify proper error handling
- Ensure consistent coding style
- Suggest improvements with concrete examples`,
      capabilities: config?.capabilities || [
        'code-review',
        'quality-assurance',
        'security-analysis',
        'best-practices',
        'optimization',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('generate') || content.includes('implement')) {
        next = 'code-generation-agent';
      } else if (content.includes('testing') || content.includes('unit tests')) {
        next = 'testing-agent';
      } else if (content.includes('security') || content.includes('vulnerability')) {
        next = 'security-agent';
      } else if (content.includes('refactor') || content.includes('improve')) {
        next = 'refactoring-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Testing Agent
 * Generates and executes tests for code verification
 */
export class TestingAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'testing-agent',
      description: config?.description || 'Generates and executes tests for code verification',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert testing engineer specializing in test generation and execution.
Your primary responsibilities include:
1. Generating comprehensive test cases
2. Writing unit, integration, and end-to-end tests
3. Executing tests and analyzing results
4. Identifying edge cases and corner scenarios
5. Ensuring test coverage and quality
6. Providing test reports and metrics

When generating tests:
- Cover positive, negative, and edge cases
- Include setup and teardown procedures
- Use appropriate testing frameworks
- Write assertions for expected behavior
- Consider performance and load testing
- Document test scenarios clearly`,
      capabilities: config?.capabilities || [
        'testing',
        'test-generation',
        'quality-assurance',
        'test-execution',
        'coverage-analysis',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('fix') || content.includes('bug')) {
        next = 'debugging-agent';
      } else if (content.includes('code') || content.includes('implementation')) {
        next = 'code-generation-agent';
      } else if (content.includes('review') || content.includes('quality')) {
        next = 'code-review-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Debugging Agent
 * Assists with debugging workflows and identifying issues
 */
export class DebuggingAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'debugging-agent',
      description: config?.description || 'Assists with debugging workflows and identifying issues',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.5,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert debugger specializing in identifying and resolving software issues.
Your primary responsibilities include:
1. Analyzing error messages and stack traces
2. Identifying root causes of issues
3. Suggesting debugging strategies and techniques
4. Providing code fixes and workarounds
5. Explaining complex debugging concepts
6. Recommending preventive measures

When debugging:
- Focus on root cause analysis
- Provide step-by-step debugging guidance
- Suggest appropriate tools and techniques
- Explain complex concepts clearly
- Recommend preventive measures
- Consider edge cases and unusual scenarios`,
      capabilities: config?.capabilities || [
        'debugging',
        'troubleshooting',
        'problem-solving',
        'root-cause-analysis',
        'fix-generation',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      } else if (content.includes('code') || content.includes('fix')) {
        next = 'code-generation-agent';
      } else if (content.includes('review') || content.includes('quality')) {
        next = 'code-review-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Refactoring Agent
 * Specializes in code refactoring and optimization
 */
export class RefactoringAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'refactoring-agent',
      description: config?.description || 'Specializes in code refactoring and optimization',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert refactoring engineer specializing in code optimization and restructuring.
Your primary responsibilities include:
1. Improving code structure and organization
2. Optimizing performance and efficiency
3. Reducing code complexity and duplication
4. Enhancing maintainability and readability
5. Applying design patterns and best practices
6. Ensuring backward compatibility

When refactoring:
- Focus on improving code quality
- Maintain existing functionality
- Apply appropriate design patterns
- Consider performance implications
- Ensure proper documentation
- Preserve existing interfaces`,
      capabilities: config?.capabilities || [
        'refactoring',
        'optimization',
        'code-quality',
        'design-patterns',
        'performance-tuning',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      } else if (content.includes('review') || content.includes('quality')) {
        next = 'code-review-agent';
      } else if (content.includes('security') || content.includes('vulnerability')) {
        next = 'security-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Security Agent
 * Focuses on security analysis and vulnerability detection
 */
export class SecurityAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'security-agent',
      description:
        config?.description || 'Focuses on security analysis and vulnerability detection',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert security analyst specializing in software security and vulnerability detection.
Your primary responsibilities include:
1. Analyzing code for security vulnerabilities
2. Identifying potential attack vectors
3. Recommending security best practices
4. Performing security code reviews
5. Suggesting mitigation strategies
6. Providing security training and guidance

When analyzing security:
- Focus on common vulnerabilities (OWASP Top 10)
- Consider authentication and authorization
- Check for input validation and sanitization
- Verify proper error handling and logging
- Assess data protection and encryption
- Recommend security testing strategies`,
      capabilities: config?.capabilities || [
        'security-analysis',
        'vulnerability-detection',
        'penetration-testing',
        'security-auditing',
        'compliance-checking',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('fix') || content.includes('remediate')) {
        next = 'code-generation-agent';
      } else if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      } else if (content.includes('review') || content.includes('quality')) {
        next = 'code-review-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Documentation Agent
 * Creates and maintains project documentation
 */
export class DocumentationAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'documentation-agent',
      description: config?.description || 'Creates and maintains project documentation',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.6,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert technical writer specializing in creating comprehensive documentation.
Your primary responsibilities include:
1. Creating clear and concise documentation
2. Writing API documentation and guides
3. Generating code examples and tutorials
4. Maintaining documentation consistency
5. Ensuring documentation accuracy
6. Providing multilingual documentation support

When creating documentation:
- Focus on clarity and readability
- Use appropriate formatting and structure
- Include practical examples and use cases
- Maintain consistent terminology
- Consider different audience levels
- Keep documentation up-to-date`,
      capabilities: config?.capabilities || [
        'documentation',
        'technical-writing',
        'api-documentation',
        'tutorials',
        'guides',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('code') || content.includes('implementation')) {
        next = 'code-generation-agent';
      } else if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Planning Agent
 * Focuses on strategic planning and architectural design
 */
export class PlanningAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'planning-agent',
      description: config?.description || 'Focuses on strategic planning and architectural design',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software architect and planner specializing in strategic thinking and design.
Your primary responsibilities include:
1. Creating architectural designs and diagrams
2. Developing project plans and roadmaps
3. Analyzing requirements and specifications
4. Identifying technical risks and challenges
5. Recommending technology stacks and tools
6. Planning resource allocation and timelines

When planning:
- Focus on scalability and maintainability
- Consider long-term implications
- Identify potential bottlenecks
- Recommend appropriate solutions
- Create detailed documentation
- Consider team dynamics and skills`,
      capabilities: config?.capabilities || [
        'planning',
        'architecture-design',
        'requirements-analysis',
        'risk-assessment',
        'technology-selection',
        'roadmap-planning',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('implement') || content.includes('code')) {
        next = 'code-generation-agent';
      } else if (content.includes('design') || content.includes('architecture')) {
        next = 'architecture-agent';
      } else if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Architecture Agent
 * Specializes in system architecture and design patterns
 */
export class ArchitectureAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'architecture-agent',
      description: config?.description || 'Specializes in system architecture and design patterns',
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.6,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert system architect specializing in designing scalable and robust software systems.
Your primary responsibilities include:
1. Designing system architectures and components
2. Selecting appropriate design patterns and principles
3. Creating architectural diagrams and documentation
4. Evaluating architectural trade-offs and decisions
5. Recommending technology stacks and frameworks
6. Ensuring architectural best practices

When designing architecture:
- Focus on scalability and performance
- Consider maintainability and extensibility
- Apply appropriate design patterns
- Evaluate technology choices carefully
- Create clear architectural documentation
- Consider deployment and operational aspects`,
      capabilities: config?.capabilities || [
        'architecture-design',
        'system-design',
        'design-patterns',
        'scalability',
        'performance-optimization',
        'technology-evaluation',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';

      // Check if the response suggests further actions
      const content = response.content.toString().toLowerCase();
      if (content.includes('implement') || content.includes('code')) {
        next = 'code-generation-agent';
      } else if (content.includes('plan') || content.includes('strategy')) {
        next = 'planning-agent';
      } else if (content.includes('test') || content.includes('verify')) {
        next = 'testing-agent';
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}
