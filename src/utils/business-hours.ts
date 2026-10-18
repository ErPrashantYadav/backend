import { AppError } from '../errors/app-error';
import type {
  DayOfWeek,
  DaySchedule,
} from '../modules/store-settings/store-settings.types';

export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAYS_OF_WEEK_ORDER: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

export function validateBusinessHours(hours: DaySchedule[]): DaySchedule[] {
  if (!Array.isArray(hours)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'businessHours must be an array of day schedules',
    );
  }

  const validDays = new Set<DayOfWeek>(DAYS_OF_WEEK_ORDER);
  const validated: DaySchedule[] = [];

  for (const item of hours) {
    if (!validDays.has(item.day)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Invalid day of week: ${item.day}`,
      );
    }

    const isOpen = Boolean(item.isOpen);
    let openTime: string | null = null;
    let closeTime: string | null = null;

    if (isOpen) {
      if (!item.openTime || !TIME_REGEX.test(item.openTime.trim())) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `openTime for ${item.day} must be in 24-hour HH:mm format (e.g. 09:00)`,
        );
      }
      if (!item.closeTime || !TIME_REGEX.test(item.closeTime.trim())) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `closeTime for ${item.day} must be in 24-hour HH:mm format (e.g. 22:00)`,
        );
      }

      const openMinutes = parseTimeToMinutes(item.openTime);
      const closeMinutes = parseTimeToMinutes(item.closeTime);

      if (openMinutes === closeMinutes) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          `openTime and closeTime for ${item.day} cannot be identical (${item.openTime}). Set isOpen: false to close the store.`,
        );
      }

      openTime = item.openTime.trim();
      closeTime = item.closeTime.trim();
    } else {
      openTime = item.openTime?.trim() || null;
      closeTime = item.closeTime?.trim() || null;
    }

    validated.push({
      day: item.day,
      isOpen,
      openTime,
      closeTime,
    });
  }

  return validated;
}

export function getPreviousDay(day: DayOfWeek): DayOfWeek {
  const index = DAYS_OF_WEEK_ORDER.indexOf(day);
  const prevIndex =
    (index - 1 + DAYS_OF_WEEK_ORDER.length) % DAYS_OF_WEEK_ORDER.length;
  return DAYS_OF_WEEK_ORDER[prevIndex]!;
}

interface LocalTimeInfo {
  day: DayOfWeek;
  minutes: number;
}

export function getLocalTimeInfo(date: Date, timezone: string): LocalTimeInfo {
  // Use Intl.DateTimeFormat to reliably extract local weekday and time in the store's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let weekdayStr = '';
  let hourStr = '0';
  let minuteStr = '0';

  for (const part of parts) {
    if (part.type === 'weekday') weekdayStr = part.value.toUpperCase();
    if (part.type === 'hour') hourStr = part.value;
    if (part.type === 'minute') minuteStr = part.value;
  }

  const day = (weekdayStr as DayOfWeek) || 'SUNDAY';
  const hours = parseInt(hourStr, 10) % 24;
  const minutes = parseInt(minuteStr, 10);
  const totalMinutes = hours * 60 + minutes;

  return {
    day,
    minutes: totalMinutes,
  };
}

/**
 * Checks whether the store is open at a given Date in the configured timezone.
 * Supports:
 * - Daytime windows (e.g. 10:00 to 22:00)
 * - Overnight windows (e.g. 22:00 to 02:00) where openTime > closeTime
 * - Overnight spillover from previous day after midnight
 * - Opening time is inclusive (>= openTime)
 * - Closing time is exclusive (< closeTime)
 */
export function isStoreOpenAt(
  businessHours: DaySchedule[],
  timezone: string,
  targetDate: Date = new Date(),
): boolean {
  if (!businessHours || businessHours.length === 0) {
    return false;
  }

  const scheduleMap = new Map<DayOfWeek, DaySchedule>();
  for (const s of businessHours) {
    scheduleMap.set(s.day, s);
  }

  const { day: todayDay, minutes: currentMinutes } = getLocalTimeInfo(
    targetDate,
    timezone,
  );

  // 1. Check if previous day had an overnight window spilling over past midnight into today
  const prevDay = getPreviousDay(todayDay);
  const yesterdaySchedule = scheduleMap.get(prevDay);

  if (
    yesterdaySchedule &&
    yesterdaySchedule.isOpen &&
    yesterdaySchedule.openTime &&
    yesterdaySchedule.closeTime
  ) {
    const yesterdayOpenMinutes = parseTimeToMinutes(yesterdaySchedule.openTime);
    const yesterdayCloseMinutes = parseTimeToMinutes(
      yesterdaySchedule.closeTime,
    );

    // Overnight window check: openTime > closeTime
    if (yesterdayOpenMinutes > yesterdayCloseMinutes) {
      // If current time is strictly before yesterday's close time (exclusive closing boundary)
      if (currentMinutes < yesterdayCloseMinutes) {
        return true;
      }
    }
  }

  // 2. Check today's schedule
  const todaySchedule = scheduleMap.get(todayDay);
  if (
    !todaySchedule ||
    !todaySchedule.isOpen ||
    !todaySchedule.openTime ||
    !todaySchedule.closeTime
  ) {
    return false;
  }

  const todayOpenMinutes = parseTimeToMinutes(todaySchedule.openTime);
  const todayCloseMinutes = parseTimeToMinutes(todaySchedule.closeTime);

  // Normal daytime window: open < close
  if (todayOpenMinutes < todayCloseMinutes) {
    if (todayOpenMinutes === 0 && todayCloseMinutes >= 1439) {
      return true;
    }
    return (
      currentMinutes >= todayOpenMinutes && currentMinutes < todayCloseMinutes
    );
  }

  // Overnight window starting today: open > close
  if (todayOpenMinutes > todayCloseMinutes) {
    // Before midnight: must be >= openTime
    return currentMinutes >= todayOpenMinutes;
  }

  return false;
}
