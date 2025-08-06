/**
 * Client-side name formatting utilities
 */

// Common titles to strip from names
const TITLES_TO_STRIP = [
  'mr', 'mrs', 'ms', 'miss', 'dr', 'professor', 'prof', 'sir', 'madam', 'ma\'am',
  'rev', 'reverend', 'father', 'mother', 'sister', 'brother', 'captain', 'colonel',
  'major', 'general', 'admiral', 'sergeant', 'lieutenant', 'judge', 'justice',
  'honorable', 'hon', 'esq', 'esquire', 'phd', 'md', 'jr', 'sr', 'ii', 'iii', 'iv'
];

/**
 * Converts text to title case (capitalizes first letter of each word)
 */
function toTitleCase(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .trim();
}

/**
 * Strips common titles from the beginning of a name
 */
function stripTitles(name: string): string {
  if (!name) return '';
  
  const words = name.trim().split(/\s+/);
  const cleanWords: string[] = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[.,]/g, '').toLowerCase();
    if (!TITLES_TO_STRIP.includes(cleanWord)) {
      cleanWords.push(word);
    }
  }
  
  return cleanWords.join(' ').trim();
}

/**
 * Formats a name by stripping titles and applying title case
 */
export function formatName(name: string): string {
  if (!name) return '';
  
  // First strip titles, then apply title case
  const withoutTitles = stripTitles(name);
  return toTitleCase(withoutTitles);
}

/**
 * Gets a formatted display name from first and last name
 */
export function getDisplayName(firstName?: string, lastName?: string): string {
  const formattedFirst = formatName(firstName || '');
  const formattedLast = formatName(lastName || '');
  return `${formattedFirst} ${formattedLast}`.trim();
}

/**
 * Gets formatted initials from first and last name
 */
export function getInitials(firstName?: string, lastName?: string): string {
  const formattedFirst = formatName(firstName || '');
  const formattedLast = formatName(lastName || '');
  
  const firstInitial = formattedFirst.charAt(0).toUpperCase();
  const lastInitial = formattedLast.charAt(0).toUpperCase();
  
  return `${firstInitial}${lastInitial}`.trim();
}