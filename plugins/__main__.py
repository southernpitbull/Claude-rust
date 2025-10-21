"""
AIrchitect CLI - Python Plugin Entry Point

This module serves as the entry point for the Python plugin system.
"""

import sys
import os
from pathlib import Path

# Add the current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from ai_cli_python import PluginManager, Plugin
from example_plugin import ExamplePlugin

def main():
    """Main entry point for the Python plugin system."""
    print("AIrchitect CLI - Python Plugin System")
    print("=" * 40)
    
    # Create plugin manager
    plugin_manager = PluginManager()
    
    # Register example plugin
    example_plugin = ExamplePlugin()
    plugin_manager.plugins["example"] = example_plugin
    
    # Initialize plugins
    print("\nInitializing plugins...")
    for name, plugin in plugin_manager.plugins.items():
        try:
            if plugin.initialize():
                print(f"  ✓ {name} plugin initialized")
            else:
                print(f"  ✗ {name} plugin failed to initialize")
        except Exception as e:
            print(f"  ✗ {name} plugin error: {e}")
    
    # Show available plugins
    print(f"\nAvailable plugins: {len(plugin_manager.plugins)}")
    for name in plugin_manager.plugins.keys():
        print(f"  - {name}")
    
    # Test example plugin commands
    print("\nTesting example plugin commands:")
    try:
        # Test hello command
        result = example_plugin.execute_command("hello", [])
        print(f"  hello: {result}")
        
        # Test hello command with name
        result = example_plugin.execute_command("hello", ["AI", "Developer"])
        print(f"  hello AI Developer: {result}")
        
        # Test features command
        result = example_plugin.execute_command("features", [])
        print(f"  features:\n{result}")
        
        # Test calculate command
        result = example_plugin.execute_command("calculate", ["10", "3"])
        print(f"  calculate 10 3: {result}")
    except Exception as e:
        print(f"  Error testing plugin commands: {e}")
    
    print("\nPython plugin system ready!")
    return 0

if __name__ == "__main__":
    sys.exit(main())