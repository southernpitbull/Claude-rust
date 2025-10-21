# AIrchitect Test Infrastructure

This directory contains the testing infrastructure for the AIrchitect project.

## Overview

The test suite uses Jest with TypeScript support via ts-jest. All tests are configured to run with proper module path mapping, mocking capabilities, and coverage reporting.

## Directory Structure

```
tests/
├── README.md              # This file
├── setup.ts              # Global test setup and utilities
├── example.test.ts       # Example test demonstrating best practices
└── mocks/                # Mock implementations
    ├── index.ts          # Central export for all mocks
    ├── providers.ts      # AI provider mocks
    ├── langchain.ts      # LangChain component mocks
    └── storage.ts        # Storage and persistence mocks
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm test -- --watch
```

### Run tests with coverage
```bash
npm test -- --coverage
```

### Run specific test file
```bash
npm test -- tests/example.test.ts
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="Provider"
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = someFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Using Mocks

#### Mock Providers

```typescript
import { createMockProvider, setupMockProviders } from './mocks/providers';

describe('Provider Tests', () => {
  it('should use mock provider', async () => {
    const provider = createMockProvider('TestProvider', 'test-model');
    const response = await provider.generateResponse([]);
    expect(response.content).toBeDefined();
  });
});
```

#### Mock Storage

```typescript
import { MockStorage, MockCache } from './mocks/storage';

describe('Storage Tests', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
  });

  it('should store values', async () => {
    await storage.set('key', 'value');
    const result = await storage.get('key');
    expect(result).toBe('value');
  });
});
```

#### Mock LangChain Components

```typescript
import { MockChatModel, createMockMessages } from './mocks/langchain';

describe('LangChain Tests', () => {
  it('should invoke chat model', async () => {
    const model = new MockChatModel();
    const messages = createMockMessages(1);
    const response = await model.invoke(messages);
    expect(response.content).toBeDefined();
  });
});
```

### Using Test Utilities

Global test utilities are available via `global.testUtils`:

```typescript
it('should wait for async operation', async () => {
  await global.testUtils.wait(100); // Wait 100ms
});

it('should generate random data', () => {
  const str = global.testUtils.randomString(10);
  const num = global.testUtils.randomNumber(1, 100);
  expect(str).toHaveLength(10);
  expect(num).toBeGreaterThanOrEqual(1);
});
```

## Path Aliases

The following path aliases are configured and work in tests:

- `@/*` → `src/*`
- `@core/*` → `src/core/*`
- `@agents/*` → `src/agents/*`
- `@ui/*` → `src/tui/*`
- `@providers/*` → `src/providers/*`
- `@commands/*` → `src/commands/*`
- `@utils/*` → `src/utils/*`
- `@types/*` → `src/types/*`
- `@bindings/*` → `bindings/*`
- `@plugins/*` → `plugins/*`

Example usage:

```typescript
import { ProviderManager } from '@providers/base';
import { AgentRegistry } from '@agents/registry';
```

## Coverage Configuration

Coverage is collected from:
- All TypeScript files in `src/`
- Excluding type definitions (`*.d.ts`, `*.types.ts`, `*.interface.ts`)
- Excluding test files
- Excluding `index.ts` files (typically just re-exports)

### Coverage Thresholds

The project enforces the following minimum coverage:
- Branches: 70%
- Functions: 70%
- Lines: 80%
- Statements: 80%

### Viewing Coverage

After running tests with `--coverage`, open the HTML report:
```bash
npm test -- --coverage
# Then open: coverage/index.html
```

## Best Practices

### 1. Test Organization

- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern

### 2. Mocking

- Mock external dependencies (API calls, file system, databases)
- Use the provided mock implementations in `tests/mocks/`
- Clear mocks between tests (done automatically)

### 3. Async Tests

- Always `await` async operations
- Use `async/await` instead of callbacks
- Handle promise rejections properly

### 4. Test Independence

- Each test should be independent and isolated
- Don't rely on test execution order
- Clean up after each test in `afterEach`

### 5. Performance

- Keep tests fast (<100ms per test)
- Mock slow operations (network, database, file I/O)
- Use `isolatedModules` for faster TypeScript compilation

### 6. Error Testing

```typescript
it('should throw error for invalid input', () => {
  expect(() => {
    someFunction(null);
  }).toThrow('Invalid input');
});

// For async errors
it('should reject promise for invalid input', async () => {
  await expect(asyncFunction(null)).rejects.toThrow('Invalid input');
});
```

### 7. Snapshot Testing

```typescript
it('should match snapshot', () => {
  const result = complexObject();
  expect(result).toMatchSnapshot();
});
```

## Debugging Tests

### Run single test in debug mode

```bash
node --inspect-brk node_modules/.bin/jest --runInBand tests/example.test.ts
```

### Enable verbose output

```bash
npm test -- --verbose
```

### Show all console output

```bash
npm test -- --silent=false
```

## Common Issues

### Import path resolution

If imports are not resolving correctly:
1. Check that path aliases are configured in both `tsconfig.test.json` and `jest.config.js`
2. Ensure you're using the correct alias prefix
3. Verify the file exists at the expected location

### Module not found

If you see "Cannot find module" errors:
1. Check that the module is installed (`npm ls <module>`)
2. Verify the import path is correct
3. Clear Jest cache: `npm test -- --clearCache`

### TypeScript compilation errors

If TypeScript compilation fails:
1. Check `tsconfig.test.json` configuration
2. Ensure all required types are installed
3. Run `npx tsc --noEmit -p tsconfig.test.json` to see detailed errors

## Continuous Integration

The test suite is designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test -- --ci --coverage --maxWorkers=2
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
