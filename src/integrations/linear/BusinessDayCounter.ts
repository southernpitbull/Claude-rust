/**
 * BusinessDayCounter.ts
 *
 * Counts business days between dates, handles working hours configuration,
 * weekend detection, and custom work week support for Linear integration.
 */

import { Logger } from '../../utils/Logger';

export interface WorkingHours {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

export interface WorkWeekConfig {
  monday?: WorkingHours;
  tuesday?: WorkingHours;
  wednesday?: WorkingHours;
  thursday?: WorkingHours;
  friday?: WorkingHours;
  saturday?: WorkingHours;
  sunday?: WorkingHours;
}

export interface Holiday {
  date: Date;
  name: string;
  isObserved: boolean;
}

export class BusinessDayCounter {
  private workWeek: WorkWeekConfig;
  private holidays: Holiday[];
  private timezone: string;
  private logger: Logger;

  constructor(timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    this.workWeek = this.getDefaultWorkWeek();
    this.holidays = [];
    this.timezone = timezone;
    this.logger = new Logger('BusinessDayCounter');
  }

  /**
   * Get default work week configuration (Mon-Fri, 9 AM to 5 PM)
   */
  private getDefaultWorkWeek(): WorkWeekConfig {
    const defaultHours: WorkingHours = { start: '09:00', end: '17:00' };
    return {
      monday: defaultHours,
      tuesday: defaultHours,
      wednesday: defaultHours,
      thursday: defaultHours,
      friday: defaultHours,
    };
  }

  /**
   * Set custom work week configuration
   */
  public setWorkWeek(workWeek: WorkWeekConfig): void {
    try {
      this.logger.info('Setting custom work week configuration');
      this.workWeek = workWeek;
      this.logger.info('Custom work week configuration set successfully');
    } catch (error) {
      this.logger.error('Failed to set custom work week configuration', error);
      throw error;
    }
  }

  /**
   * Get current work week configuration
   */
  public getWorkWeek(): WorkWeekConfig {
    return { ...this.workWeek };
  }

  /**
   * Add holidays to the calendar
   */
  public addHolidays(holidays: Holiday[]): void {
    try {
      this.logger.info(`Adding ${holidays.length} holidays to calendar`);

      // Add new holidays, avoiding duplicates
      for (const holiday of holidays) {
        const dateString = holiday.date.toISOString().split('T')[0];
        const existingIndex = this.holidays.findIndex(
          (h) => h.date.toISOString().split('T')[0] === dateString
        );

        if (existingIndex >= 0) {
          // Update existing holiday
          this.holidays[existingIndex] = holiday;
        } else {
          // Add new holiday
          this.holidays.push(holiday);
        }
      }

      // Sort holidays by date
      this.holidays.sort((a, b) => a.date.getTime() - b.date.getTime());

      this.logger.info('Holidays added successfully');
    } catch (error) {
      this.logger.error('Failed to add holidays', error);
      throw error;
    }
  }

