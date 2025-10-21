/**
 * Layout Manager
 * Responsive layout management with dynamic panel sizing
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import { HeaderPanel } from './components/header';
import { MainPanel } from './components/main-panel';
import { FooterPanel } from './components/footer';
import type { LayoutConfig, PanelConfig, Bounds } from './types';

/**
 * Layout manager for organizing TUI components
 */
export class LayoutManager {
  private screen: Widgets.Screen;
  private header: HeaderPanel | null = null;
  private footer: FooterPanel | null = null;
  private mainPanel: MainPanel | null = null;
  private panels: Map<string, Widgets.BoxElement> = new Map();
  private config: LayoutConfig;
  private resizeHandler: (() => void) | null = null;

  constructor(screen: Widgets.Screen, config?: Partial<LayoutConfig>) {
    this.screen = screen;
    this.config = this.mergeConfig(config);
    this.setupResize();
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config?: Partial<LayoutConfig>): LayoutConfig {
    return {
      header: {
        height: 3,
        visible: true,
        ...config?.header,
      },
      footer: {
        height: 3,
        visible: true,
        ...config?.footer,
      },
      sidebar: config?.sidebar,
      panels: config?.panels || [],
    };
  }

  /**
   * Initialize the layout
   */
  public initialize(): void {
    // Create header if visible
    if (this.config.header.visible) {
      this.header = new HeaderPanel(this.screen);
    }

    // Create footer if visible
    if (this.config.footer.visible) {
      this.footer = new FooterPanel(this.screen);
    }

    // Calculate main panel bounds
    const mainBounds = this.calculateMainBounds();

    // Create main panel
    this.mainPanel = new MainPanel(this.screen, {
      top: mainBounds.top,
      height: mainBounds.height,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: true,
      mouse: true,
      keys: true,
    });

    // Create custom panels
    this.createPanels();

    this.screen.render();
  }

  /**
   * Calculate main panel bounds
   */
  private calculateMainBounds(): { top: number; height: number | string } {
    let top = 0;
    let bottomOffset = 0;

    if (this.config.header.visible) {
      top = this.config.header.height;
    }

    if (this.config.footer.visible) {
      bottomOffset = this.config.footer.height;
    }

    return {
      top,
      height: `100%-${top + bottomOffset}`,
    };
  }

  /**
   * Create custom panels
   */
  private createPanels(): void {
    this.config.panels.forEach((panelConfig) => {
      const panel = blessed.box({
        parent: this.screen,
        top: panelConfig.bounds.top,
        left: panelConfig.bounds.left,
        width: panelConfig.bounds.width,
        height: panelConfig.bounds.height,
        label: panelConfig.title,
        tags: true,
        scrollable: panelConfig.scrollable,
        border: panelConfig.border
          ? {
              type: 'line',
            }
          : undefined,
      });

      this.panels.set(panelConfig.id, panel);
    });
  }

  /**
   * Get header panel
   */
  public getHeader(): HeaderPanel | null {
    return this.header;
  }

  /**
   * Get footer panel
   */
  public getFooter(): FooterPanel | null {
    return this.footer;
  }

  /**
   * Get main panel
   */
  public getMainPanel(): MainPanel | null {
    return this.mainPanel;
  }

  /**
   * Get custom panel by ID
   */
  public getPanel(id: string): Widgets.BoxElement | undefined {
    return this.panels.get(id);
  }

  /**
   * Add a new panel
   */
  public addPanel(config: PanelConfig): Widgets.BoxElement {
    const panel = blessed.box({
      parent: this.screen,
      top: config.bounds.top,
      left: config.bounds.left,
      width: config.bounds.width,
      height: config.bounds.height,
      label: config.title,
      tags: true,
      scrollable: config.scrollable,
      border: config.border
        ? {
            type: 'line',
          }
        : undefined,
    });

    this.panels.set(config.id, panel);
    this.screen.render();
    return panel;
  }

  /**
   * Remove a panel
   */
  public removePanel(id: string): boolean {
    const panel = this.panels.get(id);
    if (panel) {
      panel.destroy();
      this.panels.delete(id);
      this.screen.render();
      return true;
    }
    return false;
  }

  /**
   * Toggle header visibility
   */
  public toggleHeader(): void {
    if (this.header) {
      this.config.header.visible = !this.config.header.visible;
      if (this.config.header.visible) {
        this.header.show();
      } else {
        this.header.hide();
      }
      this.relayout();
    }
  }

  /**
   * Toggle footer visibility
   */
  public toggleFooter(): void {
    if (this.footer) {
      this.config.footer.visible = !this.config.footer.visible;
      if (this.config.footer.visible) {
        this.footer.show();
      } else {
        this.footer.hide();
      }
      this.relayout();
    }
  }

  /**
   * Relayout all components
   */
  private relayout(): void {
    if (this.mainPanel) {
      const mainBounds = this.calculateMainBounds();
      this.mainPanel.setHeight(mainBounds.height);
      this.mainPanel.getElement().top = mainBounds.top;
      this.screen.render();
    }
  }

