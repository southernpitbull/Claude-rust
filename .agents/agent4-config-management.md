# Agent 4: Configuration Management Implementation

## Mission
Complete the configuration management system in P:\AIrchitect\src\config\ directory.

## Context
- Project: AIrchitect CLI
- Current state: Basic config exists
- Dependencies: Available (lodash for merging)
- TypeScript strict mode enabled
- Must provide comprehensive config management for entire application

## Existing Files (verify and enhance)
- P:\AIrchitect\src\config\config.ts (10,935 bytes)
- P:\AIrchitect\src\config\ConfigManager.ts (7,173 bytes)

## NEW Files to Create

### 1. ConfigLoader.ts
**Purpose**: Load configuration from multiple sources
**Requirements**:
- Load from files (JSON, YAML, TOML)
- Load from environment variables
- Load from CLI arguments
- Load from remote sources
- Priority-based loading
- Watch for changes
- Hot reload support
- Async loading
- Error handling
- Validation on load

**Sources (priority order)**:
1. CLI arguments (highest)
2. Environment variables
3. User config (~/.airchitect/config)
4. Project config (./.airchitect/config)
5. System config (/etc/airchitect/config)
6. Defaults (lowest)

**Interface**:
```typescript
interface IConfigLoader {
  load(sources: ConfigSource[]): Promise<RawConfig>;
  watch(callback: (config: RawConfig) => void): void;
  unwatch(): void;
  reload(): Promise<RawConfig>;
}
```

### 2. ConfigValidator.ts
**Purpose**: Validate configuration against schemas
**Requirements**:
- JSON Schema validation
- Type validation
- Range validation
- Format validation
- Custom validators
- Detailed error messages
- Validation rules
- Async validation
- Schema composition
- Strict/loose modes

**Features**:
- Required field validation
- Type checking
- Pattern matching
- Custom validation functions
- Cross-field validation
- Conditional validation
- Default value injection

**Interface**:
```typescript
interface IConfigValidator {
  validate(config: unknown, schema: ConfigSchema): ValidationResult;
  addRule(name: string, validator: ValidatorFn): void;
  getErrors(): ValidationError[];
}
```

### 3. ConfigDefaults.ts
**Purpose**: Default configuration values
**Requirements**:
- Comprehensive defaults
- Environment-specific defaults
- Provider defaults
- Agent defaults
- TUI defaults
- Logging defaults
- Security defaults
- Performance defaults
- Type-safe defaults

**Structure**:
```typescript
export const DEFAULT_CONFIG: DeepReadonly<Config> = {
  version: '1.0.0',
  env: 'development',
  providers: {
    openai: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4096
    },
    // ... other providers
  },
  agents: {
    maxConcurrent: 5,
    timeout: 300000,
    retries: 3
  },
  cli: {
    interactive: true,
    color: true,
    unicode: true
  },
  logging: {
    level: 'info',
    file: true,
    console: true
  },
  security: {
    encryption: true,
    keyring: true
  }
};
```

### 4. ConfigMerger.ts
**Purpose**: Intelligently merge configurations
**Requirements**:
- Deep merge support
- Array merge strategies
- Object merge strategies
- Type preservation
- Conflict resolution
- Merge policies
- Immutable operations
- Performance optimization

**Merge Strategies**:
- Replace (default)
- Append (arrays)
- Prepend (arrays)
- Union (arrays)
- Deep merge (objects)
- Custom merge functions

**Interface**:
```typescript
interface IConfigMerger {
  merge(...configs: PartialConfig[]): Config;
  mergeWith(strategy: MergeStrategy, ...configs: PartialConfig[]): Config;
  setStrategy(path: string, strategy: MergeStrategy): void;
}
```

### 5. ConfigSchema.ts
**Purpose**: Configuration schema definitions
**Requirements**:
- JSON Schema format
- Type definitions
- Validation rules
- Documentation
- Examples
- Default values
- Required fields
- Optional fields
- Nested schemas

**Schema Structure**:
```typescript
export const CONFIG_SCHEMA: ConfigSchema = {
  type: 'object',
  properties: {
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    env: { type: 'string', enum: ['development', 'staging', 'production'] },
    providers: { $ref: '#/definitions/providers' },
    agents: { $ref: '#/definitions/agents' },
    cli: { $ref: '#/definitions/cli' },
    logging: { $ref: '#/definitions/logging' },
    security: { $ref: '#/definitions/security' }
  },
  required: ['version', 'env'],
  definitions: {
    // ... nested schemas
  }
};
```

### 6. ConfigWatcher.ts
**Purpose**: Watch for configuration changes
**Requirements**:
- File system watching
- Change detection
- Debouncing
- Change events
- Validation on change
- Hot reload trigger
- Error handling
- Multi-file watching
- Cross-platform support

**Features**:
- Watch config files
- Watch environment changes
- Notify on changes
- Automatic reload
- Change validation
- Rollback on error

### 7. ConfigEncryption.ts
**Purpose**: Encrypt sensitive configuration values
**Requirements**:
- AES-256 encryption
- Secure key management
- Selective encryption (secrets only)
- Decryption on load
- Key rotation support
- Environment-based keys
- Keyring integration
- Encryption markers

**Features**:
- Encrypt API keys
- Encrypt passwords
- Encrypt tokens
- Transparent decryption
- Key derivation
- Salt generation

