import { ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI, AzureOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import {
  PromptTemplate,
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { CredentialSystem } from '../credentials';

/**
 * Interface for LangChain model configuration
 */
export interface LangChainModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseURL?: string;
}

/**
 * Interface for LangChain chain execution result
 */
export interface LangChainResult {
  output: string;
  metadata: {
    model: string;
    tokensUsed: {
      input: number;
      output: number;
    };
    executionTime: number;
  };
}

/**
 * LangChain integration for AIrchitect CLI
 */
export class LangChainIntegration {
  private credentialSystem: CredentialSystem;
  private models: Map<string, any>; // Store initialized models

  constructor(credentialSystem: CredentialSystem) {
    this.credentialSystem = credentialSystem;
    this.models = new Map();
  }

  /**
   * Initialize a model based on configuration
   */
  public async initializeModel(config: LangChainModelConfig): Promise<void> {
    let model: any;

    // Get API key from config or credential system
    const apiKey = config.apiKey || (await this.credentialSystem.getCredential(config.provider));

    switch (config.provider.toLowerCase()) {
      case 'openai':
        model = new ChatOpenAI({
          openAIApiKey: apiKey,
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
          configuration: {
            baseURL: config.baseURL,
          },
        });
        break;

      case 'anthropic':
        model = new ChatAnthropic({
          anthropicApiKey: apiKey,
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
          configuration: {
            baseURL: config.baseURL,
          },
        });
        break;

      case 'google':
      case 'gemini':
        model = new ChatGoogleGenerativeAI({
          apiKey: apiKey,
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens,
        });
        break;

      case 'ollama':
        model = new ChatOllama({
          baseUrl: config.baseURL || 'http://localhost:11434',
          model: config.model,
          temperature: config.temperature || 0.7,
          numCtx: config.maxTokens,
        });
        break;

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    // Store the model with a unique key
    const modelKey = `${config.provider}-${config.model}`;
    this.models.set(modelKey, model);
  }

  /**
   * Create a simple chain with a prompt template and model
   */
  public async createChain(
    promptTemplate: string,
    modelConfig: LangChainModelConfig,
    options: {
      systemMessage?: string;
      outputParser?: any;
    } = {}
  ): Promise<RunnableSequence> {
    // Initialize model if not already done
    const modelKey = `${modelConfig.provider}-${modelConfig.model}`;
    if (!this.models.has(modelKey)) {
      await this.initializeModel(modelConfig);
    }

    const model = this.models.get(modelKey);

    // Create the prompt template
    let prompt: ChatPromptTemplate;
    if (options.systemMessage) {
      prompt = ChatPromptTemplate.fromMessages([
        ['system', options.systemMessage],
        ['human', promptTemplate],
      ]);
    } else {
      prompt = ChatPromptTemplate.fromMessages([['human', promptTemplate]]);
    }

    // Create the chain
    const outputParser = options.outputParser || new StringOutputParser();

    const chain = RunnableSequence.from([prompt, model, outputParser]);

    return chain;
  }

  /**
   * Execute a prompt with the specified model
   */
  public async executePrompt(
    prompt: string,
    modelConfig: LangChainModelConfig
  ): Promise<LangChainResult> {
    const startTime = Date.now();

    try {
      // Initialize model if not already done
      const modelKey = `${modelConfig.provider}-${modelConfig.model}`;
      if (!this.models.has(modelKey)) {
        await this.initializeModel(modelConfig);
      }

      const model = this.models.get(modelKey);

      // Create a simple prompt chain
      const promptTemplate = ChatPromptTemplate.fromMessages([['human', prompt]]);

      const chain = RunnableSequence.from([promptTemplate, model, new StringOutputParser()]);

      const result = await chain.invoke({});

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      return {
        output: result,
        metadata: {
          model: modelConfig.model,
          tokensUsed: {
            input: prompt.length, // This is a simplification - real token counting would be better
            output: result.length,
          },
          executionTime,
        },
      };
    } catch (error) {
      throw new Error(`Failed to execute LangChain prompt: ${(error as Error).message}`);
    }
  }

  /**
   * Create a chain for code generation
   */
  public async createCodeGenerationChain(
    modelConfig: LangChainModelConfig
  ): Promise<RunnableSequence> {
    const promptTemplate = `
You are an expert software developer. Generate clean, efficient, and well-documented code based on the following requirements:

Requirements: {requirements}

Generate code in {language} for the following:
{taskDescription}

Make sure to:
- Include necessary imports/dependencies
- Add appropriate comments
- Follow best practices for the language
- Write efficient and clean code

Code:
`;

    return await this.createChain(promptTemplate, modelConfig, {
      systemMessage:
        'You are an expert software developer assistant. Generate high-quality, production-ready code.',
    });
  }

  /**
   * Create a chain for code explanation
   */
  public async createCodeExplanationChain(
    modelConfig: LangChainModelConfig
  ): Promise<RunnableSequence> {
    const promptTemplate = `
Explain the following code in detail:

Code:
\`\`\`
{code}
\`\`\`

Please provide:
1. A high-level overview
2. Explanation of key functions/components
3. Any patterns or techniques used
4. Potential improvements or considerations

Explanation:
`;

    return await this.createChain(promptTemplate, modelConfig, {
      systemMessage:
        'You are an expert software developer assistant. Explain code clearly and concisely.',
    });
  }

  /**
   * Create a chain for code review
   */
  public async createCodeReviewChain(modelConfig: LangChainModelConfig): Promise<RunnableSequence> {
    const promptTemplate = `
Review the following code and provide feedback:

Code:
\`\`\`
{code}
\`\`\`

Consider the following aspects:
- Code quality and readability
- Performance implications
- Security concerns
- Best practices
- Potential bugs
- Improvements

Code Review:
`;

    return await this.createChain(promptTemplate, modelConfig, {
      systemMessage:
        'You are an expert software developer performing a code review. Provide constructive feedback.',
    });
  }

  /**
   * Create a chain for documentation generation
   */
  public async createDocumentationChain(
    modelConfig: LangChainModelConfig
  ): Promise<RunnableSequence> {
    const promptTemplate = `
Create comprehensive documentation for the following:

Component/Feature: {component}

Details:
{details}

Generate:
1. Overview
2. Key features
3. How to use
4. Configuration options
5. Best practices
6. Examples

Documentation:
`;

    return await this.createChain(promptTemplate, modelConfig, {
      systemMessage:
        'You are an expert technical writer. Create comprehensive documentation that is clear and helpful.',
    });
  }

  /**
   * Execute a code generation task
   */
  public async generateCode(
    requirements: string,
    language: string,
    modelConfig: LangChainModelConfig
  ): Promise<LangChainResult> {
    const chain = await this.createCodeGenerationChain(modelConfig);

    const result = await chain.invoke({
      requirements,
      language,
      taskDescription: requirements,
    });

    return {
      output: result,
      metadata: {
        model: modelConfig.model,
        tokensUsed: {
          input: requirements.length,
          output: result.length,
        },
        executionTime: 0, // Execution time is not captured in this implementation
      },
    };
  }

  /**
   * Execute a code explanation task
   */
  public async explainCode(
    code: string,
    modelConfig: LangChainModelConfig
  ): Promise<LangChainResult> {
    const chain = await this.createCodeExplanationChain(modelConfig);

    const result = await chain.invoke({
      code,
    });

    return {
      output: result,
      metadata: {
        model: modelConfig.model,
        tokensUsed: {
          input: code.length,
          output: result.length,
        },
        executionTime: 0,
      },
    };
  }

  /**
   * Execute a code review task
   */
  public async reviewCode(
    code: string,
    modelConfig: LangChainModelConfig
  ): Promise<LangChainResult> {
    const chain = await this.createCodeReviewChain(modelConfig);

    const result = await chain.invoke({
      code,
    });

    return {
      output: result,
      metadata: {
        model: modelConfig.model,
        tokensUsed: {
          input: code.length,
          output: result.length,
        },
        executionTime: 0,
      },
    };
  }

  /**
   * Execute a documentation task
   */
  public async generateDocumentation(
    component: string,
    details: string,
    modelConfig: LangChainModelConfig
  ): Promise<LangChainResult> {
    const chain = await this.createDocumentationChain(modelConfig);

    const result = await chain.invoke({
      component,
      details,
    });

    return {
      output: result,
      metadata: {
        model: modelConfig.model,
        tokensUsed: {
          input: (component + details).length,
          output: result.length,
        },
        executionTime: 0,
      },
    };
  }

  /**
   * Get available models
   */
  public getAvailableModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Check if a model is initialized
   */
  public isModelInitialized(provider: string, model: string): boolean {
    const modelKey = `${provider}-${model}`;
    return this.models.has(modelKey);
  }
}
