/**
 * @file EventSubscription.ts
 * @description Event subscription management with automatic cleanup and memory leak prevention
 * @module @core/events
 */

/**
 * Options for configuring event subscriptions
 */
export interface SubscriptionOptions {
  /**
   * Priority level for event handler execution (0-10)
   * Higher priority handlers execute first
   * @default 5
   */
  priority?: number;

  /**
   * Whether the subscription should be removed after first execution
   * @default false
   */
  once?: boolean;

  /**
   * Maximum number of times the handler can be invoked
   * @default Infinity
   */
  maxInvocations?: number;

  /**
   * Optional identifier for the subscription
   */
  id?: string;
}

/**
 * Internal subscription state
 */
interface SubscriptionState {
  invocationCount: number;
  isActive: boolean;
}

/**
 * Represents a single event subscription with automatic cleanup
 */
export class EventSubscription<T = unknown> {
  private readonly _eventPattern: string;
  private readonly _handler: (data: T) => void | Promise<void>;
  private readonly _options: Required<SubscriptionOptions>;
  private readonly _state: SubscriptionState;
  private readonly _createdAt: Date;
  private _unsubscribedAt: Date | null = null;

  /**
   * Creates a new event subscription
   * @param eventPattern - Event name or pattern (supports wildcards)
   * @param handler - Event handler function
   * @param options - Subscription options
   */
  constructor(
    eventPattern: string,
    handler: (data: T) => void | Promise<void>,
    options: SubscriptionOptions = {}
  ) {
    this._eventPattern = eventPattern;
    this._handler = handler;
    this._options = {
      priority: options.priority ?? 5,
      once: options.once ?? false,
      maxInvocations: options.maxInvocations ?? Infinity,
      id: options.id ?? this.generateId(),
    };
    this._state = {
      invocationCount: 0,
      isActive: true,
    };
    this._createdAt = new Date();
  }

  /**
   * Gets the event pattern this subscription listens to
   */
  public get eventPattern(): string {
    return this._eventPattern;
  }

  /**
   * Gets the event handler function
   */
  public get handler(): (data: T) => void | Promise<void> {
    return this._handler;
  }

  /**
   * Gets the subscription priority
   */
  public get priority(): number {
    return this._options.priority;
  }

  /**
   * Gets the subscription unique identifier
   */
  public get id(): string {
    return this._options.id;
  }

  /**
   * Checks if the subscription is still active
   */
  public get isActive(): boolean {
    return this._state.isActive;
  }

  /**
   * Gets the number of times the handler has been invoked
   */
  public get invocationCount(): number {
    return this._state.invocationCount;
  }

  /**
   * Gets the subscription creation timestamp
   */
  public get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Gets the subscription unsubscription timestamp (if unsubscribed)
   */
  public get unsubscribedAt(): Date | null {
    return this._unsubscribedAt;
  }

  /**
   * Checks if this subscription should handle the given event name
   * @param eventName - Event name to check
   * @returns True if the subscription matches the event name
   */
  public matches(eventName: string): boolean {
    if (!this._state.isActive) {
      return false;
    }

    // Exact match
    if (this._eventPattern === eventName) {
      return true;
    }

    // Wildcard match
    if (this._eventPattern.includes('*')) {
      const regexPattern = this._eventPattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(eventName);
    }

    return false;
  }

  /**
   * Invokes the subscription handler with the given data
   * @param data - Event data to pass to the handler
   * @returns Promise that resolves when the handler completes
   */
  public async invoke(data: T): Promise<void> {
    if (!this._state.isActive) {
      return;
    }

    this._state.invocationCount++;

    try {
      await this._handler(data);
    } finally {
      // Auto-unsubscribe if conditions met
      if (this._options.once || this._state.invocationCount >= this._options.maxInvocations) {
        this.unsubscribe();
      }
    }
  }

  /**
   * Unsubscribes the event handler and marks the subscription as inactive
   */
  public unsubscribe(): void {
    if (this._state.isActive) {
      this._state.isActive = false;
      this._unsubscribedAt = new Date();
    }
  }

