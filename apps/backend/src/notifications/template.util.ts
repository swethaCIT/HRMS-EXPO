/**
 * Substitutes `{{key}}` placeholders with `vars[key]`. Unknown placeholders
 * are left as-is rather than blanked, so a typo in a template (or a var the
 * caller forgot to pass) is visible in the rendered output instead of
 * silently disappearing.
 */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
