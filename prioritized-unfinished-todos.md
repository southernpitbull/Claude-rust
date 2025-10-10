# Prioritized Unfinished Features

This document organizes the unfinished features by priority to help with implementation planning.

## High Priority (Must be implemented for core functionality)

### Core Features Missing
1. **Web Search Tool** - `/crates/tools/src/builtin.rs:279` - Essential tool for AI functionality
2. **MCP Command Implementations** - `/crates/cli/src/commands.rs:3439-3494` - Core MCP functionality
3. **Undo Operations** - `/crates/core/src/commands/executor.rs:304,310` - Important for user experience
4. **Streaming Support for Local Providers** - `/crates/ai/src/providers/local.rs:280,479` - Core AI functionality

### Critical Placeholders
5. **Auth Wizard Implementation** - `/crates/auth/src/auth_wizard.rs:47-172` - Core authentication functionality
6. **Config Path Resolution** - `/crates/core/src/config/loader.rs:479` - Core configuration functionality

## Medium Priority (Important for completeness)

### Analysis Features
7. **Codebase Indexing** - `/crates/cli/src/handlers/query.rs:60` - Important for contextual responses
8. **Dependency Analysis** - `/crates/cli/src/handlers/analyze.rs:216` - Important for project understanding
9. **Security Scanning** - `/crates/cli/src/handlers/analyze.rs:185` - Important for code quality
10. **Complexity Metrics** - `/crates/cli/src/handlers/analyze.rs:165` - Important for code analysis
11. **File Watching** - `/crates/cli/src/handlers/analyze.rs:395` - Important for live updates

### Tool System
12. **Tool Parameter Validation** - `/crates/tools/src/tool.rs:149,230` - Important for tool reliability
13. **Tool Executor UI Integration** - `/crates/cli/src/tool_executor.rs:56` - Important for user experience

## Low Priority (Enhancements and Nice-to-haves)

### Minor TODOs
14. **Index Rebuilding** - `/crates/cli/src/handlers/analyze.rs:45` - Enhancement
15. **Index Statistics** - `/crates/cli/src/handlers/analyze.rs:355` - Enhancement
16. **Incremental Updates** - `/crates/cli/src/handlers/analyze.rs:408` - Enhancement
17. **Model Loading from Config** - `/crates/cli/src/interactive.rs:146` - Enhancement
18. **Index Clearing** - `/crates/cli/src/handlers/analyze.rs:380` - Enhancement

### Provider Placeholders
19. **Ollama OAuth Provider** - `/crates/auth/src/oauth/providers.rs:825-831` - Consistency placeholder
20. **LM Studio OAuth Provider** - `/crates/auth/src/oauth/providers.rs:871-877` - Consistency placeholder

## Future Considerations (May not be immediately necessary)

### Configuration Placeholders
21. **Config String Paths** - `/crates/core/src/config/loader.rs:146-166` - Internal implementation detail

### Parser Error Messages
22. **Parser Missing Elements** - `/crates/core/src/commands/parser.rs:353-520` - Error handling improvements

## Priority Assessment

### High Priority Count: 6 items
These are core functionalities that users would expect to work. Without these, key features of Claude Code are missing.

### Medium Priority Count: 11 items
These enhance the core functionality and improve user experience significantly. Users would notice these missing.

### Low Priority Count: 8 items
These are nice-to-have enhancements that improve functionality but aren't critical for basic operation.

### Future Considerations Count: 3 items
These are implementation details that may not need immediate attention.

## Implementation Strategy

1. **Start with High Priority items** - These are blocking core functionality
2. **Move to Medium Priority** - These significantly improve the user experience
3. **Address Low Priority items** - These polish the implementation
4. **Consider Future items** - These can be addressed as time permits

This prioritization focuses on delivering a complete, functional Claude Code experience before moving to enhancements.