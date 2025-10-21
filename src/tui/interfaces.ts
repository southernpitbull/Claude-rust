import * as blessed from 'blessed';
import { TUIManager } from './TUIManager';

// Define the interface for all TUI components
export interface TUIComponent {
  element: blessed.Widgets.BlessedElement;
  render(): void;
  destroy(): void;
}

// Header component interface
export interface HeaderComponent extends TUIComponent {
  updateStatus(status: string): void;
  updateProvider(provider: string): void;
}

// Main content component interface
export interface MainComponent extends TUIComponent {
  setContent(content: string): void;
  appendContent(content: string): void;
}

// Footer component interface (command input)
export interface FooterComponent extends TUIComponent {
  setPrompt(prompt: string): void;
  getInput(): Promise<string>;
}

// Status bar component interface
export interface StatusBarComponent extends TUIComponent {
  updateStatus(text: string): void;
}

// Sidebar component interface
export interface SidebarComponent extends TUIComponent {
  addItem(item: string): void;
  removeItem(item: string): void;
}
