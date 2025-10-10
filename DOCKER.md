# Claude Code Docker

Docker support for Claude Code - AI-powered CLI tool for developers

## Overview

This directory contains Docker configuration files for running Claude Code in containers. The setup includes:

- Multi-stage Dockerfile for optimized builds
- Docker Compose configuration for easy deployment
- Support for local AI providers (Ollama, LM Studio)
- Persistent data volumes
- Health checks and restart policies

## Quick Start

### Using Docker Run

```bash
# Build the image
docker build -t claude-code .

# Run Claude Code
docker run -it claude-code

# Run web server
docker run -it -p 3000:3000 claude-code serve
```

### Using Docker Compose

```bash
# Build and run
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_HOME` | Claude Code configuration directory | `/home/claude/.claude` |
| `HOST` | Web server host | `127.0.0.1` |
| `PORT` | Web server port | `3000` |

### Volumes

- `claude-data`: Persistent configuration and session data
- Current directory: Mounted as `/workspace` for project access

## Services

### Claude Code (Main Service)

The main Claude Code service provides the CLI interface and web server.

```bash
# Run with custom port
docker run -it -p 8080:8080 claude-code serve --port 8080
```

### Ollama (Optional)

Local AI provider for running models locally.

```bash
# Start with Ollama profile
docker-compose --profile ollama up -d
```

### LM Studio (Optional)

Alternative local AI provider.

```bash
# Start with LM Studio profile
docker-compose --profile lmstudio up -d
```

## Build Scripts

### Linux/macOS

```bash
# Make script executable
chmod +x scripts/docker-build.sh

# Build image
./scripts/docker-build.sh build

# Run container
./scripts/docker-build.sh run

# Run shell in container
./scripts/docker-build.sh shell
```

### Windows

```cmd
# Build image
scripts\docker-build.bat build

# Run container
scripts\docker-build.bat run

# Run shell in container
scripts\docker-build.bat shell
```

## Development

### Building from Source

The Dockerfile uses a multi-stage build process:

1. **Builder Stage**: Compiles Claude Code with all dependencies
2. **Runtime Stage**: Creates minimal runtime image with only necessary files

### Custom Builds

```dockerfile
# Custom Dockerfile for specific needs
FROM claude-code:latest

# Add custom configuration
COPY config/ /home/claude/.claude/

# Pre-install models (if using Ollama)
RUN ollama pull llama2
```

## Security

- Runs as non-root user `claude`
- Minimal runtime image with only necessary packages
- No sensitive data stored in image
- Health checks for service monitoring

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Use different port
   docker run -it -p 3001:3000 claude-code serve
   ```

2. **Volume Permissions**
   ```bash
   # Fix permissions
   docker run -it -v $(pwd):/workspace:rw claude-code
   ```

3. **Network Issues**
   ```bash
   # Use host networking (Linux only)
   docker run -it --network host claude-code
   ```

### Debugging

```bash
# View container logs
docker logs claude-code

# Run shell in container
docker exec -it claude-code /bin/bash

# Check running processes
docker top claude-code
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Build and test with Docker
5. Submit pull request

## License

MIT License - see LICENSE file for details