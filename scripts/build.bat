@echo off
setlocal enabledelayedexpansion

echo === AIrchitect CLI Build Script ===
echo Building multi-language components...
echo.

REM Check prerequisites
echo Checking prerequisites...

where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Rust compiler ^(rustc^) not found
    echo Please install Rust from https://rustup.rs/
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js not found
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python not found
    echo Please install Python from https://www.python.org/
    exit /b 1
)

where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Cargo not found
    echo Please install Rust with Cargo from https://rustup.rs/
    exit /b 1
)

echo All prerequisites found!
echo.

REM Build Rust components
echo Building Rust components...
cargo build --release
if %errorlevel% neq 0 (
    echo Error building Rust components
    exit /b 1
)
echo Rust components built successfully!
echo.

REM Build TypeScript components
echo Building TypeScript components...
npm run build
if %errorlevel% neq 0 (
    echo Error building TypeScript components
    exit /b 1
)
echo TypeScript components built successfully!
echo.

REM Set up Python environment
echo Setting up Python environment...
python -m venv venv
call venv\Scripts\activate
pip install -e .
if %errorlevel% neq 0 (
    echo Error setting up Python environment
    exit /b 1
)
echo Python environment set up successfully!
echo.

REM Build Python bindings
echo Building Python bindings...
cd bindings\python
maturin develop
if %errorlevel% neq 0 (
    echo Error building Python bindings
    cd ..\..
    exit /b 1
)
cd ..\..
echo Python bindings built successfully!
echo.

REM Create distribution directories
echo Creating distribution directories...
mkdir dist\bin 2>nul
mkdir dist\lib 2>nul
mkdir dist\plugins 2>nul
echo Distribution directories created!
echo.

REM Copy binaries
echo Copying binaries...
copy target\release\ai-cli-core.exe dist\bin\ >nul
copy target\release\ai-cli-*.exe dist\bin\ >nul
echo Binaries copied!
echo.

REM Copy TypeScript bundles
echo Copying TypeScript bundles...
xcopy /E /I /Y dist\* dist\ >nul
echo TypeScript bundles copied!
echo.

REM Copy Python packages
echo Copying Python packages...
xcopy /E /I /Y plugins\* dist\plugins\ >nul
echo Python packages copied!
echo.

echo === Build Complete ===
echo AIrchitect CLI has been built successfully!
echo.
echo To run the application:
echo   dist\bin\ai-cli-core.exe --help
echo.
echo To install globally:
echo   cd dist ^&^& pip install . ^&^& npm install -g .
echo.

pause