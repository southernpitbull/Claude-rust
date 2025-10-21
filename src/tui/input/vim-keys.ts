/**
 * Vim-style Keybindings
 * Modal editing with normal, insert, and visual modes
 */

import type { Widgets } from 'blessed';
import type { VimMode, VimCommand, VimContext, KeyEvent } from '../types';

/**
 * Vim key handler with modal editing
 */
export class VimKeyHandler {
  private mode: VimMode = 'normal';
  private commands: Map<string, VimCommand[]> = new Map();
  private context: VimContext;
  private screen: Widgets.Screen;
  private commandBuffer: string = '';
  private count: number = 0;
  private register: string | null = null;
  private modeChangeListeners: Set<(mode: VimMode) => void> = new Set();

  constructor(screen: Widgets.Screen) {
    this.screen = screen;
    this.context = {
      mode: 'normal',
      count: 1,
      cursor: { line: 0, column: 0 },
    };

    this.registerDefaultCommands();
  }

  /**
   * Register default Vim commands
   */
  private registerDefaultCommands(): void {
    // Normal mode navigation
    this.register({
      key: 'h',
      mode: 'normal',
      action: (ctx) => this.moveCursor(-1, 0, ctx),
      description: 'Move cursor left',
      repeatable: true,
    });

    this.register({
      key: 'l',
      mode: 'normal',
      action: (ctx) => this.moveCursor(1, 0, ctx),
      description: 'Move cursor right',
      repeatable: true,
    });

    this.register({
      key: 'j',
      mode: 'normal',
      action: (ctx) => this.moveCursor(0, 1, ctx),
      description: 'Move cursor down',
      repeatable: true,
    });

    this.register({
      key: 'k',
      mode: 'normal',
      action: (ctx) => this.moveCursor(0, -1, ctx),
      description: 'Move cursor up',
      repeatable: true,
    });

    this.register({
      key: 'w',
      mode: 'normal',
      action: (ctx) => this.moveWord(1, ctx),
      description: 'Move to next word',
      repeatable: true,
    });

    this.register({
      key: 'b',
      mode: 'normal',
      action: (ctx) => this.moveWord(-1, ctx),
      description: 'Move to previous word',
      repeatable: true,
    });

    this.register({
      key: 'gg',
      mode: 'normal',
      action: (ctx) => this.goToLine(0, ctx),
      description: 'Go to first line',
    });

    this.register({
      key: 'G',
      mode: 'normal',
      action: (ctx) => this.goToEnd(ctx),
      description: 'Go to last line',
    });

    this.register({
      key: '0',
      mode: 'normal',
      action: (ctx) => this.goToLineStart(ctx),
      description: 'Go to line start',
    });

    this.register({
      key: '$',
      mode: 'normal',
      action: (ctx) => this.goToLineEnd(ctx),
      description: 'Go to line end',
    });

    // Mode switching
    this.register({
      key: 'i',
      mode: 'normal',
      action: () => this.setMode('insert'),
      description: 'Enter insert mode',
    });

    this.register({
      key: 'I',
      mode: 'normal',
      action: (ctx) => {
        this.goToLineStart(ctx);
        this.setMode('insert');
      },
      description: 'Insert at line start',
    });

    this.register({
      key: 'a',
      mode: 'normal',
      action: (ctx) => {
        this.moveCursor(1, 0, ctx);
        this.setMode('insert');
      },
      description: 'Append after cursor',
    });

    this.register({
      key: 'A',
      mode: 'normal',
      action: (ctx) => {
        this.goToLineEnd(ctx);
        this.setMode('insert');
      },
      description: 'Append at line end',
    });

    this.register({
      key: 'o',
      mode: 'normal',
      action: (ctx) => this.openLineBelow(ctx),
      description: 'Open line below',
    });

    this.register({
      key: 'O',
      mode: 'normal',
      action: (ctx) => this.openLineAbove(ctx),
      description: 'Open line above',
    });

    this.register({
      key: 'v',
      mode: 'normal',
      action: () => this.setMode('visual'),
      description: 'Enter visual mode',
    });

    this.register({
      key: ':',
      mode: 'normal',
      action: () => this.setMode('command'),
      description: 'Enter command mode',
    });

    // Exit insert mode
    this.register({
      key: 'escape',
      mode: 'insert',
      action: () => this.setMode('normal'),
      description: 'Exit insert mode',
    });

    // Exit visual mode
    this.register({
      key: 'escape',
      mode: 'visual',
      action: () => this.setMode('normal'),
      description: 'Exit visual mode',
    });

    // Exit command mode
    this.register({
      key: 'escape',
      mode: 'command',
      action: () => this.setMode('normal'),
      description: 'Exit command mode',
    });

    // Visual mode commands
    this.register({
      key: 'y',
      mode: 'visual',
      action: (ctx) => {
        this.yankSelection(ctx);
        this.setMode('normal');
      },
      description: 'Yank selection',
    });

    this.register({
      key: 'd',
      mode: 'visual',
      action: (ctx) => {
        this.deleteSelection(ctx);
        this.setMode('normal');
      },
      description: 'Delete selection',
    });

    // Paste
    this.register({
      key: 'p',
      mode: 'normal',
      action: (ctx) => this.paste(ctx),
      description: 'Paste after cursor',
    });

    this.register({
      key: 'P',
      mode: 'normal',
      action: (ctx) => this.pasteBefore(ctx),
      description: 'Paste before cursor',
    });

    // Undo/Redo
    this.register({
      key: 'u',
      mode: 'normal',
      action: () => this.undo(),
      description: 'Undo',
    });

    this.register({
      key: 'C-r',
      mode: 'normal',
      action: () => this.redo(),
      description: 'Redo',
    });

    // Delete
    this.register({
      key: 'x',
      mode: 'normal',
      action: (ctx) => this.deleteChar(ctx),
      description: 'Delete character',
      repeatable: true,
    });

    this.register({
      key: 'dd',
      mode: 'normal',
      action: (ctx) => this.deleteLine(ctx),
      description: 'Delete line',
      repeatable: true,
    });

    // Search
    this.register({
      key: '/',
      mode: 'normal',
      action: () => this.startSearch(),
      description: 'Search forward',
    });

    this.register({
      key: '?',
      mode: 'normal',
      action: () => this.startSearchBackward(),
      description: 'Search backward',
    });

    this.register({
      key: 'n',
      mode: 'normal',
      action: () => this.nextSearchMatch(),
      description: 'Next search match',
    });

    this.register({
      key: 'N',
      mode: 'normal',
      action: () => this.previousSearchMatch(),
      description: 'Previous search match',
    });
  }

