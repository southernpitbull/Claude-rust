/**
 * ProgressIndicator.ts
 *
 * Progress indication system for the AIrchitect CLI.
 * Provides spinners, progress bars, and status updates for long-running operations.
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

/**
 * Progress indicator types
 */
export enum ProgressType {
  SPINNER = 'spinner',
  BAR = 'bar',
  STEPS = 'steps',
}

/**
 * Spinner configurations
 */
export const SPINNER_TYPES = {
  dots: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] },
  line: { interval: 130, frames: ['-', '\\', '|', '/'] },
  bounce: { interval: 80, frames: ['⠁', '⠂', '⠄', '⠂'] },
  circle: { interval: 120, frames: ['◐', '◓', '◑', '◒'] },
  dots2: { interval: 80, frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'] },
};

/**
 * Configuration for ProgressIndicator
 */
export interface IProgressIndicatorConfig {
  type?: ProgressType;
  text?: string;
  color?: string;
  spinner?: keyof typeof SPINNER_TYPES;
}

/**
 * Step configuration for step-based progress
 */
export interface IProgressStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

/**
 * ProgressIndicator class for displaying progress in the CLI
 */
export class ProgressIndicator {
  private type: ProgressType;
  private spinner: Ora | null;
  private steps: IProgressStep[];
  private currentStep: number;
  private total: number;
  private current: number;
  private startTime: number;

  /**
   * Creates a new ProgressIndicator instance
   * @param config - Progress indicator configuration
   */
  constructor(config: IProgressIndicatorConfig = {}) {
    this.type = config.type ?? ProgressType.SPINNER;
    this.spinner = null;
    this.steps = [];
    this.currentStep = 0;
    this.total = 100;
    this.current = 0;
    this.startTime = Date.now();

    if (this.type === ProgressType.SPINNER) {
      const spinnerType = config.spinner ?? 'dots';
      this.spinner = ora({
        text: config.text ?? 'Loading...',
        color: (config.color as 'cyan' | 'yellow' | 'green') ?? 'cyan',
        spinner: SPINNER_TYPES[spinnerType],
      });
    }
  }

  /**
   * Start the progress indicator
   * @param text - Optional text to display
   */
  public start(text?: string): void {
    this.startTime = Date.now();

    switch (this.type) {
      case ProgressType.SPINNER:
        if (this.spinner !== null) {
          if (text) {
            this.spinner.text = text;
          }
          this.spinner.start();
        }
        break;
      case ProgressType.BAR:
        this.renderProgressBar();
        break;
      case ProgressType.STEPS:
        this.renderSteps();
        break;
    }
  }

  /**
   * Update the progress indicator
   * @param options - Update options
   */
  public update(options: {
    text?: string;
    progress?: number;
    step?: number;
    stepStatus?: 'running' | 'completed' | 'failed';
  }): void {
    switch (this.type) {
      case ProgressType.SPINNER:
        if (this.spinner !== null && options.text) {
          this.spinner.text = options.text;
        }
        break;
      case ProgressType.BAR:
        if (options.progress !== undefined) {
          this.current = options.progress;
          this.renderProgressBar();
        }
        break;
      case ProgressType.STEPS:
        if (options.step !== undefined) {
          this.currentStep = options.step;
          if (options.stepStatus && this.steps[this.currentStep]) {
            this.steps[this.currentStep].status = options.stepStatus;
            if (options.text) {
              this.steps[this.currentStep].message = options.text;
            }
          }
          this.renderSteps();
        }
        break;
    }
  }

  /**
   * Complete the progress indicator with success
   * @param text - Completion message
   */
  public succeed(text?: string): void {
    const elapsed = this.getElapsedTime();

    switch (this.type) {
      case ProgressType.SPINNER:
        if (this.spinner !== null) {
          this.spinner.succeed(text ? `${text} ${chalk.gray(`(${elapsed})`)}` : undefined);
        }
        break;
      case ProgressType.BAR:
        this.current = this.total;
        this.renderProgressBar();
        console.log(chalk.green(`✓ ${text ?? 'Completed'} ${chalk.gray(`(${elapsed})`)}`));
        break;
      case ProgressType.STEPS:
        if (this.currentStep < this.steps.length) {
          this.steps[this.currentStep].status = 'completed';
        }
        this.renderSteps();
        console.log(
          chalk.green(`✓ ${text ?? 'All steps completed'} ${chalk.gray(`(${elapsed})`)}`)
        );
        break;
    }
  }

  /**
   * Complete the progress indicator with failure
   * @param text - Failure message
   */
  public fail(text?: string): void {
    const elapsed = this.getElapsedTime();

    switch (this.type) {
      case ProgressType.SPINNER:
        if (this.spinner !== null) {
          this.spinner.fail(text ? `${text} ${chalk.gray(`(${elapsed})`)}` : undefined);
        }
        break;
      case ProgressType.BAR:
        console.log(chalk.red(`✗ ${text ?? 'Failed'} ${chalk.gray(`(${elapsed})`)}`));
        break;
      case ProgressType.STEPS:
        if (this.currentStep < this.steps.length) {
          this.steps[this.currentStep].status = 'failed';
        }
        this.renderSteps();
        console.log(chalk.red(`✗ ${text ?? 'Step failed'} ${chalk.gray(`(${elapsed})`)}`));
        break;
    }
  }

