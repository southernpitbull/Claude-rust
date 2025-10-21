import { LayoutManager } from './layout-manager';

/**
 * NavigationHandler manages navigation between different
 * views and tabs within the TUI interface
 */
export class NavigationHandler {
  private layoutManager: LayoutManager;
  private activeView: string;
  private viewStack: string[];
  private availableViews: Map<string, any>;
  private keyHandlers: Map<string, () => void>;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.activeView = 'chat';
    this.viewStack = ['chat'];
    this.availableViews = new Map();
    this.keyHandlers = new Map();

    this.initializeViews();
    this.setupKeyHandlers();
    this.setupNavigation();
  }

  private initializeViews(): void {
    // Define available views
    this.availableViews.set('chat', { name: 'Chat', description: 'AI conversation interface' });
    this.availableViews.set('files', { name: 'Files', description: 'File browser and editor' });
    this.availableViews.set('agents', { name: 'Agents', description: 'AI agent management' });
    this.availableViews.set('providers', {
      name: 'Providers',
      description: 'AI provider configuration',
    });
    this.availableViews.set('settings', { name: 'Settings', description: 'Application settings' });
    this.availableViews.set('history', { name: 'History', description: 'Command history' });
    this.availableViews.set('status', { name: 'Status', description: 'System status and metrics' });
  }

  private setupKeyHandlers(): void {
    // Set up default navigation key handlers
    this.keyHandlers.set('tab', () => this.switchToNextView());
    this.keyHandlers.set('S-tab', () => this.switchToPrevView());
    this.keyHandlers.set('C-left', () => this.goBack());
    this.keyHandlers.set('C-right', () => this.goForward());
  }

  private setupNavigation(): void {
    // Add navigation indicators to footer
    this.updateFooterNavigation();
  }

  /**
   * Switches to the next available view
   */
  public switchToNextView(): void {
    const views = Array.from(this.availableViews.keys());
    const currentIndex = views.indexOf(this.activeView);
    const nextIndex = (currentIndex + 1) % views.length;
    const nextView = views[nextIndex];

    this.setView(nextView);
  }

  /**
   * Switches to the previous available view
   */
  public switchToPrevView(): void {
    const views = Array.from(this.availableViews.keys());
    const currentIndex = views.indexOf(this.activeView);
    const prevIndex = (currentIndex - 1 + views.length) % views.length;
    const prevView = views[prevIndex];

    this.setView(prevView);
  }

  /**
   * Navigates back to the previous view in the stack
   */
  public goBack(): void {
    if (this.viewStack.length > 1) {
      this.viewStack.pop(); // Remove current view
      const previousView = this.viewStack[this.viewStack.length - 1];
      this.setView(previousView, false); // Don't add to stack again
    }
  }

  /**
   * Goes forward in navigation history (if implemented)
   */
  public goForward(): void {
    // For now, we'll just go back to the most recent view
    // In a more complex implementation, we could track forward history too
    this.rendererStatus('Forward navigation not available in this demo', 'warning');
  }

  /**
   * Sets the active view by name
   */
  public setView(viewName: string, addToStack: boolean = true): void {
    if (!this.availableViews.has(viewName)) {
      this.rendererStatus(`View '${viewName}' not found`, 'error');
      return;
    }

    if (addToStack) {
      // Don't add to stack if it's the same view
      if (this.activeView !== viewName) {
        this.viewStack.push(viewName);
        // Limit stack size
        if (this.viewStack.length > 20) {
          this.viewStack.shift();
        }
      }
    }

    const previousView = this.activeView;
    this.activeView = viewName;

    // Update UI to reflect new view
    this.updateActiveView();
    this.updateFooterNavigation();

    this.rendererStatus(`Switched to ${this.availableViews.get(viewName)?.name} view`, 'success');
  }

  /**
   * Updates the UI to reflect the active view
   */
  private updateActiveView(): void {
    // In a real implementation, this would update the main screen
    // content based on the active view
    const mainScreen = this.layoutManager.getMainScreen();

    // Clear current content and add view-specific content
    mainScreen.children = [];

    const viewTitle = this.availableViews.get(this.activeView)?.name || 'Unknown View';
    const titleElement = new (require('blessed').text)({
      top: 1,
      left: 2,
      content: `{bold}Active View: ${viewTitle}{/bold}`,
      style: {
        fg: 'yellow',
      },
    });

    const description =
      this.availableViews.get(this.activeView)?.description || 'No description available';
    const descElement = new (require('blessed').text)({
      top: 3,
      left: 2,
      content: description,
      style: {
        fg: 'white',
      },
    });

    const instructions = new (require('blessed').text)({
      top: 5,
      left: 2,
      content:
        'Use Tab/S-Tab to switch views, Ctrl+Left/Right to navigate history\nPress Ctrl+C to exit or any other key to return to chat view',
      style: {
        fg: 'cyan',
      },
    });

    mainScreen.append(titleElement);
    mainScreen.append(descElement);
    mainScreen.append(instructions);

    // Add a temporary exit handler for demo purposes
    const mainScreenElement = this.layoutManager.getMainScreen();
    mainScreenElement.once('keypress', (ch: string, key: any) => {
      if (
        key.name !== 'tab' &&
        key.name !== 'up' &&
        key.name !== 'down' &&
        key.name !== 'left' &&
        key.name !== 'right' &&
        key.name !== 'enter'
      ) {
        this.setView('chat');
      }
    });

    this.layoutManager.render();
  }

  /**
   * Updates navigation indicators in the footer
   */
  private updateFooterNavigation(): void {
    const currentViewInfo = this.availableViews.get(this.activeView);
    const currentViewName = currentViewInfo?.name || 'Unknown';

    const navText =
      `{bold}View:{/bold} ${currentViewName} | ` +
      `{bold}Tab/S-Tab:{/bold} Switch Views | ` +
      `{bold}Ctrl+Left:{/bold} Back | ` +
      `{bold}Ctrl+Right:{/bold} Forward`;

    // Update footer with navigation info
    const footer = this.layoutManager.getFooter();

    // Remove existing navigation element
    footer.removeByName('navigation');

    const navElement = new (require('blessed').text)({
      name: 'navigation',
      top: 1,
      left: 2,
      content: navText,
      style: {
        fg: 'white',
      },
    });

    footer.append(navElement);
    this.layoutManager.render();
  }

  /**
   * Gets the currently active view
   */
  public getActiveView(): string {
    return this.activeView;
  }

  /**
   * Gets all available view names
   */
  public getAvailableViews(): string[] {
    return Array.from(this.availableViews.keys());
  }

  /**
   * Checks if a view exists
   */
  public hasView(viewName: string): boolean {
    return this.availableViews.has(viewName);
  }

  /**
   * Registers a custom key handler
   */
  public registerKeyHandler(key: string, handler: () => void): void {
    this.keyHandlers.set(key, handler);
  }

  /**
   * Gets the current view stack
   */
  public getViewStack(): string[] {
    return [...this.viewStack];
  }

  /**
   * Shows a status message in the renderer
   */
  private rendererStatus(
    message: string,
    type: 'default' | 'highlight' | 'success' | 'warning' | 'error' = 'default'
  ): void {
    // In a real implementation, this would call a method to show status
    // For now, we'll just log it
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
