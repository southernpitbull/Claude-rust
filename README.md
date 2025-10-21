# AI CLI - Advanced AI-Powered Command Line Interface

## Overview
The AI CLI is a sophisticated command line interface designed to leverage multiple AI providers, featuring an advanced agent system with TUI, checkpointing, memory systems, and security features. Built with Rust for performance and TypeScript for flexibility, this tool provides a unified interface for interacting with various AI services.

## Features
- **Multi-Provider Support**: Seamlessly switch between OpenAI, Anthropic, Google Gemini, and other AI providers
- **Agent Framework**: Sophisticated agent system with orchestration and collaboration capabilities
- **TUI Interface**: Rich terminal user interface with vim-like key bindings
- **Checkpoint System**: Save and restore AI session states
- **Memory System**: Context-aware conversations with vector storage
- **Security Framework**: Credential management and encryption
- **Plugin Architecture**: Extensible functionality through plugins
- **Cross-Platform Bindings**: Python and TypeScript bindings available

## Architecture

### Core Components
1. **Agent Framework**: Manages AI agents with roles, responsibilities, and collaboration
2. **CLI System**: Command parsing, validation, and execution
3. **Providers**: Interfaces for various AI services with cost tracking
4. **TUI**: Terminal interface with panels, status bar, and key bindings
5. **Memory**: Short-term and long-term memory with vector storage
6. **Checkpoint**: Session persistence and restore capabilities
7. **Security**: Credential management and encryption services
8. **Configuration**: Flexible configuration system with validation

### Technology Stack
- **Rust**: Core performance-critical components
- **TypeScript**: CLI and higher-level orchestration
- **Vector Storage**: Memory persistence with similarity search
- **Event System**: Asynchronous communication between components

## Installation

### Prerequisites
- Node.js 18+ (for TypeScript components)
- Rust 1.70+ (for core crates)
- Git

### Setup
```bash
# Clone the repository
git clone https://github.com/southernpitbull/Claude-rust.git
cd Claude-rust

# Install Rust dependencies
cargo build

# Install Node.js dependencies
npm install

# Configure your AI provider credentials
cp .env.example .env
# Edit .env with your API keys
```

## Usage

### Basic Command
```bash
# Run the AI CLI
npm start
# or
cargo run
```

### Configuration
Create a `.env` file with your AI provider credentials:
```
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
```

### Commands
- `/chat` - Start an interactive chat session
- `/agent` - Initialize an AI agent for specific tasks
- `/memory` - Access and manage conversation memory
- `/config` - Update configuration settings
- `/help` - Show available commands

## Configuration

The system supports multiple configuration methods:

1. **Environment Variables**: Set API keys and basic settings
2. **Configuration File**: Define complex settings in JSON format
3. **Command Line Options**: Override settings per execution

## Providers

### Currently Supported
- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)
- Local models (Ollama, LMStudio, vLLM)

### Cost Tracking
The system tracks usage costs across all providers and provides summaries.

## Security

### Credential Management
- Secure credential storage
- Environment-based configuration
- Encryption for sensitive data
- RBAC (Role-Based Access Control) implementation

### Data Privacy
- Local processing where possible
- Secure session handling
- Minimal data retention policies

## Development

### Project Structure
```
.
├── crates/               # Rust core components
│   ├── agent-framework/  # Agent management
│   ├── ai-engine/        # Core AI logic
│   ├── checkpoint/       # Session persistence
│   ├── core/             # Core CLI functionality
│   ├── memory-system/    # Memory management
│   ├── providers/        # AI provider interfaces
│   ├── security/         # Security components
│   ├── tui/              # Terminal UI
│   └── utils/            # Utility functions
├── src/                  # TypeScript components
│   ├── agents/           # Agent implementations
│   ├── cli/              # Command line interface
│   ├── commands/         # Command implementations
│   ├── config/           # Configuration management
│   ├── logging/          # Logging system
│   └── providers/        # Provider interfaces
├── bindings/             # Language bindings
│   ├── python/           # Python binding
│   └── typescript/       # TypeScript binding
├── plugins/              # Plugin system
└── tests/                # Test suite
```

### Adding New AI Providers
1. Implement the base provider interface
2. Add provider-specific configuration
3. Implement cost tracking if applicable
4. Add to provider selection logic

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.