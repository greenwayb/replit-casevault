import { storage } from "./storage.js";

/**
 * Service for standardizing name formatting by removing titles and ensuring title case
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
 * Formats first and last names separately
 */
export function formatUserNames(firstName: string, lastName: string): { firstName: string; lastName: string } {
  return {
    firstName: formatName(firstName),
    lastName: formatName(lastName)
  };
}

/**
 * Gets display name for a user (formatted first name + last name)
 */
export function getDisplayName(firstName?: string, lastName?: string): string {
  const formatted = formatUserNames(firstName || '', lastName || '');
  return `${formatted.firstName} ${formatted.lastName}`.trim();
}

/**
 * Updates all existing user names in the database to use proper formatting
 */
export async function standardizeAllUserNames(): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;
  
  try {
    // Get all users
    const users = await storage.getAllUsers();
    
    for (const user of users) {
      try {
        const originalFirstName = user.firstName || '';
        const originalLastName = user.lastName || '';
        
        const { firstName, lastName } = formatUserNames(originalFirstName, originalLastName);
        
        // Only update if names actually changed
        if (firstName !== originalFirstName || lastName !== originalLastName) {
          await storage.updateUser(user.id, { firstName, lastName });
          updated++;
          console.log(`Updated user ${user.id}: "${originalFirstName} ${originalLastName}" -> "${firstName} ${lastName}"`);
        }
      } catch (error) {
        const errorMsg = `Failed to update user ${user.id}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    
    console.log(`Name standardization complete: ${updated} users updated, ${errors.length} errors`);
    return { updated, errors };
    
  } catch (error) {
    const errorMsg = `Failed to standardize user names: ${error}`;
    errors.push(errorMsg);
    console.error(errorMsg);
    return { updated, errors };
  }
}