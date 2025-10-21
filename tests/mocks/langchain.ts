/**
 * Mock implementations for LangChain components
 */

import { jest } from '@jest/globals';

/**
 * Mock BaseMessage for testing
 */
export class MockBaseMessage {
  constructor(
    public content: string,
    public role: 'user' | 'assistant' | 'system' = 'user'
  ) {}

  toJSON() {
    return {
      content: this.content,
      role: this.role,
    };
  }
}

/**
 * Mock HumanMessage
 */
export class MockHumanMessage extends MockBaseMessage {
  constructor(content: string) {
    super(content, 'user');
  }
}

/**
 * Mock AIMessage
 */
export class MockAIMessage extends MockBaseMessage {
  constructor(content: string) {
    super(content, 'assistant');
  }
}

/**
 * Mock SystemMessage
 */
export class MockSystemMessage extends MockBaseMessage {
  constructor(content: string) {
    super(content, 'system');
  }
}

/**
 * Mock ChatModel
 */
export class MockChatModel {
  public modelName: string;
  public temperature: number;
  public maxTokens?: number;

  constructor(config: any = {}) {
    this.modelName = config.modelName || 'mock-model';
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens;
  }

  async invoke(messages: any[], options?: any): Promise<any> {
    return {
      content: 'Mock chat model response',
      role: 'assistant',
      additional_kwargs: {},
    };
  }

  async stream(messages: any[], options?: any): Promise<any> {
    return {
      async *[Symbol.asyncIterator]() {
        yield { content: 'Mock ', role: 'assistant' };
        yield { content: 'streaming ', role: 'assistant' };
        yield { content: 'response', role: 'assistant' };
      },
    };
  }

  async batch(messagesList: any[][], options?: any): Promise<any[]> {
    return messagesList.map(() => ({
      content: 'Mock batch response',
      role: 'assistant',
    }));
  }
}

/**
 * Mock LangGraph StateGraph
 */
export class MockStateGraph {
  private nodes: Map<string, any> = new Map();
  private edges: Array<{ from: string; to: string }> = [];

  addNode(name: string, fn: any): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.push({ from, to });
    return this;
  }

  setEntryPoint(node: string): this {
    return this;
  }

  setFinishPoint(node: string): this {
    return this;
  }

  compile(): MockCompiledGraph {
    return new MockCompiledGraph(this.nodes, this.edges);
  }
}

/**
 * Mock Compiled Graph
 */
export class MockCompiledGraph {
  constructor(
    private nodes: Map<string, any>,
    private edges: Array<{ from: string; to: string }>
  ) {}

  async invoke(input: any, config?: any): Promise<any> {
    return {
      output: 'Mock graph output',
      state: input,
    };
  }

  async stream(input: any, config?: any): AsyncGenerator<any> {
    async function* generator() {
      yield { step: 'node1', output: 'Mock step 1' };
      yield { step: 'node2', output: 'Mock step 2' };
      yield { step: 'final', output: 'Mock final output' };
    }
    return generator();
  }
}

/**
 * Mock Vector Store
 */
export class MockVectorStore {
  private documents: any[] = [];

  async addDocuments(docs: any[]): Promise<void> {
    this.documents.push(...docs);
  }

  async similaritySearch(query: string, k: number = 4): Promise<any[]> {
    return this.documents.slice(0, k);
  }

  async similaritySearchWithScore(query: string, k: number = 4): Promise<Array<[any, number]>> {
    return this.documents.slice(0, k).map((doc, i) => [doc, 1 - i * 0.1]);
  }

  async delete(ids: string[]): Promise<void> {
    this.documents = this.documents.filter((doc) => !ids.includes(doc.id));
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}

/**
 * Mock Embeddings
 */
export class MockEmbeddings {
  async embedQuery(text: string): Promise<number[]> {
    return new Array(1536).fill(0).map(() => Math.random());
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(() => new Array(1536).fill(0).map(() => Math.random()));
  }
}

/**
 * Mock Tool
 */
export class MockTool {
  constructor(
    public name: string,
    public description: string,
    public func: (...args: any[]) => any
  ) {}

  async call(input: any): Promise<any> {
    return this.func(input);
  }
}

/**
 * Mock Agent Executor
 */
export class MockAgentExecutor {
  constructor(
    public agent: any,
    public tools: any[]
  ) {}

  async invoke(input: any, config?: any): Promise<any> {
    return {
      output: 'Mock agent executor output',
      intermediateSteps: [],
    };
  }

  async run(input: string): Promise<string> {
    return 'Mock agent executor run output';
  }
}

/**
 * Helper to create mock messages
 */
export const createMockMessages = (count: number = 3): MockBaseMessage[] => {
  return Array.from({ length: count }, (_, i) => {
    if (i % 2 === 0) {
      return new MockHumanMessage(`User message ${i + 1}`);
    } else {
      return new MockAIMessage(`Assistant message ${i + 1}`);
    }
  });
};

/**
 * Mock LangChain callbacks
 */
export const mockCallbacks = {
  handleLLMStart: jest.fn(),
  handleLLMEnd: jest.fn(),
  handleLLMError: jest.fn(),
  handleChainStart: jest.fn(),
  handleChainEnd: jest.fn(),
  handleChainError: jest.fn(),
  handleToolStart: jest.fn(),
  handleToolEnd: jest.fn(),
  handleToolError: jest.fn(),
};
