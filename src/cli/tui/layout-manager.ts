import { screen, element, box, text, line, grid } from 'blessed';

/**
 * LayoutManager handles the arrangement of UI elements in the TUI
 * with header, main screen, and footer sections
 */
export class LayoutManager {
  protected screen: any;
  protected header: any;
  protected mainScreen: any;
  protected footer: any;
  protected elements: Map<string, any> = new Map();

  constructor() {
    this.screen = screen({
      smartCSR: true,
      title: 'AIrchitect CLI',
      fullUnicode: true,
    });

    this.initLayout();
    this.setupEventHandlers();
  }

  private initLayout(): void {
    // Header section - 3 lines tall
    this.header = box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Main screen section - fills remaining space
    this.mainScreen = box({
      top: 3,
      left: 0,
      width: '100%',
      height: 'shrink',
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Footer section - 3 lines tall
    this.footer = box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Add elements to screen
    this.screen.append(this.header);
    this.screen.append(this.mainScreen);
    this.screen.append(this.footer);

    // Add title to header
    const title = text({
      top: 1,
      left: 2,
      content: '{bold}AIrchitect CLI{/bold} - v1.0.0',
      style: {
        fg: 'yellow',
      },
    });
    this.header.append(title);

    // Add status info to header
    const status = text({
      top: 1,
      right: 2,
      content: 'Provider: OpenAI | Mode: Planning',
      style: {
        fg: 'green',
      },
    });
    this.header.append(status);

    // Add instructions to footer
    const instructions = text({
      top: 1,
      left: 2,
      content: '↑↓ Navigate | Tab: Switch | Ctrl+C: Exit',
      style: {
        fg: 'white',
      },
    });
    this.footer.append(instructions);

    // Add mode indicator to footer
    const modeIndicator = text({
      top: 1,
      right: 2,
      content: '{blue-bg} Planning Mode {/blue-bg}',
      style: {
        fg: 'white',
      },
    });
    this.footer.append(modeIndicator);
  }

  private setupEventHandlers(): void {
    // Handle screen resize
    this.screen.on('resize', () => {
      this.screen.render();
    });

    // Handle key events
    this.screen.key(['escape', 'q', 'C-c'], () => {
      process.exit(0);
    });
  }

  /**
   * Renders the current layout to the terminal
   */
  public render(): void {
    this.screen.render();
  }

  /**
   * Gets the main screen element for adding content
   */
  public getMainScreen(): any {
    return this.mainScreen;
  }

  /**
   * Gets the header element
   */
  public getHeader(): any {
    return this.header;
  }

  /**
   * Gets the footer element
   */
  public getFooter(): any {
    return this.footer;
  }

  /**
   * Updates the header status information
   */
  public updateHeaderStatus(status: string): void {
    // Remove existing status element
    this.header.removeByName('status');

    const statusElement = text({
      name: 'status',
      top: 1,
      right: 2,
      content: status,
      style: {
        fg: 'green',
      },
    });

    this.header.append(statusElement);
    this.screen.render();
  }

  /**
   * Updates the mode indicator in the footer
   */
  public updateModeIndicator(mode: string): void {
    // Remove existing mode element
    this.footer.removeByName('mode');

    const modeElement = text({
      name: 'mode',
      top: 1,
      right: 2,
      content:
        mode === 'work' ? '{red-bg} Work Mode {/red-bg}' : '{blue-bg} Planning Mode {/blue-bg}',
      style: {
        fg: 'white',
      },
    });

    this.footer.append(modeElement);
    this.screen.render();
  }
}
