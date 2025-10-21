/**
 * Renderer
 * Character rendering with Unicode support and colors
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { RendererOptions, AnimationFrame, AnimationOptions, Color } from './types';
import { getThemeManager } from './theme';

/**
 * Terminal renderer with advanced features
 */
export class Renderer {
  private screen: Widgets.Screen;
  private options: Required<RendererOptions>;
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private activeAnimations: Map<string, AnimationState> = new Map();
  private renderLoop: NodeJS.Timeout | null = null;

  constructor(screen: Widgets.Screen, options?: RendererOptions) {
    this.screen = screen;
    this.options = {
      fps: options?.fps ?? 30,
      doubleBuffering: options?.doubleBuffering ?? true,
      unicode: options?.unicode ?? true,
      colors: options?.colors ?? 16,
      cursor: options?.cursor ?? true,
    };

    this.startRenderLoop();
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    const frameTime = 1000 / this.options.fps;
    this.renderLoop = setInterval(() => {
      this.updateAnimations();
    }, frameTime);
  }

  /**
   * Stop the render loop
   */
  private stopRenderLoop(): void {
    if (this.renderLoop) {
      clearInterval(this.renderLoop);
      this.renderLoop = null;
    }
  }

  /**
   * Render the screen
   */
  public render(): void {
    const now = Date.now();
    const delta = now - this.lastFrameTime;

    if (delta >= 1000 / this.options.fps) {
      this.screen.render();
      this.frameCount++;
      this.lastFrameTime = now;
    }
  }

  /**
   * Force render immediately
   */
  public forceRender(): void {
    this.screen.render();
    this.frameCount++;
    this.lastFrameTime = Date.now();
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return this.options.fps;
  }

  /**
   * Set target FPS
   */
  public setFPS(fps: number): void {
    this.options.fps = fps;
    this.stopRenderLoop();
    this.startRenderLoop();
  }

  /**
   * Get frame count
   */
  public getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Reset frame counter
   */
  public resetFrameCount(): void {
    this.frameCount = 0;
    this.lastFrameTime = Date.now();
  }

  /**
   * Create a spinner animation
   */
  public createSpinner(
    type: 'dots' | 'line' | 'star' | 'circle' | 'box' = 'dots'
  ): AnimationFrame[] {
    const spinners: Record<string, string[]> = {
      dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      line: ['|', '/', '-', '\\'],
      star: ['✶', '✸', '✹', '✺', '✹', '✸'],
      circle: ['◐', '◓', '◑', '◒'],
      box: ['◰', '◳', '◲', '◱'],
    };

    const frames = spinners[type] ?? spinners.dots;
    return frames.map((content) => ({
      content,
      duration: 100,
    }));
  }

  /**
   * Create a progress bar
   */
  public createProgressBar(width: number, value: number, max: number): string {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const filled = Math.floor((width * percentage) / 100);
    const empty = width - filled;

    const theme = getThemeManager();
    const color = theme.getColor('primary');

    const filledChar = '█';
    const emptyChar = '░';

    return `{${color}-fg}${filledChar.repeat(filled)}{/${color}-fg}${emptyChar.repeat(empty)}`;
  }

  /**
   * Create an indeterminate progress bar
   */
  public createIndeterminateProgress(width: number, position: number): string {
    const blockWidth = Math.floor(width / 4);
    const pos = position % (width + blockWidth);

    const theme = getThemeManager();
    const color = theme.getColor('primary');

    const chars = new Array(width).fill('░');
    for (let i = 0; i < blockWidth && pos - i >= 0 && pos - i < width; i++) {
      chars[pos - i] = '█';
    }

    return `{${color}-fg}${chars.join('')}{/${color}-fg}`;
  }

  /**
   * Start an animation
   */
  public startAnimation(id: string, options: AnimationOptions): void {
    const state: AnimationState = {
      frames: options.frames,
      currentFrame: 0,
      loop: options.loop ?? true,
      onComplete: options.onComplete,
      startTime: Date.now(),
      lastFrameTime: Date.now(),
    };

    this.activeAnimations.set(id, state);
  }

  /**
   * Stop an animation
   */
  public stopAnimation(id: string): void {
    this.activeAnimations.delete(id);
  }

  /**
   * Get current animation frame
   */
  public getAnimationFrame(id: string): string | null {
    const state = this.activeAnimations.get(id);
    if (!state) {return null;}

    const frame = state.frames[state.currentFrame];
    return frame?.content ?? null;
  }

  /**
   * Update all active animations
   */
  private updateAnimations(): void {
    const now = Date.now();

    this.activeAnimations.forEach((state, id) => {
      const currentFrame = state.frames[state.currentFrame];
      if (!currentFrame) {return;}

      if (now - state.lastFrameTime >= currentFrame.duration) {
        state.currentFrame++;

        if (state.currentFrame >= state.frames.length) {
          if (state.loop) {
            state.currentFrame = 0;
          } else {
            state.onComplete?.();
            this.activeAnimations.delete(id);
            return;
          }
        }

        state.lastFrameTime = now;
      }
    });
  }

