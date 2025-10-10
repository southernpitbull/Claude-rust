@echo off
REM Claude Code Docker Build Script for Windows
REM Simplifies building and running Claude Code in Docker

set IMAGE_NAME=claude-code
set TAG=latest
set BUILD_CONTEXT=.
set DOCKERFILE=Dockerfile

echo Claude Code Docker Build Script
echo.

REM Check if Docker is available
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    exit /b 1
)

REM Parse command line arguments
set COMMAND=
set ARG1=
set ARG2=

if "%1"=="" (
    echo Usage: %0 [build^|run^|shell^|clean^|help] [options]
    echo.
    echo Commands:
    echo   build     Build the Docker image
    echo   run       Run the Docker container
    echo   shell     Run a shell in the container
    echo   clean     Remove Docker images and containers
    echo   help      Show this help
    echo.
    echo Examples:
    echo   %0 build
    echo   %0 run
    goto :eof
)

set COMMAND=%1
shift

REM Handle commands
if "%COMMAND%"=="build" (
    call :build_image
    goto :eof
)

if "%COMMAND%"=="run" (
    call :run_container
    goto :eof
)

if "%COMMAND%"=="shell" (
    call :shell_container
    goto :eof
)

if "%COMMAND%"=="clean" (
    call :clean_docker
    goto :eof
)

if "%COMMAND%"=="help" (
    echo Usage: %0 [build^|run^|shell^|clean^|help] [options]
    echo.
    echo Commands:
    echo   build     Build the Docker image
    echo   run       Run the Docker container
    echo   shell     Run a shell in the container
    echo   clean     Remove Docker images and containers
    echo   help      Show this help
    echo.
    echo Examples:
    echo   %0 build
    echo   %0 run
    goto :eof
)

echo Unknown command: %COMMAND%
goto :eof

REM Functions

:build_image
    echo Building Claude Code Docker image...
    echo Image: %IMAGE_NAME%:%TAG%
    echo Context: %BUILD_CONTEXT%
    echo Dockerfile: %DOCKERFILE%
    echo.

    docker build -t "%IMAGE_NAME%:%TAG%" -f "%DOCKERFILE%" "%BUILD_CONTEXT%"
    
    if %errorlevel% equ 0 (
        echo Build completed successfully!
        echo Run with: docker run -it %IMAGE_NAME%:%TAG%
    ) else (
        echo Build failed!
        exit /b 1
    )
    goto :eof

:run_container
    echo Running Claude Code container...
    echo Image: %IMAGE_NAME%:%TAG%
    echo.

    REM Check if container is already running
    docker ps -q --filter "name=claude-code" | findstr . >nul
    if %errorlevel% equ 0 (
        echo Container already running. Stopping it first...
        docker stop claude-code >nul 2>&1
        docker rm claude-code >nul 2>&1
    )

    REM Run the container
    docker run -it ^
        --name claude-code ^
        -p 3000:3000 ^
        -v claude-data:/home/claude/.claude ^
        %IMAGE_NAME%:%TAG%

    echo Container stopped.
    goto :eof

:shell_container
    echo Starting shell in Claude Code container...
    
    REM Check if container exists
    docker ps -aq --filter "name=claude-code" | findstr . >nul
    if %errorlevel% equ 0 (
        REM If running, exec into it
        docker ps -q --filter "name=claude-code" | findstr . >nul
        if %errorlevel% equ 0 (
            docker exec -it claude-code /bin/bash
        ) else (
            REM If stopped, start it first
            docker start claude-code >nul
            docker exec -it claude-code /bin/bash
            docker stop claude-code >nul
        )
    ) else (
        REM Run new container with shell
        docker run -it ^
            --name claude-code-shell ^
            -v claude-data:/home/claude/.claude ^
            %IMAGE_NAME%:%TAG% ^
            /bin/bash
    )
    goto :eof

:clean_docker
    echo Cleaning Docker resources...
    
    REM Stop and remove containers
    echo Removing containers...
    for /f %%i in ('docker ps -aq --filter "name=claude-code"') do (
        docker rm -f %%i >nul 2>&1
    )
    
    REM Remove images
    echo Removing images...
    for /f %%i in ('docker images -q %IMAGE_NAME%') do (
        docker rmi -f %%i >nul 2>&1
    )
    
    REM Remove volumes
    echo Removing volumes...
    for /f %%i in ('docker volume ls -q ^| findstr claude') do (
        docker volume rm %%i >nul 2>&1
    )
    
    echo Docker resources cleaned.
    goto :eof