  /**
   * Register a command
   */
  public register(command: VimCommand): void {
    const key = `${command.mode}:${command.key}`;
    const existing = this.commands.get(key) ?? [];
    existing.push(command);
    this.commands.set(key, existing);
  }

  /**
   * Unregister a command
   */
  public unregister(mode: VimMode, key: string): void {
    const cmdKey = `${mode}:${key}`;
    this.commands.delete(cmdKey);
  }

  /**
   * Handle key press
   */
  public async handleKey(key: string, ctrl: boolean = false, meta: boolean = false): Promise<void> {
    // Handle count input (numbers in normal mode)
    if (this.mode === 'normal' && /^[0-9]$/.test(key)) {
      this.count = this.count * 10 + parseInt(key, 10);
      return;
    }

    // Build command key
    this.commandBuffer += key;
    const prefix = ctrl ? 'C-' : meta ? 'M-' : '';
    const fullKey = prefix + this.commandBuffer.toLowerCase();

    // Find matching command
    const cmdKey = `${this.mode}:${fullKey}`;
    const commands = this.commands.get(cmdKey);

    if (commands && commands.length > 0) {
      const command = commands[0];
      if (command) {
        // Execute command with count
        this.context.mode = this.mode;
        this.context.count = this.count || 1;

        if (command.repeatable) {
          for (let i = 0; i < this.context.count; i++) {
            await command.action(this.context);
          }
        } else {
          await command.action(this.context);
        }

        // Reset state
        this.commandBuffer = '';
        this.count = 0;
      }
    } else if (!this.isPotentialCommand(fullKey)) {
      // No matching command, reset buffer
      this.commandBuffer = '';
      this.count = 0;
    }
  }

