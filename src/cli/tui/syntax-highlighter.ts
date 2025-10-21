import { LayoutManager } from './layout-manager';

/**
 * SyntaxHighlighter provides syntax highlighting for commands and code
 */
export class SyntaxHighlighter {
  private layoutManager: LayoutManager;
  private theme: Map<string, string>;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.theme = new Map();

    this.initializeSyntaxTheme();
  }

  private initializeSyntaxTheme(): void {
    // Define syntax highlighting colors
    this.theme.set('keyword', 'yellow');
    this.theme.set('command', 'cyan');
    this.theme.set('slash-command', 'magenta');
    this.theme.set('string', 'green');
    this.theme.set('number', 'blue');
    this.theme.set('comment', 'gray');
    this.theme.set('variable', 'red');
    this.theme.set('function', 'yellow');
    this.theme.set('type', 'cyan');
    this.theme.set('operator', 'white');
    this.theme.set('punctuation', 'white');
    this.theme.set('error', 'red');
    this.theme.set('success', 'green');
    this.theme.set('warning', 'yellow');
    this.theme.set('info', 'blue');
  }

  /**
   * Highlights text based on syntax rules
   */
  public highlightSyntax(
    text: string,
    syntaxType: 'command' | 'code' | 'log' | 'default' = 'default'
  ): string {
    switch (syntaxType) {
      case 'command':
        return this.highlightCommand(text);
      case 'code':
        return this.highlightCode(text);
      case 'log':
        return this.highlightLog(text);
      default:
        return this.highlightDefault(text);
    }
  }

  /**
   * Highlights command-specific syntax
   */
  private highlightCommand(command: string): string {
    let highlighted = command;

    // Highlight slash commands
    highlighted = highlighted.replace(
      /(\/\w+)/g,
      `{${this.theme.get('slash-command')} $1{/${this.theme.get('slash-command')}}`
    );

    // Highlight command options
    highlighted = highlighted.replace(
      /(--?\w+)/g,
      `{${this.theme.get('keyword')} $1{/${this.theme.get('keyword')}}`
    );

    // Highlight string values
    highlighted = highlighted.replace(
      /("[^"]*")/g,
      `{${this.theme.get('string')} $1{/${this.theme.get('string')}}`
    );
    highlighted = highlighted.replace(
      /('[^']*')/g,
      `{${this.theme.get('string')} $1{/${this.theme.get('string')}}`
    );

    // Highlight numbers
    highlighted = highlighted.replace(
      /\b(\d+)\b/g,
      `{${this.theme.get('number')} $1{/${this.theme.get('number')}}`
    );

    // Highlight variables (words starting with $)
    highlighted = highlighted.replace(
      /(\$\w+)/g,
      `{${this.theme.get('variable')} $1{/${this.theme.get('variable')}}`
    );

    return highlighted;
  }

  /**
   * Highlights code syntax
   */
  private highlightCode(code: string): string {
    let highlighted = code;

    // Highlight common programming keywords
    const keywords = [
      'function',
      'class',
      'const',
      'let',
      'var',
      'if',
      'else',
      'for',
      'while',
      'return',
      'import',
      'export',
      'from',
      'as',
      'try',
      'catch',
      'finally',
      'throw',
      'new',
      'this',
      'super',
      'extends',
      'static',
      'async',
      'await',
    ];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      highlighted = highlighted.replace(
        regex,
        `{${this.theme.get('keyword')} ${keyword}{/${this.theme.get('keyword')}}`
      );
    });

    // Highlight functions
    highlighted = highlighted.replace(
      /(\w+)\s*\(/g,
      `{${this.theme.get('function')} $1{/${this.theme.get('function')}}(`
    );

    // Highlight strings
    highlighted = highlighted.replace(
      /("[^"]*")/g,
      `{${this.theme.get('string')} $1{/${this.theme.get('string')}}`
    );
    highlighted = highlighted.replace(
      /('[^']*')/g,
      `{${this.theme.get('string')} $1{/${this.theme.get('string')}}`
    );

    // Highlight template literals
    highlighted = highlighted.replace(
      /(`[^`]*`)/g,
      `{${this.theme.get('string')} $1{/${this.theme.get('string')}}`
    );

    // Highlight numbers
    highlighted = highlighted.replace(
      /\b(\d+\.?\d*)\b/g,
      `{${this.theme.get('number')} $1{/${this.theme.get('number')}}`
    );

    // Highlight comments
    highlighted = highlighted.replace(
      /(\/\/[^\n\r]*)/g,
      `{${this.theme.get('comment')} $1{/${this.theme.get('comment')}}`
    );
    highlighted = highlighted.replace(
      /(\/\*[\s\S]*?\*\/)/g,
      `{${this.theme.get('comment')} $1{/${this.theme.get('comment')}}`
    );

    // Highlight operators
    highlighted = highlighted.replace(
      /(===|==|!=|!==|<=|>=|<|>|\+|-|\*|\/|%|&&|\|\||!)/g,
      `{${this.theme.get('operator')} $1{/${this.theme.get('operator')}}`
    );

    // Highlight punctuation
    highlighted = highlighted.replace(
      /([{}[\]()])/g,
      `{${this.theme.get('punctuation')} $1{/${this.theme.get('punctuation')}}`
    );

    return highlighted;
  }

  /**
   * Highlights log-specific syntax
   */
  private highlightLog(log: string): string {
    let highlighted = log;

    // Highlight timestamps
    highlighted = highlighted.replace(
      /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d{3})/g,
      `{${this.theme.get('info')} $1{/${this.theme.get('info')}}`
    );

    // Highlight log levels
    highlighted = highlighted.replace(
      /(ERROR|FATAL)/gi,
      `{${this.theme.get('error')} $1{/${this.theme.get('error')}}`
    );
    highlighted = highlighted.replace(
      /(WARN|WARNING)/gi,
      `{${this.theme.get('warning')} $1{/${this.theme.get('warning')}}`
    );
    highlighted = highlighted.replace(
      /(INFO|DEBUG)/gi,
      `{${this.theme.get('info')} $1{/${this.theme.get('info')}}`
    );
    highlighted = highlighted.replace(
      /(SUCCESS|OK)/gi,
      `{${this.theme.get('success')} $1{/${this.theme.get('success')}}`
    );

    // Highlight important keywords
    highlighted = highlighted.replace(
      /\b(FAILED|FAILED|SUCCESS|SUCCESSFUL|COMPLETED|DONE)\b/gi,
      `{${this.theme.get('success')} $1{/${this.theme.get('success')}}`
    );

    // Highlight file paths
    highlighted = highlighted.replace(
      /([/\w-]+\.(js|ts|json|txt|log|md))/g,
      `{${this.theme.get('type')} $1{/${this.theme.get('type')}}`
    );

    // Highlight line numbers or IDs
    highlighted = highlighted.replace(
      /(L\d+|ID:\w+)/g,
      `{${this.theme.get('number')} $1{/${this.theme.get('number')}}`
    );

    return highlighted;
  }

  /**
   * Default highlighting (no special syntax)
   */
  private highlightDefault(text: string): string {
    return text; // No highlighting for default
  }

  /**
   * Highlights AI response text
   */
  public highlightAIResponse(response: string): string {
    let highlighted = response;

    // Highlight important sections
    highlighted = highlighted.replace(
      /(Important:|Note:|Warning:|Error:|Success:)/gi,
      `{${this.theme.get('keyword')} $1{/${this.theme.get('keyword')}}`
    );

    // Highlight file paths
    highlighted = highlighted.replace(
      /([/\w-]+\.(js|ts|json|txt|log|md|py|java|cpp|html|css|md))/g,
      `{${this.theme.get('type')} $1{/${this.theme.get('type')}}`
    );

    // Highlight commands that might be suggested
    highlighted = highlighted.replace(
      /(`[^`]+`)/g,
      `{${this.theme.get('command')} $1{/${this.theme.get('command')}}`
    );

    return highlighted;
  }

  /**
   * Updates the color theme
   */
  public updateTheme(themeName: 'dark' | 'light' | 'high-contrast' | 'default'): void {
    switch (themeName) {
      case 'dark':
        this.theme.set('keyword', 'yellow');
        this.theme.set('command', 'cyan');
        this.theme.set('slash-command', 'magenta');
        this.theme.set('string', 'green');
        this.theme.set('number', 'blue');
        this.theme.set('comment', 'gray');
        this.theme.set('variable', 'red');
        this.theme.set('function', 'yellow');
        this.theme.set('type', 'cyan');
        this.theme.set('operator', 'white');
        this.theme.set('punctuation', 'white');
        this.theme.set('error', 'red');
        this.theme.set('success', 'green');
        this.theme.set('warning', 'yellow');
        this.theme.set('info', 'blue');
        break;

      case 'light':
        this.theme.set('keyword', 'navy');
        this.theme.set('command', 'blue');
        this.theme.set('slash-command', 'purple');
        this.theme.set('string', 'green');
        this.theme.set('number', 'darkblue');
        this.theme.set('comment', 'gray');
        this.theme.set('variable', 'red');
        this.theme.set('function', 'orange');
        this.theme.set('type', 'blue');
        this.theme.set('operator', 'black');
        this.theme.set('punctuation', 'black');
        this.theme.set('error', 'darkred');
        this.theme.set('success', 'darkgreen');
        this.theme.set('warning', 'orange');
        this.theme.set('info', 'darkblue');
        break;

      case 'high-contrast':
        this.theme.set('keyword', 'yellow');
        this.theme.set('command', 'cyan');
        this.theme.set('slash-command', 'magenta');
        this.theme.set('string', 'green');
        this.theme.set('number', 'blue');
        this.theme.set('comment', 'white');
        this.theme.set('variable', 'red');
        this.theme.set('function', 'yellow');
        this.theme.set('type', 'cyan');
        this.theme.set('operator', 'white');
        this.theme.set('punctuation', 'white');
        this.theme.set('error', 'red');
        this.theme.set('success', 'green');
        this.theme.set('warning', 'yellow');
        this.theme.set('info', 'blue');
        break;
    }
  }

  /**
   * Gets the current theme
   */
  public getTheme(): Map<string, string> {
    return new Map(this.theme);
  }

  /**
   * Adds a custom syntax rule
   */
  public addSyntaxRule(pattern: RegExp, color: string): void {
    // This would be implemented in a more sophisticated version
    // For now, we'll just store the rule
    console.log(`Added syntax rule: ${pattern} with color ${color}`);
  }
}
