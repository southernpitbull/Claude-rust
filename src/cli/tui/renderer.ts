import { LayoutManager } from './layout-manager';

/**
 * Renderer class handles the rendering of UI elements
 * and manages the visual representation of the CLI interface
 */
export class Renderer {
  private layoutManager: LayoutManager;
  private elements: Map<string, any> = new Map();

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
  }

  /**
   * Initializes the main screen with default content
   */
  public initMainScreen(): void {
    const mainScreen = this.layoutManager.getMainScreen();

    // Add welcome message
    const welcomeText = {
      top: 1,
      left: 2,
      content:
        'Welcome to AIrchitect CLI!\n\nUse the command prompt below to interact with AI agents.',
      style: {
        fg: 'white',
      },
    };

    const welcomeElement = new (require('blessed').text)(welcomeText);
    mainScreen.append(welcomeElement);
  }

  /**
   * Adds a chat interface to the main screen
   */
  public addChatInterface(): void {
    const mainScreen = this.layoutManager.getMainScreen();

    // Clear main screen
    mainScreen.children = [];

    // Add chat area
    const chatArea = new (require('blessed').box)({
      top: 0,
      left: 0,
      width: '100%',
      height: '70%',
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

    mainScreen.append(chatArea);

    // Add input area
    const inputArea = new (require('blessed').textarea)({
      top: '70%',
      left: 0,
      width: '100%',
      height: '30%',
      border: {
        type: 'line',
      },
      tags: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    mainScreen.append(inputArea);

    // Add scrollable content to chat area
    const scrollableArea = new (require('blessed').scrollabletext)({
      parent: chatArea,
      top: 1,
      left: 1,
      width: '100%-2',
      height: '100%-2',
      content: 'AIrchitect CLI initialized. Ready to assist!\n',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    // Store references to elements
    this.elements.set('chatArea', chatArea);
    this.elements.set('inputArea', inputArea);
    this.elements.set('scrollableArea', scrollableArea);

    // Set focus to input area
    inputArea.focus();
  }

  /**
   * Adds content to the chat area
   */
  public addToChat(content: string, sender: 'user' | 'ai' = 'ai'): void {
    const scrollableArea = this.elements.get('scrollableArea');
    if (scrollableArea) {
      const formattedContent =
        sender === 'user'
          ? `{bold}You:{/bold} ${content}\n`
          : `{bold}AIrchitect:{/bold} ${content}\n`;

      scrollableArea.setContent(scrollableArea.getContent() + formattedContent);
      scrollableArea.setScrollPerc(100); // Auto-scroll to bottom
      this.layoutManager.render();
    }
  }

  /**
   * Updates the input area content
   */
  public updateInput(content: string): void {
    const inputArea = this.elements.get('inputArea');
    if (inputArea) {
      inputArea.setValue(content);
    }
  }

  /**
   * Gets the current input value
   */
  public getInputValue(): string {
    const inputArea = this.elements.get('inputArea');
    if (inputArea) {
      return inputArea.getValue();
    }
    return '';
  }

  /**
   * Clears the chat area
   */
  public clearChat(): void {
    const scrollableArea = this.elements.get('scrollableArea');
    if (scrollableArea) {
      scrollableArea.setContent('');
    }
  }

  /**
   * Renders the current interface
   */
  public render(): void {
    this.layoutManager.render();
  }
}
