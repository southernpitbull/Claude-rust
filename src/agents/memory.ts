import { BaseAgent, AgentConfig, AgentResult } from './agent';

/**
 * Agent memory to store and retrieve agent-specific information
 */
export class AgentMemory {
  private memory: Map<string, any>;
  private agentId: string;

  constructor(agentId: string) {
    this.memory = new Map();
    this.agentId = agentId;
  }

  /**
   * Store a value in agent memory
   */
  public set(key: string, value: any): void {
    this.memory.set(key, value);
  }

  /**
   * Get a value from agent memory
   */
  public get(key: string): any {
    return this.memory.get(key);
  }

  /**
   * Check if a key exists in memory
   */
  public has(key: string): boolean {
    return this.memory.has(key);
  }

  /**
   * Remove a key from memory
   */
  public delete(key: string): boolean {
    return this.memory.delete(key);
  }

  /**
   * Clear all memory
   */
  public clear(): void {
    this.memory.clear();
  }

  /**
   * Get all memory keys
   */
  public keys(): string[] {
    return Array.from(this.memory.keys());
  }

  /**
   * Store conversation history
   */
  public storeConversation(input: string, output: string, metadata?: Record<string, any>): void {
    const conversationId = Date.now().toString();
    this.set(`conversation_${conversationId}`, {
      input,
      output,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    });
  }

  /**
   * Get recent conversations
   */
  public getRecentConversations(limit: number = 5): Array<{
    input: string;
    output: string;
    timestamp: string;
    metadata: Record<string, any>;
  }> {
    const conversations: Array<{
      input: string;
      output: string;
      timestamp: string;
      metadata: Record<string, any>;
    }> = [];

    for (const [key, value] of this.memory.entries()) {
      if (key.startsWith('conversation_')) {
        conversations.push(value);
      }
    }

    // Sort by timestamp and return the most recent
    return conversations
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Store learned information
   */
  public storeLearning(key: string, learnedInfo: any): void {
    const learningKey = `learning_${key}`;
    const currentLearning = this.get(learningKey) || [];
    currentLearning.push({
      data: learnedInfo,
      timestamp: new Date().toISOString(),
      version: currentLearning.length + 1,
    });
    this.set(learningKey, currentLearning);
  }

  /**
   * Get learned information
   */
  public getLearning(key: string): any {
    const learningKey = `learning_${key}`;
    return this.get(learningKey);
  }
}
