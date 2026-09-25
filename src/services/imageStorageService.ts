/**
 * Web Image URL Utilities
 * Handles validation and formatting of web image URLs for Google Sheets and UI cards.
 */

/**
 * Validates and formats a web image URL for Google Sheets and tracker display.
 */
export function ensurePublicImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return undefined;
}
