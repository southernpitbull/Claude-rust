/**
 * DueDateCalculator.ts
 *
 * Calculates intelligent due dates for Linear issues based on business days,
 * holidays, timezone awareness, SLA requirements, and dependency chains.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface BusinessHours {
  monday?: { start: string; end: string }; // HH:MM format
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string; end: string };
  sunday?: { start: string; end: string };
}

export interface Holiday {
  date: string; // YYYY-MM-DD format
  name: string;
  observed?: boolean; // Whether the holiday is observed
}

export interface SLAConfiguration {
  priority: 'urgent' | 'high' | 'normal' | 'low';
  responseTimeHours: number; // Hours to first response
  resolutionTimeHours: number; // Hours to resolution
  businessHoursOnly: boolean; // Whether SLA counts only business hours
}

export interface DependencyChain {
  issueId: string;
  dependencies: string[]; // Issue IDs that this issue depends on
  dependentOn: string[]; // Issue IDs that depend on this issue
}

export interface TimeEstimate {
  issueId: string;
  estimatedHours: number;
  complexity: number; // 1-5 scale
  confidence: number; // 0-100 percentage
}

export class DueDateCalculator {
  private linearClient: LinearClient;
  private businessHours: BusinessHours;
  private holidays: Holiday[];
  private slas: SLAConfiguration[];
  private timezone: string;
  private logger: Logger;

  constructor(
    linearClient: LinearClient,
    timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) {
    this.linearClient = linearClient;
    this.businessHours = {};
    this.holidays = [];
    this.slas = [];
    this.timezone = timezone;
    this.logger = new Logger('DueDateCalculator');

    // Set default business hours (9 AM to 5 PM, Mon-Fri)
    this.setDefaultBusinessHours();
    this.setDefaultSLAs();
  }

  /**
   * Set default business hours
   */
  private setDefaultBusinessHours(): void {
    this.businessHours = {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
    };
  }

  /**
   * Set default SLA configurations
   */
  private setDefaultSLAs(): void {
    this.slas = [
      { priority: 'urgent', responseTimeHours: 1, resolutionTimeHours: 4, businessHoursOnly: true },
      { priority: 'high', responseTimeHours: 4, resolutionTimeHours: 24, businessHoursOnly: true },
      {
        priority: 'normal',
        responseTimeHours: 8,
        resolutionTimeHours: 72,
        businessHoursOnly: true,
      },
      { priority: 'low', responseTimeHours: 24, resolutionTimeHours: 168, businessHoursOnly: true },
    ];
  }

  /**
   * Set custom business hours
   */
  public setBusinessHours(hours: BusinessHours): void {
    try {
      this.logger.info('Setting custom business hours');
      this.businessHours = { ...this.businessHours, ...hours };
      this.logger.info('Custom business hours set successfully');
    } catch (error) {
      this.logger.error('Failed to set custom business hours', error);
      throw error;
    }
  }

  /**
   * Add holidays to the calendar
   */
  public addHolidays(holidays: Holiday[]): void {
    try {
      this.logger.info(`Adding ${holidays.length} holidays to calendar`);

      // Add new holidays, avoiding duplicates
      for (const holiday of holidays) {
        const existingIndex = this.holidays.findIndex((h) => h.date === holiday.date);
        if (existingIndex >= 0) {
          // Update existing holiday
          this.holidays[existingIndex] = holiday;
        } else {
          // Add new holiday
          this.holidays.push(holiday);
        }
      }

      // Sort holidays by date
      this.holidays.sort((a, b) => a.date.localeCompare(b.date));

      this.logger.info('Holidays added successfully');
    } catch (error) {
      this.logger.error('Failed to add holidays', error);
      throw error;
    }
  }

  /**
   * Remove a holiday by date
   */
  public removeHoliday(date: string): boolean {
    try {
      this.logger.info(`Removing holiday: ${date}`);

      const initialLength = this.holidays.length;
      this.holidays = this.holidays.filter((holiday) => holiday.date !== date);

      const removed = this.holidays.length < initialLength;
      if (removed) {
        this.logger.info(`Holiday removed successfully: ${date}`);
      } else {
        this.logger.warn(`Holiday not found: ${date}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove holiday: ${date}`, error);
      throw error;
    }
  }

  /**
   * Get all holidays
   */
  public getHolidays(): Holiday[] {
    return [...this.holidays];
  }

  /**
   * Check if a date is a holiday
   */
  public isHoliday(date: Date): boolean {
    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      return this.holidays.some((holiday) => holiday.date === dateString);
    } catch (error) {
      this.logger.error('Failed to check if date is holiday', error);
      throw error;
    }
  }

  /**
   * Set SLA configurations
   */
  public setSLAs(slas: SLAConfiguration[]): void {
    try {
      this.logger.info(`Setting ${slas.length} SLA configurations`);
      this.slas = [...slas];
      this.logger.info('SLA configurations set successfully');
    } catch (error) {
      this.logger.error('Failed to set SLA configurations', error);
      throw error;
    }
  }

  /**
   * Get SLA configuration for a priority level
   */
  public getSLAForPriority(priority: string): SLAConfiguration | undefined {
    return this.slas.find((sla) => sla.priority === priority);
  }

  /**
   * Calculate business days between two dates
   */
  public calculateBusinessDays(startDate: Date, endDate: Date): number {
    try {
      this.logger.info(
        `Calculating business days between ${startDate.toISOString()} and ${endDate.toISOString()}`
      );

      const currentDate = new Date(startDate);
      let businessDays = 0;

      // Normalize to start of day
      currentDate.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      // Iterate through each day
      while (currentDate <= end) {
        // Check if it's a weekday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const dayOfWeek = currentDate.getDay();
        const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;

        // Check if it's a business day (not weekend and not holiday)
        if (isWeekday && !this.isHoliday(currentDate)) {
          businessDays++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.logger.info(`Calculated ${businessDays} business days`);
      return businessDays;
    } catch (error) {
      this.logger.error('Failed to calculate business days', error);
      throw error;
    }
  }

  /**
   * Add business days to a date
   */
  public addBusinessDays(date: Date, days: number): Date {
    try {
      this.logger.info(`Adding ${days} business days to ${date.toISOString()}`);

      const result = new Date(date);
      let businessDaysAdded = 0;

      // Add business days one by one
      while (businessDaysAdded < days) {
        result.setDate(result.getDate() + 1);

        // Check if it's a business day
        const dayOfWeek = result.getDay();
        const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;

        if (isWeekday && !this.isHoliday(result)) {
          businessDaysAdded++;
        }
      }

      this.logger.info(`Added business days, result: ${result.toISOString()}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to add business days', error);
      throw error;
    }
  }

  /**
   * Calculate due date based on SLA
   */
  public calculateSLADueDate(issue: LinearIssue): Date | null {
    try {
      this.logger.info(`Calculating SLA due date for issue: ${issue.id}`);

      // Get SLA configuration for the issue priority
      const sla = this.getSLAForPriority(issue.priority);
      if (!sla) {
        this.logger.warn(`No SLA found for priority: ${issue.priority}`);
        return null;
      }

      // Start from current time
      const startDate = new Date();

      // Calculate due date based on SLA
      let dueDate: Date;

      if (sla.businessHoursOnly) {
        // Add business hours
        dueDate = this.addBusinessHours(startDate, sla.resolutionTimeHours);
      } else {
        // Add calendar hours
        dueDate = new Date(startDate.getTime() + sla.resolutionTimeHours * 60 * 60 * 1000);
      }

      this.logger.info(`SLA due date calculated: ${dueDate.toISOString()}`);
      return dueDate;
    } catch (error) {
      this.logger.error(`Failed to calculate SLA due date for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Add business hours to a date
   */
  public addBusinessHours(date: Date, hours: number): Date {
    try {
      this.logger.info(`Adding ${hours} business hours to ${date.toISOString()}`);

      let result = new Date(date);
      let hoursRemaining = hours;

      // Process hours in chunks to handle business hours properly
      while (hoursRemaining > 0) {
        // Get business hours for current day
        const dayOfWeek = result.getDay();
        const businessHours = this.getBusinessHoursForDay(dayOfWeek);

        if (businessHours) {
          // Check if current time is within business hours
          const [currentHour, currentMinute] = [result.getHours(), result.getMinutes()];
          const currentTimeInMinutes = currentHour * 60 + currentMinute;

          const [startHour, startMinute] = businessHours.start.split(':').map(Number);
          const startTimeInMinutes = startHour * 60 + startMinute;

          const [endHour, endMinute] = businessHours.end.split(':').map(Number);
          const endTimeInMinutes = endHour * 60 + endMinute;

          // If current time is before business hours, move to start of business hours
          if (currentTimeInMinutes < startTimeInMinutes) {
            result.setHours(startHour, startMinute, 0, 0);
            currentTimeInMinutes = startTimeInMinutes;
          }

          // If current time is within business hours
          if (
            currentTimeInMinutes >= startTimeInMinutes &&
            currentTimeInMinutes < endTimeInMinutes
          ) {
            // Calculate available business hours today
            const availableToday = (endTimeInMinutes - currentTimeInMinutes) / 60;

            if (hoursRemaining <= availableToday) {
              // Add remaining hours to current day
              const totalMinutes = currentTimeInMinutes + hoursRemaining * 60;
              const finalHour = Math.floor(totalMinutes / 60);
              const finalMinute = Math.round(totalMinutes % 60);
              result.setHours(finalHour, finalMinute, 0, 0);
              hoursRemaining = 0;
            } else {
              // Use all available hours today and move to next business day
              result.setHours(endHour, endMinute, 0, 0);
              hoursRemaining -= availableToday;
            }
          } else {
            // Current time is after business hours, move to next business day
            result = this.getNextBusinessDay(result);
          }
        } else {
          // No business hours for this day, move to next day
          result = this.getNextBusinessDay(result);
        }
      }

      this.logger.info(`Added business hours, result: ${result.toISOString()}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to add business hours', error);
      throw error;
    }
  }

  /**
   * Get business hours for a specific day of the week
   */
  private getBusinessHoursForDay(dayOfWeek: number): { start: string; end: string } | null {
    try {
      switch (dayOfWeek) {
        case 0:
          return this.businessHours.sunday || null;
        case 1:
          return this.businessHours.monday || null;
        case 2:
          return this.businessHours.tuesday || null;
        case 3:
          return this.businessHours.wednesday || null;
        case 4:
          return this.businessHours.thursday || null;
        case 5:
          return this.businessHours.friday || null;
        case 6:
          return this.businessHours.saturday || null;
        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get business hours for day: ${dayOfWeek}`, error);
      throw error;
    }
  }

  /**
   * Get the next business day
   */
  private getNextBusinessDay(date: Date): Date {
    try {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Skip weekends and holidays
      while (true) {
        const dayOfWeek = nextDay.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = this.isHoliday(nextDay);

        if (!isWeekend && !isHoliday) {
          // Found a business day
          // Set to start of business hours
          const businessHours = this.getBusinessHoursForDay(dayOfWeek);
          if (businessHours) {
            const [startHour, startMinute] = businessHours.start.split(':').map(Number);
            nextDay.setHours(startHour, startMinute, 0, 0);
          } else {
            nextDay.setHours(9, 0, 0, 0); // Default to 9 AM
          }
          break;
        }

        nextDay.setDate(nextDay.getDate() + 1);
      }

      return nextDay;
    } catch (error) {
      this.logger.error('Failed to get next business day', error);
      throw error;
    }
  }

  /**
   * Calculate due date based on dependencies
   */
  public async calculateDependencyDueDate(
    issue: LinearIssue,
    dependencies: DependencyChain
  ): Promise<Date | null> {
    try {
      this.logger.info(`Calculating dependency due date for issue: ${issue.id}`);

      // If no dependencies, return null (use other methods)
      if (!dependencies.dependencies || dependencies.dependencies.length === 0) {
        this.logger.info(`No dependencies for issue: ${issue.id}`);
        return null;
      }

      // Get due dates of all dependencies
      const dependencyDueDates: Date[] = [];

      for (const dependencyId of dependencies.dependencies) {
        try {
          const dependency = await this.linearClient.getIssueById(dependencyId);
          if (dependency && dependency.dueDate) {
            dependencyDueDates.push(new Date(dependency.dueDate));
          }
        } catch (error) {
          this.logger.warn(`Failed to get dependency issue: ${dependencyId}`, error);
        }
      }

      // If no dependencies have due dates, return null
      if (dependencyDueDates.length === 0) {
        this.logger.info(`No dependencies with due dates for issue: ${issue.id}`);
        return null;
      }

      // Find the latest due date among dependencies
      const latestDependencyDueDate = new Date(
        Math.max(...dependencyDueDates.map((date) => date.getTime()))
      );

      // Add buffer time (e.g., 1 business day)
      const dueDate = this.addBusinessDays(latestDependencyDueDate, 1);

      this.logger.info(`Dependency due date calculated: ${dueDate.toISOString()}`);
      return dueDate;
    } catch (error) {
      this.logger.error(`Failed to calculate dependency due date for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Calculate due date based on time estimates
   */
  public calculateEstimateDueDate(issue: LinearIssue, estimate: TimeEstimate): Date | null {
    try {
      this.logger.info(`Calculating estimate due date for issue: ${issue.id}`);

      // If no estimate, return null
      if (!estimate.estimatedHours || estimate.estimatedHours <= 0) {
        this.logger.info(`No valid estimate for issue: ${issue.id}`);
        return null;
      }

      // Start from current time
      const startDate = new Date();

      // Add estimated hours as business hours
      const dueDate = this.addBusinessHours(startDate, estimate.estimatedHours);

      this.logger.info(`Estimate due date calculated: ${dueDate.toISOString()}`);
      return dueDate;
    } catch (error) {
      this.logger.error(`Failed to calculate estimate due date for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Calculate the most appropriate due date using all available methods
   */
  public async calculateOptimalDueDate(
    issue: LinearIssue,
    options?: {
      estimate?: TimeEstimate;
      dependencies?: DependencyChain;
      overrideSLA?: boolean;
    }
  ): Promise<Date | null> {
    try {
      this.logger.info(`Calculating optimal due date for issue: ${issue.id}`);

      const dueDates: Date[] = [];

      // 1. SLA-based due date
      if (!options?.overrideSLA) {
        const slaDueDate = this.calculateSLADueDate(issue);
        if (slaDueDate) {
          dueDates.push(slaDueDate);
        }
      }

      // 2. Dependency-based due date
      if (options?.dependencies) {
        const dependencyDueDate = await this.calculateDependencyDueDate(
          issue,
          options.dependencies
        );
        if (dependencyDueDate) {
          dueDates.push(dependencyDueDate);
        }
      }

      // 3. Estimate-based due date
      if (options?.estimate) {
        const estimateDueDate = this.calculateEstimateDueDate(issue, options.estimate);
        if (estimateDueDate) {
          dueDates.push(estimateDueDate);
        }
      }

      // If no due dates calculated, return null
      if (dueDates.length === 0) {
        this.logger.info(`No due dates calculated for issue: ${issue.id}`);
        return null;
      }

      // Return the earliest due date (most conservative)
      const optimalDueDate = new Date(Math.min(...dueDates.map((date) => date.getTime())));

      this.logger.info(`Optimal due date calculated: ${optimalDueDate.toISOString()}`);
      return optimalDueDate;
    } catch (error) {
      this.logger.error(`Failed to calculate optimal due date for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Set due date on an issue in Linear
   */
  public async setDueDate(issueId: string, dueDate: Date): Promise<boolean> {
    try {
      this.logger.info(`Setting due date for issue: ${issueId} to ${dueDate.toISOString()}`);

      await this.linearClient.updateIssue(issueId, {
        dueDate: dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
      });

      this.logger.info(`Due date set successfully for issue: ${issueId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set due date for issue: ${issueId}`, error);
      throw error;
    }
  }

  /**
   * Bulk calculate and set due dates for multiple issues
   */
  public async bulkCalculateDueDates(
    issues: LinearIssue[],
    estimates?: Record<string, TimeEstimate>,
    dependencies?: Record<string, DependencyChain>
  ): Promise<Array<{ issueId: string; dueDate: Date | null; success: boolean }>> {
    try {
      this.logger.info(`Bulk calculating due dates for ${issues.length} issues`);

      const results: Array<{ issueId: string; dueDate: Date | null; success: boolean }> = [];

      for (const issue of issues) {
        try {
          const estimate = estimates?.[issue.id];
          const dependencyChain = dependencies?.[issue.id];

          const dueDate = await this.calculateOptimalDueDate(issue, {
            estimate,
            dependencies: dependencyChain,
          });

          let success = false;
          if (dueDate) {
            success = await this.setDueDate(issue.id, dueDate);
          }

          results.push({
            issueId: issue.id,
            dueDate,
            success,
          });
        } catch (error) {
          this.logger.error(`Failed to calculate due date for issue: ${issue.id}`, error);
          results.push({
            issueId: issue.id,
            dueDate: null,
            success: false,
          });
        }
      }

      const successful = results.filter((r) => r.success).length;
      this.logger.info(
        `Bulk due date calculation completed: ${successful}/${issues.length} successful`
      );

      return results;
    } catch (error) {
      this.logger.error('Failed to bulk calculate due dates', error);
      throw error;
    }
  }

  /**
   * Get due date statistics
   */
  public getDueDateStats(issues: LinearIssue[]): {
    totalIssues: number;
    issuesWithDueDates: number;
    overdueIssues: number;
    approachingDueIssues: number; // Within 24 hours
    averageDaysUntilDue: number;
    medianDaysUntilDue: number;
  } {
    try {
      this.logger.info('Generating due date statistics');

      const now = new Date();
      const stats = {
        totalIssues: issues.length,
        issuesWithDueDates: 0,
        overdueIssues: 0,
        approachingDueIssues: 0,
        averageDaysUntilDue: 0,
        medianDaysUntilDue: 0,
      };

      const daysUntilDue: number[] = [];

      for (const issue of issues) {
        if (issue.dueDate) {
          stats.issuesWithDueDates++;

          const dueDate = new Date(issue.dueDate);
          const daysUntil = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

          daysUntilDue.push(daysUntil);

          if (daysUntil < 0) {
            stats.overdueIssues++;
          } else if (daysUntil <= 1) {
            stats.approachingDueIssues++;
          }
        }
      }

      // Calculate averages
      if (daysUntilDue.length > 0) {
        stats.averageDaysUntilDue =
          daysUntilDue.reduce((sum, days) => sum + days, 0) / daysUntilDue.length;

        // Calculate median
        const sortedDays = [...daysUntilDue].sort((a, b) => a - b);
        const mid = Math.floor(sortedDays.length / 2);
        stats.medianDaysUntilDue =
          sortedDays.length % 2 !== 0
            ? sortedDays[mid]
            : (sortedDays[mid - 1] + sortedDays[mid]) / 2;
      }

      this.logger.info('Due date statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate due date statistics', error);
      throw error;
    }
  }

  /**
   * Identify issues that need due date attention
   */
  public identifyDueDateAttentionIssues(issues: LinearIssue[]): {
    overdue: LinearIssue[];
    approaching: LinearIssue[];
    missing: LinearIssue[];
  } {
    try {
      this.logger.info('Identifying issues needing due date attention');

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const attentionIssues = {
        overdue: [] as LinearIssue[],
        approaching: [] as LinearIssue[],
        missing: [] as LinearIssue[],
      };

      for (const issue of issues) {
        if (!issue.dueDate) {
          attentionIssues.missing.push(issue);
        } else {
          const dueDate = new Date(issue.dueDate);

          if (dueDate < now) {
            attentionIssues.overdue.push(issue);
          } else if (dueDate <= tomorrow) {
            attentionIssues.approaching.push(issue);
          }
        }
      }

      this.logger.info(
        `Identified attention issues: ${attentionIssues.overdue.length} overdue, ` +
          `${attentionIssues.approaching.length} approaching, ${attentionIssues.missing.length} missing`
      );

      return attentionIssues;
    } catch (error) {
      this.logger.error('Failed to identify due date attention issues', error);
      throw error;
    }
  }

  /**
   * Suggest due dates for issues without them
   */
  public async suggestDueDates(
    issues: LinearIssue[]
  ): Promise<Array<{ issueId: string; suggestedDate: Date | null; reason: string }>> {
    try {
      this.logger.info(`Suggesting due dates for ${issues.length} issues`);

      const suggestions: Array<{ issueId: string; suggestedDate: Date | null; reason: string }> =
        [];

      for (const issue of issues) {
        if (issue.dueDate) {
          // Already has due date
          suggestions.push({
            issueId: issue.id,
            suggestedDate: null,
            reason: 'Already has due date',
          });
          continue;
        }

        try {
          // Calculate suggested due date
          const suggestedDate = await this.calculateOptimalDueDate(issue);

          suggestions.push({
            issueId: issue.id,
            suggestedDate,
            reason: suggestedDate
              ? 'Calculated based on SLA and issue characteristics'
              : 'Unable to calculate due date',
          });
        } catch (error) {
          this.logger.error(`Failed to suggest due date for issue: ${issue.id}`, error);
          suggestions.push({
            issueId: issue.id,
            suggestedDate: null,
            reason: 'Error calculating due date',
          });
        }
      }

      this.logger.info(`Due date suggestions generated for ${issues.length} issues`);
      return suggestions;
    } catch (error) {
      this.logger.error('Failed to suggest due dates', error);
      throw error;
    }
  }
}
