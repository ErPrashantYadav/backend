/**
 * Normalizes phone numbers for consistent customer identity matching.
 * Cleans leading/trailing whitespace, strips delimiters (spaces, dashes, dots, parentheses),
 * and handles Nepal / E.164 formats safely.
 *
 * Examples:
 * - "+977-9841234567" -> "+9779841234567"
 * - "9841234567"      -> "+9779841234567"
 * - "984-123-4567"    -> "+9779841234567"
 * - "(977) 9841234567"-> "+9779841234567"
 * - "00977 9841234567"-> "+9779841234567"
 * - "+1 555-123-4567" -> "+15551234567"
 */
export function normalizeCustomerPhone(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const stripped = trimmed.replace(/[\s\-.()]/g, '');

  let formatted = stripped;
  if (formatted.startsWith('00')) {
    formatted = `+${formatted.slice(2)}`;
  }

  // Nepal mobile numbers (10 digits starting with 96, 97, or 98)
  if (/^[9][678]\d{8}$/.test(formatted)) {
    return `+977${formatted}`;
  }

  // Nepal numbers with 977 country code but without '+'
  if (/^977[9][678]\d{8}$/.test(formatted)) {
    return `+${formatted}`;
  }

  return formatted;
}