  /**
   * Setup resize handler
   */
  private setupResize(): void {
    this.resizeHandler = () => {
      this.handleResize();
    };
    this.screen.on('resize', this.resizeHandler);
  }

  /**
   * Handle terminal resize
   */
  private handleResize(): void {
    // Recalculate bounds
    const mainBounds = this.calculateMainBounds();

    // Update main panel
    if (this.mainPanel) {
      this.mainPanel.setHeight(mainBounds.height);
      this.mainPanel.getElement().top = mainBounds.top;
    }

    // Re-render
    this.screen.render();
  }

  /**
   * Get screen dimensions
   */
  public getScreenDimensions(): Bounds {
    return {
      top: 0,
      left: 0,
      width: this.screen.width as number,
      height: this.screen.height as number,
    };
  }

  /**
   * Get available content area (excluding header/footer)
   */
  public getContentBounds(): Bounds {
    const screen = this.getScreenDimensions();
    let top = 0;
    let height = screen.height;

    if (this.config.header.visible) {
      top += this.config.header.height;
      height -= this.config.header.height;
    }

    if (this.config.footer.visible) {
      height -= this.config.footer.height;
    }

    return {
      top,
      left: 0,
      width: screen.width,
      height,
    };
  }

  /**
   * Split panel horizontally
   */
  public splitHorizontal(
    panelId: string,
    ratio: number = 0.5
  ): [Widgets.BoxElement, Widgets.BoxElement] | null {
    const panel = this.panels.get(panelId);
    if (!panel) {return null;}

    const bounds = {
      top: panel.top as number,
      left: panel.left as number,
      width: panel.width as number,
      height: panel.height as number,
    };

    const splitHeight = Math.floor(bounds.height * ratio);

    // Resize original panel
    panel.height = splitHeight;

    // Create new panel
    const newPanel = blessed.box({
      parent: this.screen,
      top: bounds.top + splitHeight,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height - splitHeight,
      tags: true,
      scrollable: true,
      border: {
        type: 'line',
      },
    });

    const newId = `${panelId}_split_${Date.now()}`;
    this.panels.set(newId, newPanel);

    this.screen.render();
    return [panel, newPanel];
  }

  /**
   * Split panel vertically
   */
  public splitVertical(
    panelId: string,
    ratio: number = 0.5
  ): [Widgets.BoxElement, Widgets.BoxElement] | null {
    const panel = this.panels.get(panelId);
    if (!panel) {return null;}

    const bounds = {
      top: panel.top as number,
      left: panel.left as number,
      width: panel.width as number,
      height: panel.height as number,
    };

    const splitWidth = Math.floor(bounds.width * ratio);

    // Resize original panel
    panel.width = splitWidth;

    // Create new panel
    const newPanel = blessed.box({
      parent: this.screen,
      top: bounds.top,
      left: bounds.left + splitWidth,
      width: bounds.width - splitWidth,
      height: bounds.height,
      tags: true,
      scrollable: true,
      border: {
        type: 'line',
      },
    });

    const newId = `${panelId}_split_${Date.now()}`;
    this.panels.set(newId, newPanel);

    this.screen.render();
    return [panel, newPanel];
  }

  /**
   * Focus next panel
   */
  public focusNext(): void {
    const focusable = this.getFocusableElements();
    const currentIndex = focusable.findIndex((el) => this.screen.focused === el);
    const nextIndex = (currentIndex + 1) % focusable.length;
    const next = focusable[nextIndex];
    if (next) {
      next.focus();
      this.screen.render();
    }
  }

  /**
   * Focus previous panel
   */
  public focusPrevious(): void {
    const focusable = this.getFocusableElements();
    const currentIndex = focusable.findIndex((el) => this.screen.focused === el);
    const prevIndex = (currentIndex - 1 + focusable.length) % focusable.length;
    const prev = focusable[prevIndex];
    if (prev) {
      prev.focus();
      this.screen.render();
    }
  }

  /**
   * Get all focusable elements
   */
  private getFocusableElements(): Widgets.BlessedElement[] {
    const elements: Widgets.BlessedElement[] = [];

    if (this.mainPanel) {
      elements.push(this.mainPanel.getElement());
    }

    if (this.footer) {
      elements.push(this.footer.getInput());
    }

    this.panels.forEach((panel) => {
      elements.push(panel);
    });

    return elements;
  }

  /**
   * Clear all panels
   */
  public clearPanels(): void {
    this.panels.forEach((panel) => {
      panel.destroy();
    });
    this.panels.clear();
    this.screen.render();
  }

  /**
   * Destroy the layout
   */
  public destroy(): void {
    if (this.resizeHandler) {
      this.screen.off('resize', this.resizeHandler);
    }

    this.header?.destroy();
    this.footer?.destroy();
    this.mainPanel?.destroy();
    this.clearPanels();
  }

  /**
   * Get layout configuration
   */
  public getConfig(): LayoutConfig {
    return { ...this.config };
  }

  /**
   * Update layout configuration
   */
  public updateConfig(config: Partial<LayoutConfig>): void {
    this.config = this.mergeConfig(config);
    this.relayout();
  }
}
