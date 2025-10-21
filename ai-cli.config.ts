/**
 * AIrchitect CLI Configuration
 * 
 * This file defines the overall configuration for the multi-language
 * AIrchitect CLI system, specifying how the Rust, TypeScript, and Python
 * components interact.
 */

export interface AICliConfig {
  // Core system configuration
  core: {
    // Rust core settings
    rust: {
      // Path to Rust binaries
      binPath: string;
      
      // Logging configuration
      logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
      
      // Performance settings
      threads: number;
      memoryLimit: string; // e.g., "4GB"
    };
    
    // TypeScript frontend settings
    typescript: {
      // Path to TypeScript bundles
      bundlePath: string;
      
      // TUI configuration
      tui: {
        theme: 'default' | 'dark' | 'light' | 'high-contrast';
        animations: boolean;
        syntaxHighlighting: boolean;
      };
    };
    
    // Python plugin settings
    python: {
      // Path to Python plugins
      pluginPath: string;
      
      // Virtual environment
      venvPath: string;
      
      // Plugin security
      sandboxPlugins: boolean;
      maxPluginMemory: string; // e.g., "1GB"
    };
  };
  
  // AI provider configuration
  providers: AICliProvidersConfig;
  
  // Security configuration
  security: {
    // Credential storage
    credentials: {
      encrypt: boolean;
      keychain: boolean;
    };
    
    // Network security
    network: {
      tls: boolean;
      proxy?: string;
    };
    
    // Plugin security
    plugins: {
      allowUnsigned: boolean;
      requireSignature: boolean;
    };
  };
  
  // Performance configuration
  performance: {
    // Caching
    cache: {
      enabled: boolean;
      maxSize: string; // e.g., "100MB"
      ttl: number; // Time to live in seconds
    };
    
    // Concurrency
    concurrency: {
      maxThreads: number;
      maxConcurrentRequests: number;
    };
  };
  
  // Paths configuration
  paths: {
    // Configuration directory
    config: string;
    
    // Cache directory
    cache: string;
    
    // Log directory
    logs: string;
    
    // Data directory
    data: string;
    
    // Temporary directory
    temp: string;
  };
}

// Define the providers configuration separately to handle the index signature issue
export interface AICliProvidersConfig {
  // Default provider
  default: string;
  
  // Provider-specific settings
  [provider: string]: {
    enabled: boolean;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    rateLimit?: {
      requestsPerMinute: number;
      tokensPerMinute: number;
    };
  } | string;
}

// Default configuration
export const defaultConfig: AICliConfig = {
  core: {
    rust: {
      binPath: './target/release',
      logLevel: 'info',
      threads: 4,
      memoryLimit: '4GB'
    },
    typescript: {
      bundlePath: './dist',
      tui: {
        theme: 'default',
        animations: true,
        syntaxHighlighting: true
      }
    },
    python: {
      pluginPath: './plugins',
      venvPath: './venv',
      sandboxPlugins: true,
      maxPluginMemory: '1GB'
    }
  },
  providers: {
    default: 'openai',
    openai: {
      enabled: true,
      model: 'gpt-4',
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 40000
      }
    },
    anthropic: {
      enabled: true,
      model: 'claude-3-opus',
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 30000
      }
    },
    google: {
      enabled: true,
      model: 'gemini-pro',
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 32000
      }
    }
  },
  security: {
    credentials: {
      encrypt: true,
      keychain: true
    },
    network: {
      tls: true
    },
    plugins: {
      allowUnsigned: false,
      requireSignature: true
    }
  },
  performance: {
    cache: {
      enabled: true,
      maxSize: '100MB',
      ttl: 3600 // 1 hour
    },
    concurrency: {
      maxThreads: 8,
      maxConcurrentRequests: 10
    }
  },
  paths: {
    config: './.config',
    cache: './.cache',
    logs: './.logs',
    data: './.data',
    temp: './.tmp'
  }
};

// Export the configuration as default
export default defaultConfig;