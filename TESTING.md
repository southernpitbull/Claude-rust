# Testing Configuration Notes

## Overview

This document describes the testing infrastructure setup for the AIrchitect project.

## Files Created/Updated

### 1. `jest.config.js`

Main Jest configuration file with:
- TypeScript support via `ts-jest` preset
- Path alias mapping matching `tsconfig.json`
- Coverage collection and thresholds
- Test environment setup
- Module resolution configuration

**Key Features:**
- Isolated modules for faster compilation
- Coverage thresholds: 70% branches/functions, 80% lines/statements
- Automatic mock clearing between tests
- Support for both `.test.ts` and `.spec.ts` files

### 2. `tsconfig.test.json`

TypeScript configuration for tests:
- Extends base `tsconfig.json`
- CommonJS module system for Jest compatibility
- Includes Jest type definitions
- Path alias configuration
- Isolated modules enabled
- More permissive settings for test code

**Important Settings:**
```json
{
  "module": "CommonJS",  // Required for Jest
  "types": ["node", "jest"],  // Type definitions
  "isolatedModules": true  // Performance optimization
}
```

### 3. `tests/setup.ts`

Global test setup file that runs before all tests:
- Extended timeout (10s) for integration tests
- Test environment variables
- Global test utilities (wait, randomString, randomNumber)
- Console suppression (reduces test noise)
- Error handling for unhandled rejections

**Global Utilities:**
```typescript
global.testUtils.wait(ms)           // Wait for async operations
global.testUtils.randomString(len)  // Generate random strings
global.testUtils.randomNumber(min, max)  // Generate random numbers
```

### 4. `tests/mocks/providers.ts`

Mock implementations for AI providers:
- Mock base provider
- Mock implementations for all supported providers:
  - OpenAI
  - Anthropic (Claude)
  - Google (Gemini)
  - Ollama
  - Qwen
  - Cloudflare
  - LMStudio
  - VLLM
- Mock ProviderManager
- Helper functions for creating mock configs

**Usage Example:**
```typescript
import { mockProviderFactory } from './mocks/providers';

const provider = mockProviderFactory.openai();
const response = await provider.generateResponse(messages);
```

### 5. `tests/mocks/langchain.ts`

Mock implementations for LangChain components:
- Mock messages (BaseMessage, HumanMessage, AIMessage, SystemMessage)
- Mock ChatModel with invoke/stream/batch
- Mock StateGraph for LangGraph
- Mock VectorStore and Embeddings
- Mock Tools and AgentExecutor
- Helper functions for creating test data

**Usage Example:**
```typescript
import { MockChatModel, createMockMessages } from './mocks/langchain';

const model = new MockChatModel();
const messages = createMockMessages(3);
const response = await model.invoke(messages);
```

### 6. `tests/mocks/storage.ts`

Mock implementations for storage and persistence:
- MockFileSystem (in-memory file system)
- MockStorage (key-value store)
- MockDatabase (document store)
- MockCache (with TTL support)
- MockLogger (captures log messages)
- MockConfigManager

**Usage Example:**
```typescript
import { createMockStorage } from './mocks/storage';

const mocks = createMockStorage();
await mocks.storage.set('key', 'value');
await mocks.cache.set('key', 'value', 60); // 60s TTL
```

### 7. `tests/example.test.ts`

Comprehensive example test file demonstrating:
- Test structure and organization
- Mock usage patterns
- Async testing
- Global utilities usage
- Best practices

### 8. `tests/README.md`

Comprehensive testing documentation covering:
- Running tests
- Writing tests
- Using mocks
- Path aliases
- Coverage configuration
- Best practices
- Debugging
- CI/CD integration

## Configuration Details

### Path Alias Resolution

Both `tsconfig.test.json` and `jest.config.js` must have matching path mappings:

**tsconfig.test.json:**
```json
{
  "paths": {
    "@/*": ["src/*"],
    "@core/*": ["src/core/*"],
    // ... etc
  }
}
```

**jest.config.js:**
```javascript
{
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    // ... etc
  }
}
```

### Coverage Configuration

