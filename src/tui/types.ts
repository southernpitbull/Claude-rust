/**
 * Terminal User Interface Type Definitions
 * Comprehensive type system for the TUI framework
 */

import type { Widgets } from 'blessed';

/**
 * Color types supported by the terminal
 */
export type Color =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

/**
 * Theme definition for the TUI
 */
export interface Theme {
  name: string;
  colors: {
    primary: Color;
    secondary: Color;
    success: Color;
    warning: Color;
    error: Color;
    info: Color;
    background: Color;
    foreground: Color;
    border: Color;
    focus: Color;
    selection: Color;
    disabled: Color;
  };
  styles: {
    header: StyleConfig;
    footer: StyleConfig;
    panel: StyleConfig;
    button: StyleConfig;
    input: StyleConfig;
    table: StyleConfig;
    tree: StyleConfig;
    modal: StyleConfig;
  };
}

/**
 * Style configuration for components
 */
export interface StyleConfig {
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  underline?: boolean;
  blink?: boolean;
  inverse?: boolean;
  invisible?: boolean;
  border?: {
    type?: 'line' | 'bg';
    fg?: Color;
    bg?: Color;
  };
}

/**
 * Status information displayed in header
 */
export interface StatusInfo {
  mode: 'normal' | 'insert' | 'visual' | 'command';
  project?: string;
  branch?: string;
  aiProvider?: string;
  aiModel?: string;
  tokensUsed?: number;
  tokensLimit?: number;
  isProcessing?: boolean;
  lastError?: string;
  notifications?: number;
}

/**
 * Position and size information
 */
export interface Bounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Keyboard event information
 */
export interface KeyEvent {
  name: string;
  full: string;
  sequence: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * Mouse event information
 */
export interface MouseEvent {
  x: number;
  y: number;
  button: 'left' | 'middle' | 'right' | 'wheelup' | 'wheeldown';
  action: 'mousedown' | 'mouseup' | 'mousemove' | 'click' | 'dblclick';
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

/**
 * Vim mode types
 */
export type VimMode = 'normal' | 'insert' | 'visual' | 'command';

/**
 * Vim command definition
 */
export interface VimCommand {
  key: string;
  mode: VimMode;
  action: (context: VimContext) => void | Promise<void>;
  description?: string;
  repeatable?: boolean;
}

/**
 * Vim execution context
 */
export interface VimContext {
  mode: VimMode;
  count: number;
  register?: string;
  motion?: string;
  cursor: { line: number; column: number };
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
}

/**
 * Widget base interface
 */
export interface Widget {
  readonly id: string;
  readonly type: string;
  bounds: Bounds;
  visible: boolean;
  focused: boolean;
  render(): void;
  focus(): void;
  blur(): void;
  destroy(): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Text display options
 */
export interface TextDisplayOptions {
  content: string;
  wrap: boolean;
  scrollable: boolean;
  selectable: boolean;
  syntaxHighlight?: boolean;
  language?: string;
  lineNumbers?: boolean;
  maxLines?: number;
}

/**
 * Input field options
 */
export interface InputFieldOptions {
  value: string;
  placeholder?: string;
  password?: boolean;
  validator?: (value: string) => ValidationResult;
  autocomplete?: (value: string) => Promise<string[]>;
  maxLength?: number;
  multiline?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Button options
 */
export interface ButtonOptions {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  icon?: string;
}

/**
 * Table column definition
 */
export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  formatter?: (value: unknown, row: T) => string;
}

/**
 * Table options
 */
export interface TableOptions<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  multiSelect?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onSelect?: (rows: T[]) => void;
}

/**
 * Tree node definition
 */
export interface TreeNode<T = unknown> {
  id: string;
  label: string;
  data?: T;
  expanded?: boolean;
  children?: TreeNode<T>[];
  icon?: string;
}

/**
 * Tree options
 */
export interface TreeOptions<T = unknown> {
  nodes: TreeNode<T>[];
  selectable?: boolean;
  multiSelect?: boolean;
  onSelect?: (nodes: TreeNode<T>[]) => void;
  onExpand?: (node: TreeNode<T>) => void | Promise<TreeNode<T>[]>;
  onCollapse?: (node: TreeNode<T>) => void;
}

/**
 * Progress bar options
 */
export interface ProgressOptions {
  value: number;
  max: number;
  showPercentage?: boolean;
  showValue?: boolean;
  indeterminate?: boolean;
  label?: string;
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  header: {
    height: number;
    visible: boolean;
  };
  footer: {
    height: number;
    visible: boolean;
  };
  sidebar?: {
    width: number;
    position: 'left' | 'right';
    visible: boolean;
  };
  panels: PanelConfig[];
}

/**
 * Panel configuration
 */
export interface PanelConfig {
  id: string;
  title?: string;
  bounds: Bounds;
  scrollable?: boolean;
  border?: boolean;
  content?: Widget;
}

/**
 * Command palette item
 */
export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category?: string;
  keybinding?: string;
  action: () => void | Promise<void>;
}

/**
 * Notification message
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

/**
 * Modal dialog options
 */
export interface ModalOptions {
  title: string;
  content: string | Widget;
  buttons?: ButtonOptions[];
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  onClose?: () => void;
}

/**
 * Context menu item
 */
export interface ContextMenuItem {
  label: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  icon?: string;
  keybinding?: string;
}

/**
 * Renderer options
 */
export interface RendererOptions {
  fps?: number;
  doubleBuffering?: boolean;
  unicode?: boolean;
  colors?: number;
  cursor?: boolean;
}

/**
 * Animation frame data
 */
export interface AnimationFrame {
  content: string;
  duration: number;
}

/**
 * Animation options
 */
export interface AnimationOptions {
  frames: AnimationFrame[];
  loop?: boolean;
  onComplete?: () => void;
}

/**
 * Syntax highlight token
 */
export interface SyntaxToken {
  type: 'keyword' | 'string' | 'number' | 'comment' | 'operator' | 'identifier' | 'function';
  value: string;
  color?: Color;
}

/**
 * Screen configuration
 */
export interface ScreenConfig {
  smartCSR?: boolean;
  fullUnicode?: boolean;
  dockBorders?: boolean;
  ignoreDockContrast?: boolean;
  title?: string;
  cursor?: {
    artificial?: boolean;
    shape?: 'line' | 'underline' | 'block';
    blink?: boolean;
    color?: Color;
  };
}

/**
 * Event emitter interface
 */
export interface EventEmitter {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  once(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
}

/**
 * Focus manager interface
 */
export interface FocusManager {
  focusedWidget: Widget | null;
  focusableWidgets: Widget[];
  focus(widget: Widget): void;
  blur(): void;
  next(): void;
  previous(): void;
}

/**
 * Clipboard interface
 */
export interface Clipboard {
  copy(text: string): void;
  paste(): string;
  clear(): void;
}
