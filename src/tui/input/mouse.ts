/**
 * Mouse Support
 * Click, drag, scroll, and context menu handling
 */

import type { Widgets } from 'blessed';
import type { MouseEvent as TUIMouseEvent } from '../types';

/**
 * Mouse event handler callback
 */
export type MouseEventHandler = (event: TUIMouseEvent) => void | Promise<void>;

/**
 * Mouse manager
 */
export class MouseManager {
  private screen: Widgets.Screen;
  private enabled: boolean = true;
  private doubleClickDelay: number = 300;
  private lastClickTime: number = 0;
  private lastClickButton: TUIMouseEvent['button'] | null = null;
  private lastClickPos: { x: number; y: number } | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private isDragging: boolean = false;
  private dragThreshold: number = 3;

  // Event handlers
  private clickHandlers: Set<MouseEventHandler> = new Set();
  private dblclickHandlers: Set<MouseEventHandler> = new Set();
  private mousedownHandlers: Set<MouseEventHandler> = new Set();
  private mouseupHandlers: Set<MouseEventHandler> = new Set();
  private mousemoveHandlers: Set<MouseEventHandler> = new Set();
  private dragHandlers: Set<MouseEventHandler> = new Set();
  private scrollHandlers: Set<MouseEventHandler> = new Set();

  private mouseHandler: ((data: Widgets.Events.IMouseEventArg) => void) | null = null;

  constructor(screen: Widgets.Screen) {
    this.screen = screen;
    this.setupMouseHandler();
  }

  /**
   * Setup mouse event handler
   */
  private setupMouseHandler(): void {
    this.mouseHandler = async (data: Widgets.Events.IMouseEventArg) => {
      if (!this.enabled) {return;}

      const event: TUIMouseEvent = {
        x: data.x,
        y: data.y,
        button: this.getButtonType(data),
        action: data.action as TUIMouseEvent['action'],
        shift: data.shift ?? false,
        ctrl: data.ctrl ?? false,
        meta: data.meta ?? false,
      };

      await this.handleMouseEvent(event);
    };

    this.screen.on('mouse', this.mouseHandler);
  }

  /**
   * Get button type from event
   */
  private getButtonType(data: Widgets.Events.IMouseEventArg): TUIMouseEvent['button'] {
    if (data.action === 'wheelup') {return 'wheelup';}
    if (data.action === 'wheeldown') {return 'wheeldown';}

    const button = data.button;
    if (button === 'left') {return 'left';}
    if (button === 'middle') {return 'middle';}
    if (button === 'right') {return 'right';}

    return 'left';
  }

  /**
   * Handle mouse event
   */
  private async handleMouseEvent(event: TUIMouseEvent): Promise<void> {
    switch (event.action) {
      case 'mousedown':
        await this.handleMouseDown(event);
        break;
      case 'mouseup':
        await this.handleMouseUp(event);
        break;
      case 'mousemove':
        await this.handleMouseMove(event);
        break;
      case 'wheelup':
      case 'wheeldown':
        await this.handleScroll(event);
        break;
    }
  }

  /**
   * Handle mouse down
   */
  private async handleMouseDown(event: TUIMouseEvent): Promise<void> {
    this.dragStart = { x: event.x, y: event.y };
    this.isDragging = false;

    // Emit mousedown event
    for (const handler of this.mousedownHandlers) {
      await handler(event);
    }
  }

  /**
   * Handle mouse up
   */
  private async handleMouseUp(event: TUIMouseEvent): Promise<void> {
    // Emit mouseup event
    for (const handler of this.mouseupHandlers) {
      await handler(event);
    }

    // Handle drag end
    if (this.isDragging) {
      this.isDragging = false;
      this.dragStart = null;
      return;
    }

    // Handle click/double-click
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;

    const isDoubleClick =
      timeSinceLastClick < this.doubleClickDelay &&
      this.lastClickButton === event.button &&
      this.lastClickPos &&
      Math.abs(this.lastClickPos.x - event.x) < 2 &&
      Math.abs(this.lastClickPos.y - event.y) < 2;

    if (isDoubleClick) {
      // Emit double-click
      event.action = 'dblclick';
      for (const handler of this.dblclickHandlers) {
        await handler(event);
      }
      this.lastClickTime = 0;
      this.lastClickButton = null;
      this.lastClickPos = null;
    } else {
      // Emit click
      event.action = 'click';
      for (const handler of this.clickHandlers) {
        await handler(event);
      }
      this.lastClickTime = now;
      this.lastClickButton = event.button;
      this.lastClickPos = { x: event.x, y: event.y };
    }

    this.dragStart = null;
  }

  /**
   * Handle mouse move
   */
  private async handleMouseMove(event: TUIMouseEvent): Promise<void> {
    // Emit mousemove event
    for (const handler of this.mousemoveHandlers) {
      await handler(event);
    }

    // Handle drag
    if (this.dragStart && !this.isDragging) {
      const dx = Math.abs(event.x - this.dragStart.x);
      const dy = Math.abs(event.y - this.dragStart.y);

      if (dx > this.dragThreshold || dy > this.dragThreshold) {
        this.isDragging = true;
      }
    }

    if (this.isDragging) {
      for (const handler of this.dragHandlers) {
        await handler(event);
      }
    }
  }

  /**
   * Handle scroll
   */
  private async handleScroll(event: TUIMouseEvent): Promise<void> {
    for (const handler of this.scrollHandlers) {
      await handler(event);
    }
  }

  /**
   * Register click handler
   */
  public onClick(handler: MouseEventHandler): void {
    this.clickHandlers.add(handler);
  }

  /**
   * Remove click handler
   */
  public offClick(handler: MouseEventHandler): void {
    this.clickHandlers.delete(handler);
  }

