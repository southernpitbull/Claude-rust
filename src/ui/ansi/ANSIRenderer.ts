/**
 * ANSIRenderer.ts
 *
 * Provides advanced ANSI terminal rendering capabilities for the AIrchitect CLI.
 * Handles colors, styling, cursor movement, and other terminal control sequences.
 */

import chalk from 'chalk';
import * as supportsColor from 'supports-color';

export interface ANSIStyleOptions {
  color?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  hidden?: boolean;
  strikethrough?: boolean;
}

export interface ANSIColorPalette {
  // Basic ANSI colors
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;

  // Bright ANSI colors
  blackBright: string;
  redBright: string;
  greenBright: string;
  yellowBright: string;
  blueBright: string;
  magentaBright: string;
  cyanBright: string;
  whiteBright: string;

  // 256-color palette
  [index: number]: string;
}

export class ANSIRenderer {
  private static readonly ANSICodes = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    strikethrough: '\x1b[9m',

    // Text colors
    fgBlack: '\x1b[30m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    fgBlue: '\x1b[34m',
    fgMagenta: '\x1b[35m',
    fgCyan: '\x1b[36m',
    fgWhite: '\x1b[37m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',

    // 256-color
    fg256: (n: number) => `\x1b[38;5;${n}m`,
    bg256: (n: number) => `\x1b[48;5;${n}m`,

    // True color (RGB)
    fgRGB: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
    bgRGB: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,
  };

  private colorSupport: boolean;
  private supports256: boolean;
  private supportsTrueColor: boolean;

  constructor() {
    // Detect color support level
    this.colorSupport = supportsColor.stdout !== false;
    this.supports256 = (supportsColor.stdout as any)?.level >= 2 || false;
    this.supportsTrueColor = (supportsColor.stdout as any)?.level >= 3 || false;
  }

  /**
   * Get the current color support level
   */
  public getColorSupportLevel(): number {
    if (this.supportsTrueColor) {
      return 3;
    } // True color (RGB)
    if (this.supports256) {
      return 2;
    } // 256 colors
    if (this.colorSupport) {
      return 1;
    } // Basic ANSI colors
    return 0; // No color support
  }

  /**
   * Apply styling to text using ANSI escape codes
   */
  public applyStyle(text: string, options: ANSIStyleOptions): string {
    if (!this.colorSupport) {
      return text; // Return plain text if no color support
    }

    let styledText = text;

    // Apply text styles
    if (options.bold) {
      styledText = chalk.bold(styledText);
    }
    if (options.italic) {
      styledText = chalk.italic(styledText);
    }
    if (options.underline) {
      styledText = chalk.underline(styledText);
    }
    if (options.inverse) {
      styledText = chalk.inverse(styledText);
    }
    if (options.hidden) {
      styledText = chalk.hidden(styledText);
    }
    if (options.strikethrough) {
      styledText = chalk.strikethrough(styledText);
    }

    // Apply foreground color
    if (options.color) {
      if (this.supports256 && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(options.color)) {
        // Convert hex to RGB and use true color if supported
        const hexColor = options.color.replace('#', '');
        let r, g, b;

        if (hexColor.length === 3) {
          r = parseInt(hexColor[0] + hexColor[0], 16);
          g = parseInt(hexColor[1] + hexColor[1], 16);
          b = parseInt(hexColor[2] + hexColor[2], 16);
        } else {
          r = parseInt(hexColor.substring(0, 2), 16);
          g = parseInt(hexColor.substring(2, 4), 16);
          b = parseInt(hexColor.substring(4, 6), 16);
        }

        styledText = chalk.rgb(r, g, b)(styledText);
      } else if (this.supports256 && chalk[options.color as any]) {
        styledText = chalk[options.color as any](styledText);
      }
    }

    // Apply background color
    if (options.bgColor) {
      const bgColor = `bg${options.bgColor.charAt(0).toUpperCase() + options.bgColor.slice(1)}`;
      if (this.supports256 && (chalk as any)[bgColor as any]) {
        styledText = (chalk as any)[bgColor as any](styledText);
      }
    }

    return styledText;
  }

  /**
   * Render text with basic ANSI color
   */
  public colorize(text: string, color: string): string {
    if (!this.colorSupport) {
      return text;
    }

    switch (color.toLowerCase()) {
      case 'red':
        return chalk.red(text);
      case 'green':
        return chalk.green(text);
      case 'yellow':
        return chalk.yellow(text);
      case 'blue':
        return chalk.blue(text);
      case 'magenta':
        return chalk.magenta(text);
      case 'cyan':
        return chalk.cyan(text);
      case 'white':
        return chalk.white(text);
      case 'gray':
      case 'grey':
        return chalk.gray(text);
      default:
        return text;
    }
  }

  /**
   * Render text with 256-color support
   */
  public colorize256(text: string, colorCode: number): string {
    if (!this.supports256) {
      return text;
    }

    if (colorCode < 0 || colorCode > 255) {
      throw new Error('Color code must be between 0 and 255');
    }

    return chalk.ansi256(colorCode)(text);
  }

