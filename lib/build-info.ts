/**
 * Teader Build Number Configuration
 * Format: B<A|P>-<DDMMYYYY>-<HHMM>
 * Prefix: BA for AM, BP for PM
 * Updated before pushing code to GitHub
 */
export const BUILD_NUMBER = 'BP-28082026-0757';

export function getBuildNumber(): string {
  return BUILD_NUMBER;
}