  /**
   * Remove a holiday by date
   */
  public removeHoliday(date: Date): boolean {
    try {
      this.logger.info(`Removing holiday: ${date.toISOString()}`);

      const dateString = date.toISOString().split('T')[0];
      const initialLength = this.holidays.length;
      this.holidays = this.holidays.filter(
        (holiday) => holiday.date.toISOString().split('T')[0] !== dateString
      );

      const removed = this.holidays.length < initialLength;
      if (removed) {
        this.logger.info(`Holiday removed successfully: ${dateString}`);
      } else {
        this.logger.warn(`Holiday not found: ${dateString}`);
      }

      return removed;
    } catch (error) {
      this.logger.error(`Failed to remove holiday: ${date.toISOString()}`, error);
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
   * Check if a specific date is a holiday
   */
  public isHoliday(date: Date): boolean {
    try {
      const dateString = date.toISOString().split('T')[0];
      return this.holidays.some(
        (holiday) => holiday.date.toISOString().split('T')[0] === dateString && holiday.isObserved
      );
    } catch (error) {
      this.logger.error(`Failed to check if date is holiday: ${date.toISOString()}`, error);
      throw error;
    }
  }

  /**
   * Check if a specific date is a weekend
   */
  public isWeekend(date: Date): boolean {
    try {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      return dayOfWeek === 0 || dayOfWeek === 6;
    } catch (error) {
      this.logger.error(`Failed to check if date is weekend: ${date.toISOString()}`, error);
      throw error;
    }
  }

  /**
   * Check if a specific date is a business day
   */
  public isBusinessDay(date: Date): boolean {
    try {
      // Check if it's a weekend
      if (this.isWeekend(date)) {
        return false;
      }

      // Check if it's a holiday
      if (this.isHoliday(date)) {
        return false;
      }

      // Check if there are working hours for this day
      const dayOfWeek = date.getDay();
      const workingHours = this.getWorkingHoursForDay(dayOfWeek);

      return workingHours !== null;
    } catch (error) {
      this.logger.error(`Failed to check if date is business day: ${date.toISOString()}`, error);
      throw error;
    }
  }

  /**
   * Get working hours for a specific day of the week
   */
  private getWorkingHoursForDay(dayOfWeek: number): WorkingHours | null {
    try {
      switch (dayOfWeek) {
        case 0:
          return this.workWeek.sunday || null; // Sunday
        case 1:
          return this.workWeek.monday || null; // Monday
        case 2:
          return this.workWeek.tuesday || null; // Tuesday
        case 3:
          return this.workWeek.wednesday || null; // Wednesday
        case 4:
          return this.workWeek.thursday || null; // Thursday
        case 5:
          return this.workWeek.friday || null; // Friday
        case 6:
          return this.workWeek.saturday || null; // Saturday
        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Failed to get working hours for day: ${dayOfWeek}`, error);
      throw error;
    }
  }

  /**
   * Count business days between two dates (inclusive)
   */
  public countBusinessDays(startDate: Date, endDate: Date): number {
    try {
      this.logger.info(
        `Counting business days between ${startDate.toISOString()} and ${endDate.toISOString()}`
      );

      // Ensure start date is before end date
      if (startDate > endDate) {
        this.logger.warn('Start date is after end date, swapping dates');
        [startDate, endDate] = [endDate, startDate];
      }

      let businessDays = 0;
      const currentDate = new Date(startDate);

      // Iterate through each day
      while (currentDate <= endDate) {
        if (this.isBusinessDay(currentDate)) {
          businessDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.logger.info(`Counted ${businessDays} business days`);
      return businessDays;
    } catch (error) {
      this.logger.error('Failed to count business days', error);
      throw error;
    }
  }

  /**
   * Add business days to a date
   */
  public addBusinessDays(date: Date, businessDays: number): Date {
    try {
      this.logger.info(`Adding ${businessDays} business days to ${date.toISOString()}`);

      if (businessDays === 0) {
        return new Date(date);
      }

      const result = new Date(date);
      const direction = businessDays > 0 ? 1 : -1;
      let daysRemaining = Math.abs(businessDays);

      // Add business days one by one
      while (daysRemaining > 0) {
        result.setDate(result.getDate() + direction);

        // Check if it's a business day
        if (this.isBusinessDay(result)) {
          daysRemaining--;
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
   * Subtract business days from a date
   */
  public subtractBusinessDays(date: Date, businessDays: number): Date {
    return this.addBusinessDays(date, -businessDays);
  }

  /**
   * Get the next business day after a given date
   */
  public getNextBusinessDay(date: Date): Date {
    try {
      this.logger.info(`Getting next business day after ${date.toISOString()}`);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      // Keep incrementing until we find a business day
      while (!this.isBusinessDay(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1);
      }

      this.logger.info(`Next business day: ${nextDay.toISOString()}`);
      return nextDay;
    } catch (error) {
      this.logger.error('Failed to get next business day', error);
      throw error;
    }
  }

  /**
   * Get the previous business day before a given date
   */
  public getPreviousBusinessDay(date: Date): Date {
    try {
      this.logger.info(`Getting previous business day before ${date.toISOString()}`);

      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);

      // Keep decrementing until we find a business day
      while (!this.isBusinessDay(previousDay)) {
        previousDay.setDate(previousDay.getDate() - 1);
      }

      this.logger.info(`Previous business day: ${previousDay.toISOString()}`);
      return previousDay;
    } catch (error) {
      this.logger.error('Failed to get previous business day', error);
      throw error;
    }
  }

  /**
   * Count working hours between two dates
   */
  public countWorkingHours(startDate: Date, endDate: Date): number {
    try {
      this.logger.info(
        `Counting working hours between ${startDate.toISOString()} and ${endDate.toISOString()}`
      );

      // Ensure start date is before end date
      if (startDate > endDate) {
        this.logger.warn('Start date is after end date, swapping dates');
        [startDate, endDate] = [endDate, startDate];
      }

      let totalHours = 0;
      const currentDate = new Date(startDate);

      // Iterate through each day
      while (currentDate <= endDate) {
        if (this.isBusinessDay(currentDate)) {
          const dayOfWeek = currentDate.getDay();
          const workingHours = this.getWorkingHoursForDay(dayOfWeek);

          if (workingHours) {
            // Parse start and end times
            const [startHour, startMinute] = workingHours.start.split(':').map(Number);
            const [endHour, endMinute] = workingHours.end.split(':').map(Number);

            // Calculate working hours for this day
            const dayStart = new Date(currentDate);
            dayStart.setHours(startHour, startMinute, 0, 0);

            const dayEnd = new Date(currentDate);
            dayEnd.setHours(endHour, endMinute, 0, 0);

            // Adjust for the actual start and end times if they fall within this day
            const actualStart = currentDate < dayStart ? dayStart : currentDate;
            const actualEnd = endDate < dayEnd ? endDate : dayEnd;

            // Only count if there's overlap
            if (actualStart < actualEnd) {
              const hours = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
              totalHours += hours;
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.logger.info(`Counted ${totalHours.toFixed(2)} working hours`);
      return totalHours;
    } catch (error) {
      this.logger.error('Failed to count working hours', error);
      throw error;
    }
  }

  /**
   * Get business days in a specific month
   */
  public getBusinessDaysInMonth(year: number, month: number): Date[] {
    try {
      this.logger.info(`Getting business days in ${year}-${month}`);

      const businessDays: Date[] = [];
      const startDate = new Date(year, month - 1, 1); // Months are 0-indexed in JS Date
      const endDate = new Date(year, month, 0); // Last day of the month

      const currentDate = new Date(startDate);

      // Iterate through each day of the month
      while (currentDate <= endDate) {
        if (this.isBusinessDay(currentDate)) {
          businessDays.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.logger.info(`Found ${businessDays.length} business days in ${year}-${month}`);
      return businessDays;
    } catch (error) {
      this.logger.error(`Failed to get business days in ${year}-${month}`, error);
      throw error;
    }
  }

  /**
   * Get business days in a specific year
   */
  public getBusinessDaysInYear(year: number): Date[] {
    try {
      this.logger.info(`Getting business days in year ${year}`);

      const businessDays: Date[] = [];

      // Iterate through each month
      for (let month = 1; month <= 12; month++) {
        const monthBusinessDays = this.getBusinessDaysInMonth(year, month);
        businessDays.push(...monthBusinessDays);
      }

      this.logger.info(`Found ${businessDays.length} business days in year ${year}`);
      return businessDays;
    } catch (error) {
      this.logger.error(`Failed to get business days in year ${year}`, error);
      throw error;
    }
  }

  /**
   * Get business day statistics for a period
   */
  public getBusinessDayStats(
    startDate: Date,
    endDate: Date
  ): {
    totalDays: number;
    businessDays: number;
    weekendDays: number;
    holidayDays: number;
    workingHours: number;
    businessDayPercentage: number;
  } {
    try {
      this.logger.info(
        `Getting business day stats for period ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Ensure start date is before end date
      if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate];
      }

      let totalDays = 0;
      let businessDays = 0;
      let weekendDays = 0;
      let holidayDays = 0;

      const currentDate = new Date(startDate);

      // Iterate through each day
      while (currentDate <= endDate) {
        totalDays++;

        if (this.isHoliday(currentDate)) {
          holidayDays++;
        } else if (this.isWeekend(currentDate)) {
          weekendDays++;
        } else {
          businessDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate working hours
      const workingHours = this.countWorkingHours(startDate, endDate);

      const stats = {
        totalDays,
        businessDays,
        weekendDays,
        holidayDays,
        workingHours,
        businessDayPercentage: totalDays > 0 ? (businessDays / totalDays) * 100 : 0,
      };

      this.logger.info(`Business day stats calculated: ${JSON.stringify(stats)}`);
      return stats;
    } catch (error) {
      this.logger.error('Failed to get business day stats', error);
      throw error;
    }
  }

  /**
   * Find the nth business day from a given date
   */
  public getNthBusinessDay(date: Date, n: number): Date {
    try {
      this.logger.info(`Getting ${n}th business day from ${date.toISOString()}`);

      if (n === 0) {
        // Return the same date if it's a business day, otherwise next business day
        return this.isBusinessDay(date) ? new Date(date) : this.getNextBusinessDay(date);
      }

      let result = new Date(date);

      if (n > 0) {
        // Find nth business day after the date
        for (let i = 0; i < n; i++) {
          result = this.getNextBusinessDay(result);
        }
      } else {
        // Find nth business day before the date
        for (let i = 0; i < Math.abs(n); i++) {
          result = this.getPreviousBusinessDay(result);
        }
      }

      this.logger.info(`Found ${n}th business day: ${result.toISOString()}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get ${n}th business day from ${date.toISOString()}`, error);
      throw error;
    }
  }

  /**
   * Check if a date range has any business days
   */
  public hasBusinessDays(startDate: Date, endDate: Date): boolean {
    try {
      this.logger.info(
        `Checking if range ${startDate.toISOString()} to ${endDate.toISOString()} has business days`
      );

      // Ensure start date is before end date
      if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate];
      }

      const currentDate = new Date(startDate);

      // Check each day in the range
      while (currentDate <= endDate) {
        if (this.isBusinessDay(currentDate)) {
          this.logger.info('Range contains business days');
          return true;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      this.logger.info('Range does not contain business days');
      return false;
    } catch (error) {
      this.logger.error('Failed to check if range has business days', error);
      throw error;
    }
  }

  /**
   * Get the first and last business days in a range
   */
  public getBoundaryBusinessDays(
    startDate: Date,
    endDate: Date
  ): {
    firstBusinessDay: Date | null;
    lastBusinessDay: Date | null;
  } {
    try {
      this.logger.info(
        `Getting boundary business days for range ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Ensure start date is before end date
      if (startDate > endDate) {
        [startDate, endDate] = [endDate, startDate];
      }

      let firstBusinessDay: Date | null = null;
      let lastBusinessDay: Date | null = null;

      const currentDate = new Date(startDate);

      // Find first business day
      while (currentDate <= endDate && firstBusinessDay === null) {
        if (this.isBusinessDay(currentDate)) {
          firstBusinessDay = new Date(currentDate);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Reset current date to end date and find last business day
      const reverseDate = new Date(endDate);
      while (reverseDate >= startDate && lastBusinessDay === null) {
        if (this.isBusinessDay(reverseDate)) {
          lastBusinessDay = new Date(reverseDate);
        }
        reverseDate.setDate(reverseDate.getDate() - 1);
      }

      const boundaries = { firstBusinessDay, lastBusinessDay };
      this.logger.info(`Boundary business days: ${JSON.stringify(boundaries)}`);
      return boundaries;
    } catch (error) {
      this.logger.error('Failed to get boundary business days', error);
      throw error;
    }
  }
}
