"""
Example Plugin for AIrchitect CLI

This plugin demonstrates how to create plugins for the AIrchitect CLI system.
"""

from typing import List, Dict, Any, Optional
from core import PluginAPI, PluginContext, log_info, log_warning, log_error


class ExamplePlugin(PluginAPI):
    """
    Example plugin that provides demonstration commands.
    """
    
    def __init__(self):
        # Initialize with a context
        context = PluginContext("example")
        super().__init__(context)
        
        # Plugin metadata
        self._name = "example"
        self._version = "1.0.0"
        self._description = "Example plugin demonstrating AIrchitect CLI plugin system"
        
        # Example data
        self.example_data = {
            "greeting": "Hello from the example plugin!",
            "features": [
                "Multi-language architecture",
                "Plugin system with Python extensions",
                "AI integration with multiple providers",
                "Rich terminal user interface",
                "Intelligent agent framework"
            ]
        }
    
    def get_name(self) -> str:
        """Get the plugin name."""
        return self._name
    
    def get_version(self) -> str:
        """Get the plugin version."""
        return self._version
    
    def get_description(self) -> str:
        """Get the plugin description."""
        return self._description
    
    def get_commands(self) -> List[str]:
        """Get a list of commands provided by this plugin."""
        return ["hello", "features", "calculate", "ai-query"]
    
    def execute_command(self, command: str, args: List[str]) -> Any:
        """
        Execute a plugin command.
        
        Args:
            command: Command name to execute
            args: Command arguments
            
        Returns:
            Command result
        """
        log_info(f"Executing command: {command} with args: {args}")
        
        if command == "hello":
            return self._hello_command(args)
        elif command == "features":
            return self._features_command(args)
        elif command == "calculate":
            return self._calculate_command(args)
        elif command == "ai-query":
            return self._ai_query_command(args)
        else:
            raise ValueError(f"Unknown command: {command}")
    
    def initialize(self) -> bool:
        """
        Initialize the plugin.
        
        Returns:
            True if initialization was successful
        """
        log_info(f"Initializing {self._name} plugin v{self._version}")
        
        # Store some data in the context
        self.context.set_config("initialized", True)
        self.context.set_config("init_time", __import__('time').time())
        
        # Ensure data directory exists
        self.context.ensure_data_dir()
        
        # Write a sample data file
        self.context.write_data_file("sample.txt", "This is a sample data file created by the example plugin.")
        
        log_info(f"{self._name} plugin initialized successfully")
        return True
    
    def cleanup(self) -> None:
        """Clean up plugin resources."""
        log_info(f"Cleaning up {self._name} plugin")
        
        # In a real implementation, we would clean up any resources here
        # For example, closing file handles, terminating threads, etc.
    
    def get_info(self) -> Dict[str, Any]:
        """Get plugin information."""
        info = super().get_info()
        info.update({
            "description": self._description,
            "initialized": self.context.get_config("initialized", False),
            "data_files": self.context.list_data_files()
        })
        return info
    
    def _hello_command(self, args: List[str]) -> str:
        """
        Handle the hello command.
        
        Args:
            args: Command arguments
            
        Returns:
            Greeting message
        """
        if args:
            name = " ".join(args)
            return f"Hello, {name}! {self.example_data['greeting']}"
        else:
            return self.example_data["greeting"]
    
    def _features_command(self, args: List[str]) -> str:
        """
        Handle the features command.
        
        Args:
            args: Command arguments
            
        Returns:
            Features list
        """
        features_list = "\n".join([f"  - {feature}" for feature in self.example_data["features"]])
        return f"AIrchitect CLI Features:\n{features_list}"
    
    def _calculate_command(self, args: List[str]) -> Dict[str, Any]:
        """
        Handle the calculate command.
        
        Args:
            args: Command arguments (should be two numbers)
            
        Returns:
            Calculation results
        """
        if len(args) != 2:
            raise ValueError("Calculate command requires exactly two numbers")
        
        try:
            a = float(args[0])
            b = float(args[1])
        except ValueError:
            raise ValueError("Both arguments must be valid numbers")
        
        results = {
            "operation": "calculation",
            "operands": [a, b],
            "results": {
                "sum": a + b,
                "difference": a - b,
                "product": a * b,
                "quotient": a / b if b != 0 else "undefined",
                "power": a ** b,
                "modulo": a % b if b != 0 else "undefined"
            }
        }
        
        # Store the calculation in project memory
        try:
            memory = self.context.get_project_memory()
            memory.store(f"calculation_{hash(str(results))}", results)
        except Exception as e:
            log_warning(f"Failed to store calculation in project memory: {e}")
        
        return results
    
    def _ai_query_command(self, args: List[str]) -> str:
        """
        Handle the AI query command.
        
        Args:
            args: Command arguments (query string)
            
        Returns:
            AI response
        """
        if not args:
            raise ValueError("AI query command requires a query string")
        
        query = " ".join(args)
        
        # Send query to AI provider
        try:
            provider = self.context.get_ai_provider()
            response = provider.send_prompt(
                f"As an example plugin for AIrchitect CLI, please answer this query: {query}",
                temperature=0.7,
                max_tokens=200
            )
            return f"AI Response:\n{response}"
        except Exception as e:
            log_error(f"Failed to query AI provider: {e}")
            return f"Error querying AI provider: {e}"


# Create an instance of the plugin
example_plugin = ExamplePlugin()


def main() -> int:
    """
    Main entry point for testing the example plugin.
    
    Returns:
        Exit code (0 for success, non-zero for error)
    """
    print("Example Plugin for AIrchitect CLI")
    print("=" * 40)
    
    try:
        # Test plugin initialization
        if not example_plugin.initialize():
            print("Failed to initialize plugin")
            return 1
        
        # Show plugin information
        info = example_plugin.get_info()
        print(f"\nPlugin Info:")
        for key, value in info.items():
            print(f"  {key}: {value}")
        
        # Test plugin commands
        print(f"\nTesting plugin commands:")
        
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
        
        # Test AI query command (this would require a running AI provider)
        # result = example_plugin.execute_command("ai-query", ["What is the capital of France?"])
        # print(f"  ai-query: {result}")
        
        # Clean up
        example_plugin.cleanup()
        
        print("\nExample plugin test completed successfully!")
        return 0
        
    except Exception as e:
        print(f"Error testing example plugin: {e}")
        return 1


if __name__ == "__main__":
    exit(main())