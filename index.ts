#!/usr/bin/env node

/**
 * AIrchitect CLI - Main Entry Point
 * 
 * This is the main entry point for the TypeScript portion of the AIrchitect CLI system.
 * It coordinates the various components including the TUI, AI providers, agents,
 * credential management, and project memory.
 */

import { Command } from 'commander';
import { TUIManager } from './src/tui/TUIManager';

// Create the main program instance
const program = new Command();

// Configure the main CLI program
program
  .name('ai-cli')
  .description('AIrchitect CLI - Advanced AI-powered development tool')
  .version('1.0.0');

// Add the main commands
program
  .command('chat')
  .description('Start an interactive AI chat session')
  .option('-p, --provider <provider>', 'AI provider to use', 'openai')
  .option('-m, --model <model>', 'Model to use')
  .action(async (options) => {
    console.log(`Starting chat session with provider: ${options.provider}`);
    const tui = new TUIManager();
    await tui.startChatMode(options);
  });

program
  .command('plan')
  .description('Start a planning session')
  .action(async () => {
    console.log('Starting planning session');
    const tui = new TUIManager();
    await tui.startPlanningMode();
  });

program
  .command('work')
  .description('Start a work session')
  .action(async () => {
    console.log('Starting work session');
    const tui = new TUIManager();
    await tui.startWorkMode();
  });

program
  .command('agents')
  .description('Manage intelligent agents')
  .action(async () => {
    console.log('Managing agents');
    const tui = new TUIManager();
    await tui.showAgentManagement();
  });

program
  .command('providers')
  .description('List available AI providers')
  .action(async () => {
    console.log('Listing AI providers');
    // For now, just list the providers
    console.log('Available providers: openai, anthropic, google');
  });

// Parse the command line arguments
program.parse(process.argv);

// Default action if no command is provided
if (!process.argv.slice(2).length) {
  // Start the main TUI by default
  console.log('Starting AIrchitect CLI...');
  const tui = new TUIManager();
  tui.start();
}