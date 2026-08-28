/**
 * Teader Build Number Configuration
 * Format: B<A|P><DD><MM><YYYY><HH><MM>
 * Prefix: BA for AM, BP for PM
 * Updated before pushing code to GitHub
 */
export const BUILD_NUMBER = 'BP280820260700';

export function getBuildNumber(): string {
  return BUILD_NUMBER;
}