  /**
   * Register double-click handler
   */
  public onDoubleClick(handler: MouseEventHandler): void {
    this.dblclickHandlers.add(handler);
  }

  /**
   * Remove double-click handler
   */
  public offDoubleClick(handler: MouseEventHandler): void {
    this.dblclickHandlers.delete(handler);
  }

  /**
   * Register mousedown handler
   */
  public onMouseDown(handler: MouseEventHandler): void {
    this.mousedownHandlers.add(handler);
  }

  /**
   * Remove mousedown handler
   */
  public offMouseDown(handler: MouseEventHandler): void {
    this.mousedownHandlers.delete(handler);
  }

  /**
   * Register mouseup handler
   */
  public onMouseUp(handler: MouseEventHandler): void {
    this.mouseupHandlers.add(handler);
  }

  /**
   * Remove mouseup handler
   */
  public offMouseUp(handler: MouseEventHandler): void {
    this.mouseupHandlers.delete(handler);
  }

  /**
   * Register mousemove handler
   */
  public onMouseMove(handler: MouseEventHandler): void {
    this.mousemoveHandlers.add(handler);
  }

  /**
   * Remove mousemove handler
   */
  public offMouseMove(handler: MouseEventHandler): void {
    this.mousemoveHandlers.delete(handler);
  }

  /**
   * Register drag handler
   */
  public onDrag(handler: MouseEventHandler): void {
    this.dragHandlers.add(handler);
  }

  /**
   * Remove drag handler
   */
  public offDrag(handler: MouseEventHandler): void {
    this.dragHandlers.delete(handler);
  }

  /**
   * Register scroll handler
   */
  public onScroll(handler: MouseEventHandler): void {
    this.scrollHandlers.add(handler);
  }

  /**
   * Remove scroll handler
   */
  public offScroll(handler: MouseEventHandler): void {
    this.scrollHandlers.delete(handler);
  }

  /**
   * Enable mouse input
   */
  public enable(): void {
    this.enabled = true;
    this.screen.enableMouse();
  }

  /**
   * Disable mouse input
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Check if mouse input is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set double-click delay
   */
  public setDoubleClickDelay(delay: number): void {
    this.doubleClickDelay = delay;
  }

  /**
   * Get double-click delay
   */
  public getDoubleClickDelay(): number {
    return this.doubleClickDelay;
  }

  /**
   * Set drag threshold
   */
  public setDragThreshold(threshold: number): void {
    this.dragThreshold = threshold;
  }

  /**
   * Get drag threshold
   */
  public getDragThreshold(): number {
    return this.dragThreshold;
  }

  /**
   * Check if currently dragging
   */
  public isDraggingNow(): boolean {
    return this.isDragging;
  }

  /**
   * Clear all handlers
   */
  public clearHandlers(): void {
    this.clickHandlers.clear();
    this.dblclickHandlers.clear();
    this.mousedownHandlers.clear();
    this.mouseupHandlers.clear();
    this.mousemoveHandlers.clear();
    this.dragHandlers.clear();
    this.scrollHandlers.clear();
  }

  /**
   * Destroy mouse manager
   */
  public destroy(): void {
    if (this.mouseHandler) {
      this.screen.off('mouse', this.mouseHandler);
      this.mouseHandler = null;
    }
    this.clearHandlers();
  }
}

/**
 * Context menu manager
 */
export class ContextMenuManager {
  private screen: Widgets.Screen;
  private menu: Widgets.ListElement | null = null;
  private items: ContextMenuItem[] = [];
  private visible: boolean = false;

  constructor(screen: Widgets.Screen) {
    this.screen = screen;
  }

  /**
   * Show context menu at position
   */
  public show(x: number, y: number, items: ContextMenuItem[]): void {
    this.items = items;

    if (!this.menu) {
      this.createMenu();
    }

    if (this.menu) {
      this.menu.left = x;
      this.menu.top = y;
      this.menu.setItems(items.map((item) => item.label));
      this.menu.show();
      this.menu.focus();
      this.visible = true;
      this.screen.render();
    }
  }

  /**
   * Hide context menu
   */
  public hide(): void {
    if (this.menu) {
      this.menu.hide();
      this.visible = false;
      this.screen.render();
    }
  }

  /**
   * Create menu widget
   */
  private createMenu(): void {
    this.menu = blessed.list({
      parent: this.screen,
      left: 0,
      top: 0,
      width: 30,
      height: 'shrink',
      tags: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        fg: 'white',
        bg: 'black',
        selected: {
          fg: 'black',
          bg: 'blue',
        },
        border: {
          fg: 'gray',
        },
      },
      border: {
        type: 'line',
      },
    });

    this.menu.on('select', (item: Widgets.BlessedElement, index: number) => {
      const menuItem = this.items[index];
      if (menuItem && !menuItem.disabled) {
        void menuItem.action();
      }
      this.hide();
    });

    this.menu.on('blur', () => {
      this.hide();
    });

    this.menu.key(['escape'], () => {
      this.hide();
    });
  }

  /**
   * Check if menu is visible
   */
  public isVisible(): boolean {
    return this.visible;
  }

  /**
   * Destroy context menu
   */
  public destroy(): void {
    if (this.menu) {
      this.menu.destroy();
      this.menu = null;
    }
  }
}

/**
 * Context menu item
 */
export interface ContextMenuItem {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  separator?: boolean;
  icon?: string;
}

/**
 * Create mouse manager
 */
export function createMouseManager(screen: Widgets.Screen): MouseManager {
  return new MouseManager(screen);
}

/**
 * Create context menu manager
 */
export function createContextMenuManager(screen: Widgets.Screen): ContextMenuManager {
  return new ContextMenuManager(screen);
}
