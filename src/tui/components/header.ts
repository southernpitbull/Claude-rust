/**
 * Header Panel Component
 * Displays status information, mode indicators, and system stats
 */

import blessed from 'blessed';
import type { Widgets } from 'blessed';
import type { StatusInfo } from '../types';
import { getThemeManager } from '../theme';

/**
 * Header panel displaying status information
 */
export class HeaderPanel {
  private box: Widgets.BoxElement;
  private screen: Widgets.Screen;
  private status: StatusInfo;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(screen: Widgets.Screen) {
    this.screen = screen;
    this.status = {
      mode: 'normal',
    };

    const theme = getThemeManager();
    const style = theme.getStyle('header');

    this.box = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: this.renderStatus(),
      tags: true,
      style: {
        fg: style.fg,
        bg: style.bg,
        bold: style.bold,
        border: style.border
          ? {
              fg: style.border.fg,
            }
          : undefined,
      },
      border: style.border
        ? {
            type: 'line',
          }
        : undefined,
    });

    // Listen for theme changes
    theme.onChange(() => this.applyTheme());

    // Auto-update every second
    this.startAutoUpdate();
  }

  /**
   * Update the status information
   */
  public updateStatus(status: Partial<StatusInfo>): void {
    this.status = { ...this.status, ...status };
    this.render();
  }

  /**
   * Get current status
   */
  public getStatus(): StatusInfo {
    return { ...this.status };
  }

  /**
   * Render the header content
   */
  private renderStatus(): string {
    const parts: string[] = [];

    // Mode indicator
    const modeColor = this.getModeColor(this.status.mode);
    parts.push(`{${modeColor}-fg}{bold}${this.status.mode.toUpperCase()}{/bold}{/${modeColor}-fg}`);

    // Project info
    if (this.status.project) {
      parts.push(`{cyan-fg}${this.status.project}{/cyan-fg}`);
    }

    // Git branch
    if (this.status.branch) {
      parts.push(`{green-fg} ${this.status.branch}{/green-fg}`);
    }

    // AI provider info
    if (this.status.aiProvider) {
      const provider = this.status.aiModel
        ? `${this.status.aiProvider}/${this.status.aiModel}`
        : this.status.aiProvider;
      parts.push(`{magenta-fg}AI: ${provider}{/magenta-fg}`);
    }

    // Token usage
    if (this.status.tokensUsed !== undefined && this.status.tokensLimit !== undefined) {
      const percentage = (this.status.tokensUsed / this.status.tokensLimit) * 100;
      const tokenColor = percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'green';
      parts.push(
        `{${tokenColor}-fg}${this.status.tokensUsed}/${this.status.tokensLimit} tokens{/${tokenColor}-fg}`
      );
    }

    // Processing indicator
    if (this.status.isProcessing) {
      const spinner = this.getSpinner();
      parts.push(`{yellow-fg}${spinner} Processing...{/yellow-fg}`);
    }

    // Error indicator
    if (this.status.lastError) {
      parts.push(`{red-fg} ${this.status.lastError}{/red-fg}`);
    }

    // Notifications
    if (this.status.notifications && this.status.notifications > 0) {
      parts.push(`{blue-fg} ${this.status.notifications} notifications{/blue-fg}`);
    }

    // Add timestamp
    const now = new Date();
    const time = now.toLocaleTimeString();
    parts.push(`{gray-fg}${time}{/gray-fg}`);

    return ` ${parts.join(' {gray-fg}|{/gray-fg} ')} `;
  }

  /**
   * Get color for mode
   */
  private getModeColor(mode: StatusInfo['mode']): string {
    const colors: Record<StatusInfo['mode'], string> = {
      normal: 'blue',
      insert: 'green',
      visual: 'yellow',
      command: 'cyan',
    };
    return colors[mode] || 'white';
  }

  /**
   * Get animated spinner character
   */
  private getSpinner(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const index = Math.floor(Date.now() / 100) % frames.length;
    return frames[index] ?? '⠋';
  }

  /**
   * Apply theme to component
   */
  private applyTheme(): void {
    const theme = getThemeManager();
    const style = theme.getStyle('header');

    this.box.style = {
      fg: style.fg,
      bg: style.bg,
      bold: style.bold,
      border: style.border
        ? {
            fg: style.border.fg,
          }
        : undefined,
    };

    this.render();
  }

  /**
   * Render the header
   */
  public render(): void {
    this.box.setContent(this.renderStatus());
    this.screen.render();
  }

  /**
   * Start auto-update timer
   */
  private startAutoUpdate(): void {
    this.updateInterval = setInterval(() => {
      if (this.status.isProcessing) {
        this.render(); // Update spinner animation
      }
    }, 100);
  }

  /**
   * Stop auto-update timer
   */
  private stopAutoUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Show processing indicator
   */
  public showProcessing(): void {
    this.updateStatus({ isProcessing: true });
  }

  /**
   * Hide processing indicator
   */
  public hideProcessing(): void {
    this.updateStatus({ isProcessing: false });
  }

  /**
   * Show error message
   */
  public showError(error: string): void {
    this.updateStatus({ lastError: error });
    setTimeout(() => {
      this.updateStatus({ lastError: undefined });
    }, 5000);
  }

  /**
   * Clear error message
   */
  public clearError(): void {
    this.updateStatus({ lastError: undefined });
  }

  /**
   * Set notification count
   */
  public setNotifications(count: number): void {
    this.updateStatus({ notifications: count });
  }

  /**
   * Get the blessed box element
   */
  public getElement(): Widgets.BoxElement {
    return this.box;
  }

  /**
   * Destroy the component
   */
  public destroy(): void {
    this.stopAutoUpdate();
    this.box.destroy();
  }

  /**
   * Get component height
   */
  public getHeight(): number {
    return 3;
  }

  /**
   * Hide the header
   */
  public hide(): void {
    this.box.hide();
    this.screen.render();
  }

  /**
   * Show the header
   */
  public show(): void {
    this.box.show();
    this.screen.render();
  }

  /**
   * Toggle header visibility
   */
  public toggle(): void {
    if (this.box.visible) {
      this.hide();
    } else {
      this.show();
    }
  }
}