Coverage is collected from all source files excluding:
- Type definition files (`*.d.ts`, `*.types.ts`, `*.interface.ts`)
- Test files (`*.test.ts`, `*.spec.ts`)
- Test directories (`__tests__`, `__mocks__`)
- Index files (typically just re-exports)
- Type directories

### Module Resolution

Jest uses `ts-jest` to transform TypeScript files:
```javascript
{
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    }],
  }
}
```

## Dependencies

### Installed
- `jest@^29.7.0` - Testing framework
- `ts-jest@^29.1.1` - TypeScript support for Jest
- `@types/jest@30.0.0` - Jest type definitions

### Required Peer Dependencies
All peer dependencies of Jest and ts-jest are satisfied by existing Node.js and TypeScript installations.

## Known Issues and Solutions

### 1. Import Path Resolution

**Issue:** Module imports using path aliases don't resolve.

**Solution:** Ensure both `tsconfig.test.json` and `jest.config.js` have matching path configurations.

### 2. CommonJS vs ESM

**Issue:** Jest requires CommonJS modules, but the project uses ESM.

**Solution:** `tsconfig.test.json` uses `"module": "CommonJS"` while main config uses ESM.

### 3. Type Definitions

**Issue:** TypeScript doesn't recognize Jest globals (describe, it, expect).

**Solution:** Added `"types": ["node", "jest"]` to `tsconfig.test.json` and installed `@types/jest`.

### 4. Isolated Modules Warning

**Issue:** ts-jest shows warning about deprecated globals configuration.

**Solution:** Moved `isolatedModules: true` from Jest config to `tsconfig.test.json`.

### 5. Console Noise

**Issue:** Tests produce excessive console output.

**Solution:** Setup file mocks console methods by default. Individual tests can restore if needed.

## Performance Optimizations

1. **Isolated Modules**: Faster TypeScript compilation
2. **Max Workers**: Limited to 50% of CPU cores
3. **Clear/Reset Mocks**: Automatic cleanup between tests
4. **Transform Cache**: ts-jest caches transformed files

## Running Tests

### Development
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # With coverage
```

### CI/CD
```bash
npm test -- --ci --coverage --maxWorkers=2
```

### Debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/example.test.ts
```

## Future Improvements

1. **Integration Tests**: Add E2E tests for CLI commands
2. **Snapshot Tests**: Add snapshot testing for UI components
3. **Performance Tests**: Add benchmarks for critical paths
4. **Visual Regression**: Add visual testing for TUI
5. **Mutation Testing**: Consider adding mutation testing with Stryker

## Additional Notes

### Test Isolation

Each test runs in isolation with:
- Fresh mock instances
- Cleared module cache (optional)
- Reset timers and mocks
- Clean test environment

### Test Coverage Goals

Current thresholds are conservative to allow incremental improvement:
- Start: 70/70/80/80 (branches/functions/lines/statements)
- Target: 80/80/90/90
- Ideal: 90/90/95/95

### Mocking Strategy

The project uses three levels of mocking:
1. **Unit Mocks**: Individual classes/functions
2. **Integration Mocks**: External services (APIs, databases)
3. **System Mocks**: System-level operations (file system, network)

All mocks are in `tests/mocks/` for reusability.

## Maintenance

### Adding New Mocks

1. Create mock file in `tests/mocks/`
2. Export from `tests/mocks/index.ts`
3. Document in `tests/README.md`
4. Add example usage in `tests/example.test.ts`

### Updating Configuration

When adding new path aliases:
1. Update `tsconfig.json`
2. Update `tsconfig.test.json`
3. Update `jest.config.js` moduleNameMapper
4. Verify with a test import

### Dependency Updates

When updating Jest or ts-jest:
1. Check breaking changes in release notes
2. Update configuration if needed
3. Run full test suite
4. Check for deprecation warnings

## Support

For issues or questions:
1. Check `tests/README.md` for common solutions
2. Review example tests in `tests/example.test.ts`
3. Check Jest documentation: https://jestjs.io/
4. Check ts-jest documentation: https://kulshekhar.github.io/ts-jest/
