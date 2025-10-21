import { LayoutManager } from './layout-manager';

/**
 * AutoComplete provides command auto-completion functionality
 */
export class AutoComplete {
  private layoutManager: LayoutManager;
  private suggestions: string[];
  private inputElement: any;
  private suggestionBox: any;
  private selectedIndex: number;
  private isVisible: boolean;

  constructor(layoutManager: LayoutManager) {
    this.layoutManager = layoutManager;
    this.suggestions = [];
    this.selectedIndex = -1;
    this.isVisible = false;
  }

  /**
   * Sets the input element to attach auto-completion to
   */
  public setInputElement(inputElement: any): void {
    this.inputElement = inputElement;
  }

  /**
   * Sets the list of possible suggestions
   */
  public setSuggestions(suggestions: string[]): void {
    this.suggestions = suggestions;
    this.selectedIndex = -1;
  }

  /**
   * Shows auto-completion suggestions based on input
   */
  public showSuggestions(input: string): void {
    if (!input) {
      this.hideSuggestions();
      return;
    }

    // Filter suggestions based on input
    const filteredSuggestions = this.suggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(input.toLowerCase())
    );

    if (filteredSuggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.suggestions = filteredSuggestions;
    this.selectedIndex = 0;

    // Create or update the suggestion box
    this.createOrUpdateSuggestionBox(input);
    this.isVisible = true;

    this.renderSuggestions();
  }

  /**
   * Hides auto-completion suggestions
   */
  public hideSuggestions(): void {
    if (this.suggestionBox) {
      const mainScreen = this.layoutManager.getMainScreen();
      mainScreen.remove(this.suggestionBox);
      this.suggestionBox = null;
      this.isVisible = false;
      this.layoutManager.render();
    }
  }

  /**
   * Gets the currently selected suggestion
   */
  public getSelectedSuggestion(): string | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.suggestions.length) {
      return this.suggestions[this.selectedIndex];
    }
    return null;
  }

  /**
   * Selects the next suggestion in the list
   */
  public selectNextSuggestion(): void {
    if (this.suggestions.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
    this.renderSuggestions();
  }

  /**
   * Selects the previous suggestion in the list
   */
  public selectPreviousSuggestion(): void {
    if (this.suggestions.length === 0) {
      return;
    }

    this.selectedIndex =
      (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
    this.renderSuggestions();
  }

  /**
   * Accepts the currently selected suggestion
   */
  public acceptSuggestion(): string | null {
    const suggestion = this.getSelectedSuggestion();
    if (suggestion) {
      this.hideSuggestions();
    }
    return suggestion;
  }

  /**
   * Creates or updates the suggestion box
   */
  private createOrUpdateSuggestionBox(input: string): void {
    const mainScreen = this.layoutManager.getMainScreen();

    // Remove existing suggestion box if it exists
    if (this.suggestionBox) {
      mainScreen.remove(this.suggestionBox);
    }

    // Calculate position for the suggestion box
    const inputPos = this.inputElement.position();
    const top = inputPos.y - Math.min(10, this.suggestions.length) - 1;
    const left = inputPos.x;
    const width = Math.max(inputPos.width, 30);

    // Create the suggestion box
    this.suggestionBox = new (require('blessed').list)({
      parent: mainScreen,
      top: top,
      left: left,
      width: width,
      height: Math.min(10, this.suggestions.length) + 2,
      tags: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan',
        },
        selected: {
          fg: 'black',
          bg: 'cyan',
        },
      },
      items: this.suggestions,
      interactive: false, // We'll handle interaction ourselves
    });

    // Set the selected index
    this.suggestionBox.select(this.selectedIndex);
  }

  /**
   * Renders the suggestions in the suggestion box
   */
  private renderSuggestions(): void {
    if (!this.suggestionBox) {
      return;
    }

    // Clear existing items
    this.suggestionBox.setItems(this.suggestions);

    // Set the selected index
    this.suggestionBox.select(this.selectedIndex);

    this.layoutManager.render();
  }

  /**
   * Updates the position of the suggestion box based on the input element
   */
  public updatePosition(): void {
    if (!this.suggestionBox || !this.inputElement) {
      return;
    }

    const inputPos = this.inputElement.position();
    const top = inputPos.y - Math.min(10, this.suggestions.length) - 1;
    const left = inputPos.x;
    const width = Math.max(inputPos.width, 30);

    this.suggestionBox.position.top = top;
    this.suggestionBox.position.left = left;
    this.suggestionBox.width = width;
    this.suggestionBox.height = Math.min(10, this.suggestions.length) + 2;

    this.layoutManager.render();
  }

  /**
   * Gets the current visibility status
   */
  public getVisibility(): boolean {
    return this.isVisible;
  }

  /**
   * Gets the number of suggestions
   */
  public getSuggestionCount(): number {
    return this.suggestions.length;
  }
}
