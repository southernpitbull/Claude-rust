import { LayoutManager } from './layout-manager';

/**
 * TabManager handles tabbed navigation within the TUI interface
 */
export class TabManager {
  private layoutManager: LayoutManager;
  private tabs: Map<string, { name: string; content: any; active: boolean }>;
  private activeTabId: string | null;
  private tabBar: any;
  private tabContentArea: any;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.tabs = new Map();
    this.activeTabId = null;

    this.createTabInterface();
  }

  private createTabInterface(): void {
    const mainScreen = this.layoutManager.getMainScreen();

    // Create tab bar
    this.tabBar = new (require('blessed').box)({
      parent: mainScreen,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'magenta',
        border: {
          fg: '#f0f0f0',
        },
      },
    });

    // Create tab content area
    this.tabContentArea = new (require('blessed').box)({
      parent: mainScreen,
      top: 3,
      left: 0,
      right: 0,
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
  }

  /**
   * Adds a new tab
   */
  public addTab(id: string, name: string, content: any): boolean {
    if (this.tabs.has(id)) {
      return false; // Tab already exists
    }

    this.tabs.set(id, {
      name,
      content,
      active: false,
    });

    this.renderTabBar();

    // If this is the first tab, activate it
    if (this.tabs.size === 1) {
      this.activateTab(id);
    }

    return true;
  }

  /**
   * Removes a tab
   */
  public removeTab(id: string): boolean {
    if (!this.tabs.has(id)) {
      return false;
    }

    const tab = this.tabs.get(id);
    if (tab && tab.active && this.tabs.size > 1) {
      // Activate another tab if the active one is being removed
      for (const [tabId, tabInfo] of this.tabs.entries()) {
        if (tabId !== id) {
          this.activateTab(tabId);
          break;
        }
      }
    } else if (tab && tab.active && this.tabs.size === 1) {
      // No more tabs to activate
      this.activeTabId = null;
      this.tabContentArea.children = []; // Clear content
    }

    this.tabs.delete(id);
    this.renderTabBar();

    return true;
  }

  /**
   * Activates a tab
   */
  public activateTab(id: string): boolean {
    if (!this.tabs.has(id)) {
      return false;
    }

    // Deactivate current tab
    if (this.activeTabId && this.tabs.has(this.activeTabId)) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.active = false;
      }
    }

    // Activate new tab
    const tab = this.tabs.get(id);
    if (tab) {
      tab.active = true;
      this.activeTabId = id;

      // Clear current content and add new content
      this.tabContentArea.children = [];

      // Add the content to the tab content area
      if (tab.content) {
        this.tabContentArea.append(tab.content);
      }
    }

    this.renderTabBar();
    this.layoutManager.render();

    return true;
  }

  /**
   * Switches to the next tab
   */
  public switchToNextTab(): void {
    if (this.tabs.size <= 1) {
      return;
    }

    const tabIds = Array.from(this.tabs.keys());
    const currentIndex = tabIds.indexOf(this.activeTabId || '');

    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % tabIds.length;
      this.activateTab(tabIds[nextIndex]);
    } else if (tabIds.length > 0) {
      // If no current tab, activate the first one
      this.activateTab(tabIds[0]);
    }
  }

  /**
   * Switches to the previous tab
   */
  public switchToPreviousTab(): void {
    if (this.tabs.size <= 1) {
      return;
    }

    const tabIds = Array.from(this.tabs.keys());
    const currentIndex = tabIds.indexOf(this.activeTabId || '');

    if (currentIndex !== -1) {
      const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
      this.activateTab(tabIds[prevIndex]);
    } else if (tabIds.length > 0) {
      // If no current tab, activate the last one
      this.activateTab(tabIds[tabIds.length - 1]);
    }
  }

  /**
   * Renders the tab bar with all available tabs
   */
  private renderTabBar(): void {
    // Remove existing tab elements
    this.tabBar.children = [];

    let leftOffset = 1;

    // Add each tab as a clickable element
    for (const [id, tab] of this.tabs.entries()) {
      const tabElement = new (require('blessed').box)({
        parent: this.tabBar,
        top: 1,
        left: leftOffset,
        width: tab.name.length + 4,
        height: 1,
        content: ` ${tab.name} `,
        tags: true,
        border: {
          type: 'line',
        },
        style: {
          fg: tab.active ? 'black' : 'white',
          bg: tab.active ? 'white' : id === this.activeTabId ? 'lightgray' : 'magenta',
          border: {
            fg: tab.active ? 'black' : '#f0f0f0',
          },
        },
      });

      // Add click handler to activate tab
      tabElement.on('click', () => {
        this.activateTab(id);
      });

      leftOffset += tab.name.length + 6; // Account for padding and border

      // Don't let tabs exceed screen width
      if (leftOffset > this.tabBar.width - 10) {
        break; // Stop adding tabs if no more space
      }
    }

    // Add instructions
    const instructions = new (require('blessed').text)({
      parent: this.tabBar,
      top: 1,
      right: 1,
      content: 'Ctrl+Tab: Next | Shift+Ctrl+Tab: Previous',
      style: {
        fg: 'white',
        bg: 'magenta',
      },
    });

    this.layoutManager.render();
  }

  /**
   * Gets the currently active tab ID
   */
  public getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Gets the currently active tab name
   */
  public getActiveTabName(): string | null {
    if (!this.activeTabId || !this.tabs.has(this.activeTabId)) {
      return null;
    }

    return this.tabs.get(this.activeTabId)?.name || null;
  }

  /**
   * Gets all tab IDs
   */
  public getTabIds(): string[] {
    return Array.from(this.tabs.keys());
  }

  /**
   * Gets the number of open tabs
   */
  public getTabCount(): number {
    return this.tabs.size;
  }

  /**
   * Checks if a tab exists
   */
  public hasTab(id: string): boolean {
    return this.tabs.has(id);
  }

  /**
   * Updates tab content
   */
  public updateTabContent(id: string, content: any): boolean {
    if (!this.tabs.has(id)) {
      return false;
    }

    const tab = this.tabs.get(id);
    if (tab) {
      tab.content = content;

      // If this is the active tab, update the content area
      if (this.activeTabId === id) {
        this.tabContentArea.children = [];
        this.tabContentArea.append(content);
        this.layoutManager.render();
      }
    }

    return true;
  }

  /**
   * Gets the content of a specific tab
   */
  public getTabContent(id: string): any {
    if (!this.tabs.has(id)) {
      return null;
    }

    return this.tabs.get(id)?.content;
  }

  /**
   * Renames a tab
   */
  public renameTab(id: string, newName: string): boolean {
    if (!this.tabs.has(id)) {
      return false;
    }

    const tab = this.tabs.get(id);
    if (tab) {
      tab.name = newName;
      this.renderTabBar();
      return true;
    }

    return false;
  }
}