  /**
   * Draw a box with Unicode characters
   */
  public drawBox(
    x: number,
    y: number,
    width: number,
    height: number,
    style: 'single' | 'double' | 'rounded' | 'bold' = 'single'
  ): string {
    const boxes: Record<string, BoxChars> = {
      single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
      double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
      rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
      bold: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
    };

    const chars = boxes[style] ?? boxes.single;
    const lines: string[] = [];

    // Top line
    lines.push(chars.tl + chars.h.repeat(width - 2) + chars.tr);

    // Middle lines
    for (let i = 0; i < height - 2; i++) {
      lines.push(chars.v + ' '.repeat(width - 2) + chars.v);
    }

    // Bottom line
    lines.push(chars.bl + chars.h.repeat(width - 2) + chars.br);

    return lines.join('\n');
  }

  /**
   * Apply color to text
   */
  public colorize(text: string, fg?: Color, bg?: Color): string {
    let result = text;
    if (fg) {
      result = `{${fg}-fg}${result}{/${fg}-fg}`;
    }
    if (bg) {
      result = `{${bg}-bg}${result}{/${bg}-bg}`;
    }
    return result;
  }

  /**
   * Apply style to text
   */
  public stylize(
    text: string,
    options: {
      bold?: boolean;
      underline?: boolean;
      blink?: boolean;
      inverse?: boolean;
    }
  ): string {
    let result = text;

    if (options.bold) {
      result = `{bold}${result}{/bold}`;
    }
    if (options.underline) {
      result = `{underline}${result}{/underline}`;
    }
    if (options.blink) {
      result = `{blink}${result}{/blink}`;
    }
    if (options.inverse) {
      result = `{inverse}${result}{/inverse}`;
    }

    return result;
  }

  /**
   * Create a table with Unicode box drawing
   */
  public drawTable(headers: string[], rows: string[][], columnWidths?: number[]): string {
    const widths =
      columnWidths ??
      headers.map((h, i) => {
        const maxContent = Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0));
        return maxContent + 2; // Add padding
      });

    const lines: string[] = [];

    // Top border
    lines.push('┌' + widths.map((w) => '─'.repeat(w)).join('┬') + '┐');

    // Headers
    const headerRow = headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join('│');
    lines.push('│' + headerRow + '│');

    // Header separator
    lines.push('├' + widths.map((w) => '─'.repeat(w)).join('┼') + '┤');

    // Rows
    rows.forEach((row, index) => {
      const rowStr = row.map((cell, i) => (cell ?? '').padEnd(widths[i] ?? 0)).join('│');
      lines.push('│' + rowStr + '│');

      if (index < rows.length - 1) {
        lines.push('├' + widths.map((w) => '─'.repeat(w)).join('┼') + '┤');
      }
    });

    // Bottom border
    lines.push('└' + widths.map((w) => '─'.repeat(w)).join('┴') + '┘');

    return lines.join('\n');
  }

  /**
   * Truncate text with ellipsis
   */
  public truncate(text: string, maxLength: number, ellipsis: string = '…'): string {
    if (text.length <= maxLength) {return text;}
    return text.slice(0, maxLength - ellipsis.length) + ellipsis;
  }

  /**
   * Wrap text to specified width
   */
  public wrap(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length > width) {
        if (currentLine) {
          lines.push(currentLine.trim());
        }
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine) {
      lines.push(currentLine.trim());
    }

    return lines;
  }

  /**
   * Align text
   */
  public align(
    text: string,
    width: number,
    alignment: 'left' | 'center' | 'right' = 'left'
  ): string {
    if (text.length >= width) {return text;}

    const padding = width - text.length;

    switch (alignment) {
      case 'left':
        return text + ' '.repeat(padding);
      case 'right':
        return ' '.repeat(padding) + text;
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      default:
        return text;
    }
  }

  /**
   * Get screen instance
   */
  public getScreen(): Widgets.Screen {
    return this.screen;
  }

  /**
   * Destroy the renderer
   */
  public destroy(): void {
    this.stopRenderLoop();
    this.activeAnimations.clear();
  }
}

/**
 * Animation state
 */
interface AnimationState {
  frames: AnimationFrame[];
  currentFrame: number;
  loop: boolean;
  onComplete?: () => void;
  startTime: number;
  lastFrameTime: number;
}

/**
 * Box drawing characters
 */
interface BoxChars {
  tl: string; // top-left
  tr: string; // top-right
  bl: string; // bottom-left
  br: string; // bottom-right
  h: string; // horizontal
  v: string; // vertical
}

/**
 * Create a default renderer instance
 */
export function createRenderer(options?: RendererOptions): Renderer {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    title: 'AIrchitect CLI',
    cursor: {
      artificial: true,
      shape: 'line',
      blink: true,
      color: null,
    },
  });

  return new Renderer(screen, options);
}