  /**
   * Check if key sequence could be a valid command
   */
  private isPotentialCommand(partial: string): boolean {
    const cmdKey = `${this.mode}:${partial}`;
    for (const key of this.commands.keys()) {
      if (key.startsWith(cmdKey)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get current mode
   */
  public getMode(): VimMode {
    return this.mode;
  }

  /**
   * Set mode
   */
  public setMode(mode: VimMode): void {
    this.mode = mode;
    this.context.mode = mode;
    this.commandBuffer = '';
    this.count = 0;
    this.notifyModeChange();
  }

  /**
   * Listen for mode changes
   */
  public onModeChange(listener: (mode: VimMode) => void): void {
    this.modeChangeListeners.add(listener);
  }

  /**
   * Remove mode change listener
   */
  public offModeChange(listener: (mode: VimMode) => void): void {
    this.modeChangeListeners.delete(listener);
  }

  /**
   * Notify mode change
   */
  private notifyModeChange(): void {
    this.modeChangeListeners.forEach((listener) => listener(this.mode));
  }

  /**
   * Get current context
   */
  public getContext(): VimContext {
    return { ...this.context };
  }

  /**
   * Move cursor
   */
  private moveCursor(dx: number, dy: number, ctx: VimContext): void {
    ctx.cursor.column += dx;
    ctx.cursor.line += dy;
    // Bounds checking would happen in the actual implementation
  }

  /**
   * Move by word
   */
  private moveWord(direction: number, ctx: VimContext): void {
    // Simplified word movement
    ctx.cursor.column += direction * 5;
  }

  /**
   * Go to line
   */
  private goToLine(line: number, ctx: VimContext): void {
    ctx.cursor.line = line;
    ctx.cursor.column = 0;
  }

  /**
   * Go to end
   */
  private goToEnd(ctx: VimContext): void {
    // Would move to last line in actual implementation
    this.goToLine(999999, ctx);
  }

  /**
   * Go to line start
   */
  private goToLineStart(ctx: VimContext): void {
    ctx.cursor.column = 0;
  }

  /**
   * Go to line end
   */
  private goToLineEnd(ctx: VimContext): void {
    // Would move to end of line in actual implementation
    ctx.cursor.column = 999999;
  }

  /**
   * Open line below
   */
  private openLineBelow(ctx: VimContext): void {
    ctx.cursor.line++;
    ctx.cursor.column = 0;
    this.setMode('insert');
  }

  /**
   * Open line above
   */
  private openLineAbove(ctx: VimContext): void {
    ctx.cursor.column = 0;
    this.setMode('insert');
  }

  /**
   * Yank selection (placeholder)
   */
  private yankSelection(ctx: VimContext): void {
    // Placeholder for yank implementation
    console.log('Yank selection', ctx);
  }

  /**
   * Delete selection (placeholder)
   */
  private deleteSelection(ctx: VimContext): void {
    // Placeholder for delete implementation
    console.log('Delete selection', ctx);
  }

  /**
   * Paste (placeholder)
   */
  private paste(ctx: VimContext): void {
    // Placeholder for paste implementation
    console.log('Paste', ctx);
  }

  /**
   * Paste before (placeholder)
   */
  private pasteBefore(ctx: VimContext): void {
    // Placeholder for paste before implementation
    console.log('Paste before', ctx);
  }

  /**
   * Undo (placeholder)
   */
  private undo(): void {
    // Placeholder for undo implementation
    console.log('Undo');
  }

  /**
   * Redo (placeholder)
   */
  private redo(): void {
    // Placeholder for redo implementation
    console.log('Redo');
  }

  /**
   * Delete character (placeholder)
   */
  private deleteChar(ctx: VimContext): void {
    // Placeholder for delete char implementation
    console.log('Delete char', ctx);
  }

  /**
   * Delete line (placeholder)
   */
  private deleteLine(ctx: VimContext): void {
    // Placeholder for delete line implementation
    console.log('Delete line', ctx);
  }

  /**
   * Start search (placeholder)
   */
  private startSearch(): void {
    this.setMode('command');
    console.log('Start search');
  }

  /**
   * Start backward search (placeholder)
   */
  private startSearchBackward(): void {
    this.setMode('command');
    console.log('Start backward search');
  }

  /**
   * Next search match (placeholder)
   */
  private nextSearchMatch(): void {
    console.log('Next search match');
  }

  /**
   * Previous search match (placeholder)
   */
  private previousSearchMatch(): void {
    console.log('Previous search match');
  }

  /**
   * Get all registered commands
   */
  public getCommands(mode?: VimMode): VimCommand[] {
    const commands: VimCommand[] = [];

    this.commands.forEach((cmds, key) => {
      const [cmdMode] = key.split(':');
      if (!mode || cmdMode === mode) {
        commands.push(...cmds);
      }
    });

    return commands;
  }
}