  /**
   * Complete the progress indicator with warning
   * @param text - Warning message
   */
  public warn(text?: string): void {
    const elapsed = this.getElapsedTime();

    if (this.spinner !== null && this.type === ProgressType.SPINNER) {
      this.spinner.warn(text ? `${text} ${chalk.gray(`(${elapsed})`)}` : undefined);
    } else {
      console.log(chalk.yellow(`⚠ ${text ?? 'Warning'} ${chalk.gray(`(${elapsed})`)}`));
    }
  }

  /**
   * Stop the progress indicator
   */
  public stop(): void {
    if (this.spinner !== null && this.type === ProgressType.SPINNER) {
      this.spinner.stop();
    }
  }

  /**
   * Set total for progress bar
   * @param total - Total value
   */
  public setTotal(total: number): void {
    this.total = total;
  }

  /**
   * Increment progress
   * @param amount - Amount to increment
   */
  public increment(amount: number = 1): void {
    this.current += amount;
    if (this.current > this.total) {
      this.current = this.total;
    }
    if (this.type === ProgressType.BAR) {
      this.renderProgressBar();
    }
  }

  /**
   * Set steps for step-based progress
   * @param steps - Array of step names
   */
  public setSteps(steps: string[]): void {
    this.steps = steps.map((name) => ({
      name,
      status: 'pending',
    }));
    this.currentStep = 0;
  }

  /**
   * Move to next step
   * @param status - Status of current step before moving
   */
  public nextStep(status: 'completed' | 'failed' = 'completed'): void {
    if (this.currentStep < this.steps.length) {
      this.steps[this.currentStep].status = status;
      this.currentStep++;
      if (this.currentStep < this.steps.length) {
        this.steps[this.currentStep].status = 'running';
      }
      this.renderSteps();
    }
  }

  /**
   * Render progress bar
   */
  private renderProgressBar(): void {
    const percentage = Math.min(100, Math.floor((this.current / this.total) * 100));
    const barLength = 40;
    const filledLength = Math.floor((barLength * percentage) / 100);
    const emptyLength = barLength - filledLength;

    const filledBar = chalk.cyan('█'.repeat(filledLength));
    const emptyBar = chalk.gray('░'.repeat(emptyLength));
    const percentageStr = chalk.bold(`${percentage}%`);

    // Clear line and render
    process.stdout.write('\r');
    process.stdout.write(
      `${filledBar}${emptyBar} ${percentageStr} (${this.current}/${this.total})`
    );

    if (percentage === 100) {
      process.stdout.write('\n');
    }
  }

  /**
   * Render step-based progress
   */
  private renderSteps(): void {
    console.clear();
    console.log(chalk.bold('Progress:\n'));

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      let icon: string;
      let color: (text: string) => string;

      switch (step.status) {
        case 'completed':
          icon = '✓';
          color = chalk.green;
          break;
        case 'running':
          icon = '◐';
          color = chalk.cyan;
          break;
        case 'failed':
          icon = '✗';
          color = chalk.red;
          break;
        case 'pending':
        default:
          icon = '○';
          color = chalk.gray;
          break;
      }

      const stepText = `${color(icon)} ${step.name}`;
      const message = step.message ? chalk.gray(` - ${step.message}`) : '';
      console.log(`${stepText}${message}`);
    }

    console.log('');
  }

  /**
   * Get elapsed time since start
   * @returns Formatted elapsed time string
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const ms = elapsed % 1000;

    if (seconds > 0) {
      return `${seconds}.${Math.floor(ms / 100)}s`;
    }
    return `${ms}ms`;
  }

  /**
   * Create a spinner progress indicator
   * @param text - Initial text
   * @param spinner - Spinner type
   * @returns New ProgressIndicator instance
   */
  public static spinner(
    text: string = 'Loading...',
    spinner: keyof typeof SPINNER_TYPES = 'dots'
  ): ProgressIndicator {
    return new ProgressIndicator({
      type: ProgressType.SPINNER,
      text,
      spinner,
    });
  }

  /**
   * Create a progress bar indicator
   * @param total - Total value
   * @returns New ProgressIndicator instance
   */
  public static bar(total: number = 100): ProgressIndicator {
    const indicator = new ProgressIndicator({ type: ProgressType.BAR });
    indicator.setTotal(total);
    return indicator;
  }

  /**
   * Create a step-based progress indicator
   * @param steps - Array of step names
   * @returns New ProgressIndicator instance
   */
  public static steps(steps: string[]): ProgressIndicator {
    const indicator = new ProgressIndicator({ type: ProgressType.STEPS });
    indicator.setSteps(steps);
    return indicator;
  }
}
