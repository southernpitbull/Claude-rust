/**
 * Bridge between TypeScript frontend and Rust backend
 * 
 * This module provides the communication bridge between the
 * TypeScript frontend components and the Rust core components.
 */

// Import Node.js modules
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// Import our own modules
import { AITerminalUI } from '../../src/tui';

/**
 * Bridge configuration
 */
interface BridgeConfig {
  /** Path to the Rust binary */
  rustBinaryPath: string;
  
  /** Arguments to pass to the Rust binary */
  rustArgs: string[];
  
  /** Timeout for Rust operations (in milliseconds) */
  timeout: number;
  
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default bridge configuration
 */
const DEFAULT_CONFIG: BridgeConfig = {
  rustBinaryPath: './target/debug/ai-cli-core',
  rustArgs: [],
  timeout: 30000,
  debug: false
};

/**
 * Bridge between TypeScript and Rust components
 */
export class RustBridge extends EventEmitter {
  private config: BridgeConfig;
  private rustProcess: ChildProcess | null = null;
  private isReady: boolean = false;
  private pendingRequests: Map<number, { resolve: Function, reject: Function, timeout: NodeJS.Timeout }> = new Map();
  private requestId: number = 0;

  constructor(config?: Partial<BridgeConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the bridge
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if the Rust binary exists
      if (!fs.existsSync(this.config.rustBinaryPath)) {
        reject(new Error(`Rust binary not found at ${this.config.rustBinaryPath}`));
        return;
      }

      // Spawn the Rust process
      this.rustProcess = spawn(this.config.rustBinaryPath, this.config.rustArgs, {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      // Handle process events
      this.rustProcess.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.rustProcess.on('close', (code) => {
        this.isReady = false;
        this.emit('close', code);
      });

      // Handle stdout
      this.rustProcess.stdout?.on('data', (data) => {
        this.handleStdoutData(data.toString());
      });

      // Handle stderr
      this.rustProcess.stderr?.on('data', (data) => {
        this.handleStderrData(data.toString());
      });

      // Wait for the ready signal
      const readyTimeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Rust process to initialize'));
      }, this.config.timeout);

      const readyHandler = () => {
        clearTimeout(readyTimeout);
        this.isReady = true;
        this.emit('ready');
        resolve();
      };

      this.once('ready', readyHandler);

      // Send a ping to check if the process is ready
      this.sendRequest({ type: 'ping' })
        .then(() => {
          if (!this.isReady) {
            this.emit('ready');
          }
        })
        .catch((error) => {
          clearTimeout(readyTimeout);
          reject(error);
        });
    });
  }

  /**
   * Handle stdout data from the Rust process
   */
  private handleStdoutData(data: string): void {
    if (this.config.debug) {
      console.log('[RustBridge] STDOUT:', data);
    }

    // Try to parse as JSON
    try {
      const message = JSON.parse(data);
      this.handleMessage(message);
    } catch (error) {
      // If it's not JSON, treat it as a log message
      this.emit('log', { level: 'info', message: data.trim() });
    }
  }

  /**
   * Handle stderr data from the Rust process
   */
  private handleStderrData(data: string): void {
    if (this.config.debug) {
      console.log('[RustBridge] STDERR:', data);
    }

    // Treat as error log
    this.emit('log', { level: 'error', message: data.trim() });
  }

  /**
   * Handle messages from the Rust process
   */
  private handleMessage(message: any): void {
    if (this.config.debug) {
      console.log('[RustBridge] Message:', message);
    }

    // Handle different message types
    switch (message.type) {
      case 'ready':
        this.emit('ready');
        break;
        
      case 'response':
        this.handleResponse(message);
        break;
        
      case 'event':
        this.handleEvent(message);
        break;
        
      case 'log':
        this.emit('log', message.data);
        break;
        
      case 'pong':
        // Pong response, ignore
        break;
        
      default:
        console.warn('[RustBridge] Unknown message type:', message.type);
        break;
    }
  }

  /**
   * Handle response messages
   */
  private handleResponse(message: any): void {
    const { id, data, error } = message;
    
    const request = this.pendingRequests.get(id);
    if (request) {
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);
      
      if (error) {
        request.reject(new Error(error));
      } else {
        request.resolve(data);
      }
    }
  }

  /**
   * Handle event messages
   */
  private handleEvent(message: any): void {
    const { event, data } = message;
    this.emit(event, data);
  }

  /**
   * Send a request to the Rust process
   */
  private sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isReady || !this.rustProcess) {
        reject(new Error('Rust bridge not ready'));
        return;
      }

      const id = ++this.requestId;
      const message = { id, ...request };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout (${this.config.timeout}ms)`));
      }, this.config.timeout);

      // Store request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send message
      if (this.config.debug) {
        console.log('[RustBridge] Sending:', message);
      }

      this.rustProcess!.stdin!.write(JSON.stringify(message) + '\n');
    });
  }

  /**
   * Execute a CLI command
   */
  async executeCommand(command: string, args: string[] = []): Promise<any> {
    return this.sendRequest({
      type: 'execute_command',
      command,
      args
    });
  }

  /**
   * Get provider information
   */
  async getProviders(): Promise<any> {
    return this.sendRequest({
      type: 'get_providers'
    });
  }

  /**
   * Get project memory
   */
  async getProjectMemory(query?: string): Promise<any> {
    return this.sendRequest({
      type: 'get_project_memory',
      query
    });
  }

  /**
   * Store information in project memory
   */
  async storeInMemory(key: string, value: any): Promise<boolean> {
    return this.sendRequest({
      type: 'store_in_memory',
      key,
      value
    });
  }

  /**
   * Execute an agent task
   */
  async executeAgentTask(agentName: string, task: string): Promise<any> {
    return this.sendRequest({
      type: 'execute_agent_task',
      agent: agentName,
      task
    });
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(name: string, description?: string): Promise<any> {
    return this.sendRequest({
      type: 'create_checkpoint',
      name,
      description
    });
  }

  /**
   * List checkpoints
   */
  async listCheckpoints(): Promise<any> {
    return this.sendRequest({
      type: 'list_checkpoints'
    });
  }

  /**
   * Restore a checkpoint
   */
  async restoreCheckpoint(name: string): Promise<any> {
    return this.sendRequest({
      type: 'restore_checkpoint',
      name
    });
  }

  /**
   * Close the bridge
   */
  close(): void {
    if (this.rustProcess) {
      this.rustProcess.kill();
      this.rustProcess = null;
    }
    
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Bridge closed'));
    }
    
    this.pendingRequests.clear();
    this.isReady = false;
  }

  /**
   * Check if the bridge is ready
   */
  isBridgeReady(): boolean {
    return this.isReady;
  }
}

/**
 * Main AIrchitect application class
 */
export class AIrchitectApp {
  private bridge: RustBridge;
  private ui: AITerminalUI;
  private isInitialized: boolean = false;

  constructor() {
    this.bridge = new RustBridge();
    this.ui = new AITerminalUI();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize the bridge
      await this.bridge.initialize();
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Show welcome message
      this.ui.showWelcome();
      this.ui.render();
      
      this.isInitialized = true;
      console.log('AIrchitect application initialized');
    } catch (error) {
      console.error('Failed to initialize AIrchitect application:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Handle bridge events
    this.bridge.on('log', (data: { level: string, message: string }) => {
      const { level, message } = data;
      switch (level) {
        case 'info':
          this.ui.addOutput(`[INFO] ${message}`);
          break;
        case 'warn':
          this.ui.addOutput(`[WARN] ${message}`);
          break;
        case 'error':
          this.ui.addOutput(`[ERROR] ${message}`);
          break;
        default:
          this.ui.addOutput(`[${level.toUpperCase()}] ${message}`);
          break;
      }
      this.ui.render();
    });

    this.bridge.on('close', (code: number) => {
      this.ui.addOutput(`[SYSTEM] Rust backend closed with code ${code}`);
      this.ui.render();
    });

    this.bridge.on('error', (error: Error) => {
      this.ui.addOutput(`[ERROR] Bridge error: ${error.message}`);
      this.ui.render();
    });

    // Handle UI commands
    // In a real implementation, we would connect the UI input to the bridge
  }

  /**
   * Run the application
   */
  async run(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // In a real implementation, this would start the main application loop
    console.log('AIrchitect application running. Press Ctrl+C to exit.');
    
    // Keep the process alive
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        console.log('\nShutting down AIrchitect application...');
        this.shutdown();
        resolve();
      });
    });
  }

  /**
   * Shutdown the application
   */
  private shutdown(): void {
    this.bridge.close();
    console.log('AIrchitect application shut down');
  }

  /**
   * Get the Rust bridge
   */
  getBridge(): RustBridge {
    return this.bridge;
  }

  /**
   * Get the UI
   */
  getUI(): AITerminalUI {
    return this.ui;
  }
}

// Default export
export default { RustBridge, AIrchitectApp };