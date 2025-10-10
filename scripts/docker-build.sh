#!/bin/bash

# Claude Code Docker Build Script
# Simplifies building and running Claude Code in Docker

set -e  # Exit on any error

# Default values
IMAGE_NAME="claude-code"
TAG="latest"
BUILD_CONTEXT="."
DOCKERFILE="Dockerfile"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help function
show_help() {
    echo "Claude Code Docker Build Script"
    echo ""
    echo "Usage: $0 [OPTIONS] COMMAND"
    echo ""
    echo "Commands:"
    echo "  build     Build the Docker image"
    echo "  run       Run the Docker container"
    echo "  shell     Run a shell in the container"
    echo "  clean     Remove Docker images and containers"
    echo "  help      Show this help"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG         Docker image tag (default: latest)"
    echo "  -n, --name NAME       Docker image name (default: claude-code)"
    echo "  -f, --file DOCKERFILE Dockerfile to use (default: Dockerfile)"
    echo "  -c, --context CONTEXT Build context (default: .)"
    echo ""
    echo "Examples:"
    echo "  $0 build"
    echo "  $0 run"
    echo "  $0 build --tag v1.0.0"
    echo "  $0 run --name my-claude"
}

# Build the Docker image
build_image() {
    echo -e "${BLUE}Building Claude Code Docker image...${NC}"
    echo "Image: $IMAGE_NAME:$TAG"
    echo "Context: $BUILD_CONTEXT"
    echo "Dockerfile: $DOCKERFILE"
    echo ""

    # Build the image
    docker build \
        -t "$IMAGE_NAME:$TAG" \
        -f "$DOCKERFILE" \
        "$BUILD_CONTEXT"

    echo -e "${GREEN}Build completed successfully!${NC}"
    echo "Run with: docker run -it $IMAGE_NAME:$TAG"
}

# Run the Docker container
run_container() {
    echo -e "${BLUE}Running Claude Code container...${NC}"
    echo "Image: $IMAGE_NAME:$TAG"
    echo ""

    # Check if container is already running
    if docker ps -q --filter "name=claude-code" | grep -q .; then
        echo -e "${YELLOW}Container already running. Stopping it first...${NC}"
        docker stop claude-code >/dev/null 2>&1 || true
        docker rm claude-code >/dev/null 2>&1 || true
    fi

    # Run the container
    docker run -it \
        --name claude-code \
        -p 3000:3000 \
        -v claude-data:/home/claude/.claude \
        "$IMAGE_NAME:$TAG" \
        "$@"

    echo -e "${GREEN}Container stopped.${NC}"
}

# Run a shell in the container
shell_container() {
    echo -e "${BLUE}Starting shell in Claude Code container...${NC}"
    
    # Check if container exists
    if docker ps -aq --filter "name=claude-code" | grep -q .; then
        # If running, exec into it
        if docker ps -q --filter "name=claude-code" | grep -q .; then
            docker exec -it claude-code /bin/bash
        else
            # If stopped, start it first
            docker start claude-code
            docker exec -it claude-code /bin/bash
            docker stop claude-code
        fi
    else
        # Run new container with shell
        docker run -it \
            --name claude-code-shell \
            -v claude-data:/home/claude/.claude \
            "$IMAGE_NAME:$TAG" \
            /bin/bash
    fi
}

# Clean Docker images and containers
clean_docker() {
    echo -e "${YELLOW}Cleaning Docker resources...${NC}"
    
    # Stop and remove containers
    echo "Removing containers..."
    docker ps -aq --filter "name=claude-code" | xargs -r docker rm -f
    
    # Remove images
    echo "Removing images..."
    docker images -q "$IMAGE_NAME" | xargs -r docker rmi -f
    
    # Remove volumes
    echo "Removing volumes..."
    docker volume ls -q | grep claude | xargs -r docker volume rm
    
    echo -e "${GREEN}Docker resources cleaned.${NC}"
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -f|--file)
            DOCKERFILE="$2"
            shift 2
            ;;
        -c|--context)
            BUILD_CONTEXT="$2"
            shift 2
            ;;
        build)
            COMMAND="build"
            shift
            ;;
        run)
            COMMAND="run"
            shift
            ;;
        shell)
            COMMAND="shell"
            shift
            ;;
        clean)
            COMMAND="clean"
            shift
            ;;
        help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Execute the command
case $COMMAND in
    build)
        build_image
        ;;
    run)
        run_container
        ;;
    shell)
        shell_container
        ;;
    clean)
        clean_docker
        ;;
    "")
        echo -e "${RED}No command specified${NC}"
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac