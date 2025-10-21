/**
 * Keyboard Event Handler
 * Central keyboard input management system
 */

import type { Widgets } from 'blessed';
import type { KeyEvent } from '../types';
import { VimKeyHandler } from './vim-keys';

/**
 * Key binding definition
 */
export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: (event: KeyEvent) => void | Promise<void>;
  description?: string;
  global?: boolean;
}

/**
 * Keyboard manager
 */
export class KeyboardManager {
  private screen: Widgets.Screen;
  private bindings: Map<string, KeyBinding[]> = new Map();
  private vimHandler: VimKeyHandler | null = null;
  private vimMode: boolean = false;
  private enabled: boolean = true;
  private keyPressHandler: ((ch: string, key: Widgets.Events.IKeyEventArg) => void) | null = null;

  constructor(screen: Widgets.Screen, useVimMode: boolean = false) {
    this.screen = screen;
    this.vimMode = useVimMode;

    if (useVimMode) {
      this.vimHandler = new VimKeyHandler(screen);
    }

    this.setupKeyHandler();
    this.registerDefaultBindings();
  }

  /**
   * Setup key press handler
   */
  private setupKeyHandler(): void {
    this.keyPressHandler = async (ch: string, key: Widgets.Events.IKeyEventArg) => {
      if (!this.enabled) {return;}

      const keyEvent: KeyEvent = {
        name: key.name,
        full: key.full,
        sequence: key.sequence,
        ctrl: key.ctrl ?? false,
        meta: key.meta ?? false,
        shift: key.shift ?? false,
      };

      // Handle Vim mode
      if (this.vimMode && this.vimHandler) {
        await this.vimHandler.handleKey(key.name, key.ctrl, key.meta);
      } else {
        // Handle normal key bindings
        await this.handleKeyEvent(keyEvent);
      }
    };

    this.screen.on('keypress', this.keyPressHandler);
  }

  /**
   * Handle key event
   */
  private async handleKeyEvent(event: KeyEvent): Promise<void> {
    const bindingKey = this.createBindingKey(event);
    const bindings = this.bindings.get(bindingKey);

    if (bindings && bindings.length > 0) {
      for (const binding of bindings) {
        if (this.matchesBinding(event, binding)) {
          await binding.handler(event);
        }
      }
    }

    // Also check for global bindings
    const globalBindings = this.bindings.get('*');
    if (globalBindings) {
      for (const binding of globalBindings) {
        if (binding.global && this.matchesBinding(event, binding)) {
          await binding.handler(event);
        }
      }
    }
  }

  /**
   * Create binding key from event
   */
  private createBindingKey(event: KeyEvent): string {
    const parts: string[] = [];
    if (event.ctrl) {parts.push('C');}
    if (event.meta) {parts.push('M');}
    if (event.shift) {parts.push('S');}
    parts.push(event.name);
    return parts.join('-');
  }

  /**
   * Check if event matches binding
   */
  private matchesBinding(event: KeyEvent, binding: KeyBinding): boolean {
    if (event.name !== binding.key) {return false;}
    if (binding.ctrl && !event.ctrl) {return false;}
    if (binding.meta && !event.meta) {return false;}
    if (binding.shift && !event.shift) {return false;}
    return true;
  }

  /**
   * Register a key binding
   */
  public bind(binding: KeyBinding): void {
    const key = binding.global ? '*' : this.createBindingKeyFromBinding(binding);
    const existing = this.bindings.get(key) ?? [];
    existing.push(binding);
    this.bindings.set(key, existing);
  }

  /**
   * Unregister a key binding
   */
  public unbind(key: string, ctrl?: boolean, meta?: boolean, shift?: boolean): void {
    const bindingKey = this.createBindingKeyFromParts(key, ctrl, meta, shift);
    this.bindings.delete(bindingKey);
  }

  /**
   * Create binding key from binding
   */
  private createBindingKeyFromBinding(binding: KeyBinding): string {
    return this.createBindingKeyFromParts(binding.key, binding.ctrl, binding.meta, binding.shift);
  }

  /**
   * Create binding key from parts
   */
  private createBindingKeyFromParts(
    key: string,
    ctrl?: boolean,
    meta?: boolean,
    shift?: boolean
  ): string {
    const parts: string[] = [];
    if (ctrl) {parts.push('C');}
    if (meta) {parts.push('M');}
    if (shift) {parts.push('S');}
    parts.push(key);
    return parts.join('-');
  }