### 8. ConfigMigration.ts
**Purpose**: Migrate configurations between versions
**Requirements**:
- Version detection
- Migration scripts
- Backward compatibility
- Forward compatibility
- Validation after migration
- Backup before migration
- Rollback support
- Migration logging

**Migration Flow**:
1. Detect config version
2. Find migration path
3. Backup current config
4. Apply migrations
5. Validate new config
6. Update version
7. Log migration

### 9. ConfigExport.ts
**Purpose**: Export configuration
**Requirements**:
- Export to JSON
- Export to YAML
- Export to TOML
- Export to env file
- Selective export
- Redact secrets
- Include/exclude patterns
- Pretty printing
- Comments preservation

### 10. index.ts (Enhanced)
**Purpose**: Main export and configuration factory
**Requirements**:
- Export all config components
- Factory methods
- Default config instance
- Easy integration
- Type exports

## Enhanced ConfigManager.ts

### Additional Methods Needed
```typescript
class ConfigManager {
  // Existing methods
  load(): Promise<void>;
  get<T>(path: string): T;
  set<T>(path: string, value: T): void;

  // New methods to add
  validate(): ValidationResult;
  watch(callback: ConfigChangeCallback): void;
  reload(): Promise<void>;
  reset(): void;
  merge(config: PartialConfig): void;
  export(format: ExportFormat): string;
  encrypt(path: string): void;
  decrypt(path: string): void;
  getAll(): DeepReadonly<Config>;
  has(path: string): boolean;
  delete(path: string): void;
}
```

## Configuration Structure

```typescript
interface Config {
  // Core
  version: string;
  env: Environment;

  // Providers
  providers: {
    [key: string]: ProviderConfig;
  };

  // Agents
  agents: {
    maxConcurrent: number;
    timeout: number;
    retries: number;
    memory: AgentMemoryConfig;
  };

  // CLI
  cli: {
    interactive: boolean;
    color: boolean;
    unicode: boolean;
    theme: string;
  };

  // Logging
  logging: {
    level: LogLevel;
    file: boolean;
    console: boolean;
    format: string;
    rotation: RotationConfig;
  };

  // Security
  security: {
    encryption: boolean;
    keyring: boolean;
    apiKeys: Record<string, string>;
  };

  // TUI
  tui: {
    enabled: boolean;
    theme: string;
    layout: LayoutConfig;
  };

  // Memory
  memory: {
    provider: string;
    vectorStore: VectorStoreConfig;
    maxSize: number;
  };

  // Paths
  paths: {
    config: string;
    data: string;
    cache: string;
    logs: string;
    plugins: string;
  };
}
```

## Technical Requirements

### TypeScript Standards
- Strict mode enabled
- Comprehensive JSDoc
- Type-safe config access
- Generic types
- Readonly types
- Deep partial types
- Type guards

### Performance
- Fast config access (<1ms)
- Lazy loading
- Config caching
- Efficient merging
- Minimal memory usage

### Security
- Encrypt sensitive values
- No secrets in plain text
- Secure key storage
- Access control
- Audit logging

### Reliability
- Validate all configs
- Graceful degradation
- Fallback to defaults
- Error recovery
- Atomic updates

### Testing Requirements
- Unit tests for all components
- Integration tests
- Migration tests
- Validation tests
- Performance tests
- 85%+ code coverage

## Integration Points
- CLI framework config
- Provider configs
- Agent configs
- Logging config
- Security config
- TUI config
- Memory config

## Configuration Files

### User Config (~/.airchitect/config.json)
```json
{
  "version": "1.0.0",
  "env": "production",
  "providers": {
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4"
    }
  }
}
```

### Project Config (./.airchitect/config.json)
```json
{
  "agents": {
    "maxConcurrent": 3
  },
  "logging": {
    "level": "debug"
  }
}
```

## Environment Variables

```bash
# Provider API Keys
AIRCHITECT_OPENAI_API_KEY=sk-...
AIRCHITECT_ANTHROPIC_API_KEY=sk-ant-...

# Config Override
AIRCHITECT_ENV=production
AIRCHITECT_LOG_LEVEL=debug
AIRCHITECT_CONFIG_PATH=/custom/path

# Feature Flags
AIRCHITECT_TUI_ENABLED=true
AIRCHITECT_ENCRYPTION_ENABLED=true
```

## Deliverables
1. ConfigLoader.ts (complete)
2. ConfigValidator.ts (complete)
3. ConfigDefaults.ts (complete)
4. ConfigMerger.ts (complete)
5. ConfigSchema.ts (complete)
6. ConfigWatcher.ts (complete)
7. ConfigEncryption.ts (complete)
8. ConfigMigration.ts (complete)
9. ConfigExport.ts (complete)
10. Enhanced ConfigManager.ts
11. Enhanced index.ts
12. Comprehensive unit tests
13. Integration tests
14. Migration tests
15. Documentation with examples

## Success Criteria
- All files compile without errors
- All tests pass with 85%+ coverage
- Zero ESLint errors
- Comprehensive documentation
- Config loading works from all sources
- Validation catches all errors
- Merging works correctly
- Encryption works securely
- Migration tested

## Commands to Run
```bash
cd P:/AIrchitect
npm run lint
npm run format
npm run test
npm run build
```

## Notes
- Use absolute paths
- Follow existing code style
- Preserve existing functionality
- Add comprehensive examples
- Document all config options
- Secure by default
- Type-safe access
- Performance optimized