  /**
   * Render text with true color (RGB)
   */
  public colorizeRGB(text: string, r: number, g: number, b: number): string {
    if (!this.supportsTrueColor) {
      return text;
    }

    // Validate RGB values
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error('RGB values must be between 0 and 255');
    }

    return chalk.rgb(r, g, b)(text);
  }

  /**
   * Create a gradient text effect
   */
  public gradientText(
    text: string,
    startColor: [number, number, number],
    endColor: [number, number, number]
  ): string {
    if (!this.supportsTrueColor) {
      return text;
    }

    const [r1, g1, b1] = startColor;
    const [r2, g2, b2] = endColor;
    const len = text.length;

    let result = '';
    for (let i = 0; i < len; i++) {
      const ratio = i / Math.max(len - 1, 1);
      const r = Math.round(r1 + (r2 - r1) * ratio);
      const g = Math.round(g1 + (g2 - g1) * ratio);
      const b = Math.round(b1 + (b2 - b1) * ratio);
      result += chalk.rgb(r, g, b)(text[i]);
    }

    return result;
  }

  /**
   * Apply bold formatting
   */
  public bold(text: string): string {
    return chalk.bold(text);
  }

  /**
   * Apply italic formatting
   */
  public italic(text: string): string {
    if (this.supportsTrueColor) {
      // Use true color as a proxy for full ANSI support
      return chalk.italic(text);
    }
    return text; // Italic not widely supported, return as is
  }

  /**
   * Apply underline formatting
   */
  public underline(text: string): string {
    return chalk.underline(text);
  }

  /**
   * Get ANSI code for cursor movement (up n lines)
   */
  public cursorUp(lines: number = 1): string {
    return `\x1b[${lines}A`;
  }

  /**
   * Get ANSI code for cursor movement (down n lines)
   */
  public cursorDown(lines: number = 1): string {
    return `\x1b[${lines}B`;
  }

  /**
   * Get ANSI code for cursor movement (forward n columns)
   */
  public cursorForward(cols: number = 1): string {
    return `\x1b[${cols}C`;
  }

  /**
   * Get ANSI code for cursor movement (backward n columns)
   */
  public cursorBackward(cols: number = 1): string {
    return `\x1b[${cols}D`;
  }

  /**
   * Get ANSI code to move cursor to a specific position
   */
  public cursorTo(x: number, y?: number): string {
    if (y === undefined) {
      return `\x1b[${x}G`; // Move to column x
    }
    return `\x1b[${y + 1};${x + 1}H`; // Move to position (x, y)
  }

  /**
   * Get ANSI code to clear the screen
   */
  public clearScreen(): string {
    return '\x1b[2J\x1b[H'; // Clear screen and move cursor to top-left
  }

  /**
   * Get ANSI code to clear the current line
   */
  public clearLine(): string {
    return '\x1b[2K'; // Clear entire line
  }

  /**
   * Get ANSI code to clear from cursor to end of line
   */
  public clearToLineEnd(): string {
    return '\x1b[K';
  }

  /**
   * Hide cursor
   */
  public hideCursor(): string {
    return '\x1b[?25l';
  }

  /**
   * Show cursor
   */
  public showCursor(): string {
    return '\x1b[?25h';
  }

  /**
   * Save cursor position
   */
  public saveCursor(): string {
    return '\x1b[s';
  }

  /**
   * Restore cursor position
   */
  public restoreCursor(): string {
    return '\x1b[u';
  }

  /**
   * Set terminal title
   */
  public setTerminalTitle(title: string): string {
    return `\x1b]0;${title}\x1b\\`;
  }

  /**
   * Create a progress bar (text-based)
   */
  public progressBar(
    current: number,
    total: number,
    width: number = 40,
    filledChar: string = '█',
    emptyChar: string = '░'
  ): string {
    const percentage = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
    const filledLength = Math.round((current / total) * width);
    const emptyLength = width - filledLength;

    const bar = filledChar.repeat(filledLength) + emptyChar.repeat(emptyLength);
    return `[${bar}] ${percentage}% (${current}/${total})`;
  }

  /**
   * Check if the terminal supports a specific feature
   */
  public supports(feature: 'color' | '256color' | 'truecolor'): boolean {
    switch (feature) {
      case 'color':
        return this.colorSupport;
      case '256color':
        return this.supports256;
      case 'truecolor':
        return this.supportsTrueColor;
      default:
        return false;
    }
  }

  /**
   * Strip ANSI codes from text
   */
  public stripAnsi(text: string): string {
    // Regular expression to match ANSI escape codes
    const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    return text.replace(ansiRegex, '');
  }

  /**
   * Get the visible length of text (excluding ANSI codes)
   */
  public visibleLength(text: string): number {
    return this.stripAnsi(text).length;
  }

  /**
   * Pad text to a specific width, accounting for ANSI codes
   */
  public padText(
    text: string,
    width: number,
    paddingChar: string = ' ',
    align: 'left' | 'right' | 'center' = 'left'
  ): string {
    const visibleLength = this.visibleLength(text);
    const padding = Math.max(0, width - visibleLength);

    if (padding <= 0) {
      return text;
    }

    const paddingStr = paddingChar.repeat(padding);

    switch (align) {
      case 'right':
        return paddingStr + text;
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      default: // left
        return text + paddingStr;
    }
  }
}