  /**
   * Gets a serializable representation of the subscription
   * @returns Subscription metadata
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this._options.id,
      eventPattern: this._eventPattern,
      priority: this._options.priority,
      once: this._options.once,
      maxInvocations: this._options.maxInvocations,
      invocationCount: this._state.invocationCount,
      isActive: this._state.isActive,
      createdAt: this._createdAt.toISOString(),
      unsubscribedAt: this._unsubscribedAt?.toISOString() ?? null,
    };
  }

  /**
   * Generates a unique subscription identifier
   * @returns Unique ID string
   */
  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Manages a collection of event subscriptions with automatic cleanup
 */
export class SubscriptionManager<
  EventMap extends Record<string, unknown> = Record<string, unknown>,
> {
  private readonly _subscriptions: Map<string, EventSubscription[]>;
  private readonly _subscriptionsById: Map<string, EventSubscription>;

  constructor() {
    this._subscriptions = new Map();
    this._subscriptionsById = new Map();
  }

  /**
   * Adds a new subscription to the manager
   * @param subscription - Subscription to add
   */
  public add<K extends keyof EventMap>(subscription: EventSubscription<EventMap[K]>): void {
    const pattern = subscription.eventPattern;

    // Add to pattern map
    const existing = this._subscriptions.get(pattern) ?? [];
    existing.push(subscription as EventSubscription);
    existing.sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
    this._subscriptions.set(pattern, existing);

    // Add to ID map
    this._subscriptionsById.set(subscription.id, subscription as EventSubscription);
  }

  /**
   * Removes a subscription by ID
   * @param id - Subscription ID to remove
   * @returns True if the subscription was found and removed
   */
  public removeById(id: string): boolean {
    const subscription = this._subscriptionsById.get(id);
    if (!subscription) {
      return false;
    }

    subscription.unsubscribe();
    this._subscriptionsById.delete(id);

    // Remove from pattern map
    const pattern = subscription.eventPattern;
    const subscriptions = this._subscriptions.get(pattern);
    if (subscriptions) {
      const filtered = subscriptions.filter((sub) => sub.id !== id);
      if (filtered.length === 0) {
        this._subscriptions.delete(pattern);
      } else {
        this._subscriptions.set(pattern, filtered);
      }
    }

    return true;
  }

  /**
   * Removes all subscriptions matching a pattern
   * @param pattern - Event pattern to remove
   * @returns Number of subscriptions removed
   */
  public removeByPattern(pattern: string): number {
    const subscriptions = this._subscriptions.get(pattern);
    if (!subscriptions) {
      return 0;
    }

    const count = subscriptions.length;
    for (const subscription of subscriptions) {
      subscription.unsubscribe();
      this._subscriptionsById.delete(subscription.id);
    }

    this._subscriptions.delete(pattern);
    return count;
  }

  /**
   * Gets all active subscriptions matching an event name
   * @param eventName - Event name to match
   * @returns Array of matching subscriptions sorted by priority
   */
  public getMatching(eventName: string): EventSubscription[] {
    const matching: EventSubscription[] = [];

    for (const subscriptions of this._subscriptions.values()) {
      for (const subscription of subscriptions) {
        if (subscription.matches(eventName)) {
          matching.push(subscription);
        }
      }
    }

    // Sort by priority (highest first)
    matching.sort((a, b) => b.priority - a.priority);

    return matching;
  }

  /**
   * Gets a subscription by ID
   * @param id - Subscription ID
   * @returns Subscription or undefined if not found
   */
  public getById(id: string): EventSubscription | undefined {
    return this._subscriptionsById.get(id);
  }

  /**
   * Gets all active subscriptions
   * @returns Array of all active subscriptions
   */
  public getAll(): EventSubscription[] {
    return Array.from(this._subscriptionsById.values()).filter((sub) => sub.isActive);
  }

  /**
   * Removes all inactive subscriptions to prevent memory leaks
   * @returns Number of subscriptions cleaned up
   */
  public cleanup(): number {
    let cleanedCount = 0;

    for (const [pattern, subscriptions] of this._subscriptions.entries()) {
      const active = subscriptions.filter((sub) => sub.isActive);
      const inactiveCount = subscriptions.length - active.length;

      if (inactiveCount > 0) {
        cleanedCount += inactiveCount;

        // Remove inactive from ID map
        for (const subscription of subscriptions) {
          if (!subscription.isActive) {
            this._subscriptionsById.delete(subscription.id);
          }
        }

        // Update pattern map
        if (active.length === 0) {
          this._subscriptions.delete(pattern);
        } else {
          this._subscriptions.set(pattern, active);
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Removes all subscriptions
   */
  public clear(): void {
    for (const subscription of this._subscriptionsById.values()) {
      subscription.unsubscribe();
    }

    this._subscriptions.clear();
    this._subscriptionsById.clear();
  }

  /**
   * Gets the total number of active subscriptions
   */
  public get size(): number {
    return this._subscriptionsById.size;
  }

  /**
   * Gets subscription statistics
   * @returns Subscription statistics object
   */
  public getStats(): {
    total: number;
    active: number;
    inactive: number;
    patterns: number;
  } {
    const all = Array.from(this._subscriptionsById.values());
    const active = all.filter((sub) => sub.isActive);

    return {
      total: all.length,
      active: active.length,
      inactive: all.length - active.length,
      patterns: this._subscriptions.size,
    };
  }
}
