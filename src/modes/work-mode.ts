import * as fs from 'fs/promises';
import * as path from 'path';
import { ModeManager } from './mode-manager';
import { ProjectMemorySystem } from '../memory';

/**
 * Work mode implementation for implementation, modification, and active development
 */
export class WorkMode {
  private modeManager: ModeManager;
  private projectMemory: ProjectMemorySystem;

  constructor(modeManager: ModeManager, projectMemory: ProjectMemorySystem) {
    this.modeManager = modeManager;
    this.projectMemory = projectMemory;
  }

  /**
   * Initialize work mode
   */
  public async initialize(): Promise<void> {
    // Ensure we're in work mode
    await this.modeManager.switchToWorkMode();
  }

  /**
   * Create a new file in the project
   */
  public async createFile(
    filePath: string,
    content: string,
    overwrite: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { success: false, error: 'Must be in work mode to create files' };
    }

    try {
      // Check if file exists and whether we can overwrite
      try {
        await fs.access(filePath);
        if (!overwrite) {
          return { success: false, error: `File already exists: ${filePath}` };
        }
      } catch {
        // File doesn't exist, which is fine
      }

      // Create directory if it doesn't exist
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write the file
      await fs.writeFile(filePath, content, 'utf8');

      // Store file creation in project memory
      await this.projectMemory.storeFileContent(filePath, content, {
        type: 'created-file',
        timestamp: new Date().toISOString(),
        operation: 'create',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Read a file from the project
   */
  public async readFile(
    filePath: string
  ): Promise<{ content: string; success: boolean; error?: string }> {
    try {
      // In work mode, reading is allowed but we can still track it
      const content = await fs.readFile(filePath, 'utf8');

      // Store file access in project memory (only metadata to avoid duplication)
      await this.projectMemory.store(
        `file_access_${Date.now()}`,
        {
          filePath,
          action: 'read',
          timestamp: new Date().toISOString(),
          size: content.length,
        },
        {
          type: 'file-access',
          filePath,
          timestamp: new Date().toISOString(),
        }
      );

      return { content, success: true };
    } catch (error) {
      return { content: '', success: false, error: (error as Error).message };
    }
  }

  /**
   * Update an existing file
   */
  public async updateFile(
    filePath: string,
    content: string,
    mode: 'overwrite' | 'append' | 'prepend' = 'overwrite'
  ): Promise<{ success: boolean; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { success: false, error: 'Must be in work mode to update files' };
    }

    try {
      let newContent = content;

      if (mode !== 'overwrite') {
        const existingContent = await this.readFile(filePath);
        if (!existingContent.success) {
          return existingContent as any;
        }

        if (mode === 'append') {
          newContent = existingContent.content + content;
        } else if (mode === 'prepend') {
          newContent = content + existingContent.content;
        }
      }

      await fs.writeFile(filePath, newContent, 'utf8');

      // Store file update in project memory
      await this.projectMemory.storeFileContent(filePath, newContent, {
        type: 'updated-file',
        timestamp: new Date().toISOString(),
        operation: mode,
        originalSize: (await this.readFile(filePath)).content.length,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a file from the project
   */
  public async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { success: false, error: 'Must be in work mode to delete files' };
    }

    try {
      await fs.unlink(filePath);

      // Store file deletion in project memory
      await this.projectMemory.store(
        `file_deletion_${Date.now()}`,
        {
          filePath,
          timestamp: new Date().toISOString(),
          operation: 'delete',
        },
        {
          type: 'file-deletion',
          filePath,
          timestamp: new Date().toISOString(),
        }
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Generate code for a given requirement
   */
  public async generateCode(
    requirement: string,
    filePath: string,
    language: string = 'typescript'
  ): Promise<{ code: string; success: boolean; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { code: '', success: false, error: 'Must be in work mode to generate code' };
    }

    try {
      // In a real implementation, this would use an AI model to generate code
      // For now, we'll return a simple placeholder
      const code = `// Generated code for: ${requirement}\n\nconsole.log('Implementation for: ${requirement}');\n`;

      // Create or update the file with generated code
      const result = await this.createFile(filePath, code, true);

      if (result.success) {
        return { code, success: true };
      } else {
        return { code: '', success: false, error: result.error };
      }
    } catch (error) {
      return { code: '', success: false, error: (error as Error).message };
    }
  }

  /**
   * Execute a shell command safely
   */
  public async executeCommand(
    command: string,
    workingDirectory?: string
  ): Promise<{ output: string; success: boolean; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { output: '', success: false, error: 'Must be in work mode to execute commands' };
    }

    try {
      // In a real implementation, this would execute the command safely
      // For security reasons, we'll return a simulated response
      // A real implementation would use child_process with proper sandboxing
      const simulatedOutput = `Command executed: ${command}\n[Simulated output - Real implementation would execute this command safely]`;

      // Store command execution in project memory
      await this.projectMemory.store(
        `command_execution_${Date.now()}`,
        {
          command,
          workingDirectory: workingDirectory || process.cwd(),
          timestamp: new Date().toISOString(),
          simulated: true,
        },
        {
          type: 'command-execution',
          timestamp: new Date().toISOString(),
        }
      );

      return { output: simulatedOutput, success: true };
    } catch (error) {
      return { output: '', success: false, error: (error as Error).message };
    }
  }

  /**
   * Run tests in the project
   */
  public async runTests(testPattern?: string): Promise<{
    results: { passed: number; failed: number; skipped: number };
    output: string;
    success: boolean;
    error?: string;
  }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return {
        results: { passed: 0, failed: 0, skipped: 0 },
        output: '',
        success: false,
        error: 'Must be in work mode to run tests',
      };
    }

    try {
      // In a real implementation, this would run actual tests
      // For now, we'll return a simulated result
      const results = {
        passed: 5,
        failed: 0,
        skipped: 0,
      };

      const output = `Test Results:\nPassed: ${results.passed}\nFailed: ${results.failed}\nSkipped: ${results.skipped}\n\n[Simulated test output - Real implementation would run actual tests]`;

      // Store test execution in project memory
      await this.projectMemory.store(
        `test_execution_${Date.now()}`,
        {
          testPattern: testPattern || 'all',
          results,
          timestamp: new Date().toISOString(),
          simulated: true,
        },
        {
          type: 'test-execution',
          timestamp: new Date().toISOString(),
        }
      );

      return { results, output, success: true };
    } catch (error) {
      return {
        results: { passed: 0, failed: 0, skipped: 0 },
        output: '',
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Build the project
   */
  public async buildProject(): Promise<{ success: boolean; output: string; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { success: false, output: '', error: 'Must be in work mode to build project' };
    }

    try {
      // In a real implementation, this would run actual build commands
      // For now, we'll return a simulated result
      const output = `Building project...\n✓ Dependencies resolved\n✓ Source files compiled\n✓ Bundle created\n\n[Simulated build output - Real implementation would run actual build process]`;

      // Store build execution in project memory
      await this.projectMemory.store(
        `build_execution_${Date.now()}`,
        {
          timestamp: new Date().toISOString(),
          simulated: true,
        },
        {
          type: 'build-execution',
          timestamp: new Date().toISOString(),
        }
      );

      return { success: true, output };
    } catch (error) {
      return { success: false, output: '', error: (error as Error).message };
    }
  }

  /**
   * Deploy the project (simulated)
   */
  public async deployProject(
    environment: 'development' | 'staging' | 'production'
  ): Promise<{ success: boolean; output: string; error?: string }> {
    // Verify we're in work mode
    if (this.modeManager.getCurrentMode() !== 'work') {
      return { success: false, output: '', error: 'Must be in work mode to deploy project' };
    }

    try {
      // In a real implementation, this would perform actual deployment
      // For now, we'll return a simulated result
      const output = `Deploying to ${environment} environment...\n✓ Build artifacts verified\n✓ Environment configured\n✓ Deployment completed\n\n[Simulated deployment output - Real implementation would perform actual deployment]`;

      // Store deployment in project memory
      await this.projectMemory.store(
        `deployment_${Date.now()}`,
        {
          environment,
          timestamp: new Date().toISOString(),
          simulated: true,
        },
        {
          type: 'deployment',
          environment,
          timestamp: new Date().toISOString(),
        }
      );

      return { success: true, output };
    } catch (error) {
      return { success: false, output: '', error: (error as Error).message };
    }
  }

  /**
   * Get work-specific recommendations
   */
  public getWorkRecommendations(): string[] {
    return [
      'Follow established coding standards and conventions',
      'Write comprehensive tests for all new functionality',
      'Keep commits small and focused on single changes',
      'Update documentation as you implement features',
      'Run tests before committing changes',
      'Consider performance implications of your implementations',
      'Review code with team members when possible',
    ];
  }

  /**
   * Get the current working directory
   */
  public getCurrentDirectory(): string {
    return process.cwd();
  }

  /**
   * List files in a directory
   */
  public async listDirectory(
    dirPath: string
  ): Promise<{ files: string[]; directories: string[]; success: boolean; error?: string }> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      const files = items
        .filter((item) => item.isFile())
        .map((item) => path.join(dirPath, item.name));

      const directories = items
        .filter((item) => item.isDirectory())
        .map((item) => path.join(dirPath, item.name));

      return { files, directories, success: true };
    } catch (error) {
      return { files: [], directories: [], success: false, error: (error as Error).message };
    }
  }

  /**
   * Search for code in the project
   */
  public async searchCode(query: string, filePath?: string): Promise<string[]> {
    // In work mode, search through actual project files
    try {
      // This would perform actual code search in the project
      // For now, we'll return results from project memory
      const results = await this.projectMemory.query(query, { maxResults: 10 });
      return results.map((r) => r.content);
    } catch (error) {
      console.error('Error searching code:', error);
      return [];
    }
  }
}
