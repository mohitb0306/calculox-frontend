/**
 * Formats a UTC date string according to the site's global configuration.
 * Handles SQL timestamp strings by normalizing them to ISO UTC.
 */
export const formatDateTime = (dateString: string | undefined | null, settings: any = {}) => {
  if (!dateString) return '';

  // 1. Normalize Input to UTC ISO Format
  // SQL often returns "2025-01-01 12:00:00". We replace space with T and append Z to force UTC.
  const utcString = (dateString.endsWith('Z') || dateString.includes('+')) 
      ? dateString 
      : dateString.replace(' ', 'T') + 'Z';

  let date;
  try {
      date = new Date(utcString);
      if (isNaN(date.getTime())) return '';
  } catch (e) {
      return '';
  }

  // 2. Get Configuration with Defaults
  const timeZone = settings.site_timezone || 'UTC';
  const dateFormatStr = settings.date_format || 'F j, Y';

  // 3. Map PHP Date Formats to Intl Locale/Options
  let dateLocale = 'en-US';
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone };

  switch (dateFormatStr) {
      case 'Y-m-d': // 2025-01-05
          dateLocale = 'en-CA'; 
          dateOptions.year = 'numeric'; dateOptions.month = '2-digit'; dateOptions.day = '2-digit';
          break;
      case 'm/d/Y': // 01/05/2025
          dateLocale = 'en-US';
          dateOptions.year = 'numeric'; dateOptions.month = '2-digit'; dateOptions.day = '2-digit';
          break;
      case 'd/m/Y': // 05/01/2025
          dateLocale = 'en-GB';
          dateOptions.year = 'numeric'; dateOptions.month = '2-digit'; dateOptions.day = '2-digit';
          break;
      default: // F j, Y (January 5, 2025)
          dateLocale = 'en-US';
          dateOptions.year = 'numeric'; dateOptions.month = 'long'; dateOptions.day = 'numeric';
  }

  try {
      return new Intl.DateTimeFormat(dateLocale, dateOptions).format(date);
  } catch (error) {
      console.error("Date formatting error (Invalid Timezone?):", timeZone, error);
      // Fallback to simple local string if timezone is invalid
      return date.toLocaleDateString();
  }
};