  /**
   * Register default bindings
   */
  private registerDefaultBindings(): void {
    // Quit
    this.bind({
      key: 'q',
      ctrl: true,
      handler: () => {
        this.screen.destroy();
        process.exit(0);
      },
      description: 'Quit application',
      global: true,
    });

    // Cancel/Escape
    this.bind({
      key: 'escape',
      handler: () => {
        // Handled by individual components
      },
      description: 'Cancel/escape',
      global: true,
    });

    // Tab navigation
    this.bind({
      key: 'tab',
      handler: () => {
        this.screen.focusNext();
        this.screen.render();
      },
      description: 'Focus next element',
      global: true,
    });

    this.bind({
      key: 'tab',
      shift: true,
      handler: () => {
        this.screen.focusPrevious();
        this.screen.render();
      },
      description: 'Focus previous element',
      global: true,
    });

    // Refresh screen
    this.bind({
      key: 'l',
      ctrl: true,
      handler: () => {
        this.screen.alloc();
        this.screen.realloc();
        this.screen.render();
      },
      description: 'Refresh screen',
      global: true,
    });
  }

  /**
   * Enable Vim mode
   */
  public enableVimMode(): void {
    if (!this.vimHandler) {
      this.vimHandler = new VimKeyHandler(this.screen);
    }
    this.vimMode = true;
  }

  /**
   * Disable Vim mode
   */
  public disableVimMode(): void {
    this.vimMode = false;
  }

  /**
   * Check if Vim mode is enabled
   */
  public isVimModeEnabled(): boolean {
    return this.vimMode;
  }

  /**
   * Get Vim handler
   */
  public getVimHandler(): VimKeyHandler | null {
    return this.vimHandler;
  }

  /**
   * Enable keyboard input
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Disable keyboard input
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Check if keyboard input is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get all bindings
   */
  public getBindings(): KeyBinding[] {
    const allBindings: KeyBinding[] = [];
    this.bindings.forEach((bindings) => {
      allBindings.push(...bindings);
    });
    return allBindings;
  }

  /**
   * Clear all bindings
   */
  public clearBindings(): void {
    this.bindings.clear();
    this.registerDefaultBindings();
  }

  /**
   * Print key bindings help
   */
  public getHelpText(): string {
    const bindings = this.getBindings();
    const lines: string[] = ['Keyboard Shortcuts:', ''];

    bindings.forEach((binding) => {
      if (binding.description) {
        const parts: string[] = [];
        if (binding.ctrl) {parts.push('Ctrl');}
        if (binding.meta) {parts.push('Alt');}
        if (binding.shift) {parts.push('Shift');}
        parts.push(binding.key.toUpperCase());

        const keyStr = parts.join('+');
        lines.push(`  ${keyStr.padEnd(20)} - ${binding.description}`);
      }
    });

    return lines.join('\n');
  }

  /**
   * Destroy keyboard manager
   */
  public destroy(): void {
    if (this.keyPressHandler) {
      this.screen.off('keypress', this.keyPressHandler);
      this.keyPressHandler = null;
    }
    this.bindings.clear();
  }
}

/**
 * Key sequence recorder
 */
export class KeySequenceRecorder {
  private recording: boolean = false;
  private sequence: KeyEvent[] = [];
  private maxLength: number = 100;

  /**
   * Start recording
   */
  public start(): void {
    this.recording = true;
    this.sequence = [];
  }

  /**
   * Stop recording
   */
  public stop(): void {
    this.recording = false;
  }

  /**
   * Record a key event
   */
  public record(event: KeyEvent): void {
    if (!this.recording) {return;}

    this.sequence.push(event);

    if (this.sequence.length > this.maxLength) {
      this.sequence.shift();
    }
  }

  /**
   * Get recorded sequence
   */
  public getSequence(): KeyEvent[] {
    return [...this.sequence];
  }

  /**
   * Clear sequence
   */
  public clear(): void {
    this.sequence = [];
  }

  /**
   * Get sequence as string
   */
  public toString(): string {
    return this.sequence
      .map((event) => {
        const parts: string[] = [];
        if (event.ctrl) {parts.push('C');}
        if (event.meta) {parts.push('M');}
        if (event.shift) {parts.push('S');}
        parts.push(event.name);
        return parts.join('-');
      })
      .join(' ');
  }

  /**
   * Check if recording
   */
  public isRecording(): boolean {
    return this.recording;
  }
}

/**
 * Create keyboard manager
 */
export function createKeyboardManager(
  screen: Widgets.Screen,
  useVimMode: boolean = false
): KeyboardManager {
  return new KeyboardManager(screen, useVimMode);
}
