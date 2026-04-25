/**
 * Sanitizes a string value to be safe for use as a CSS variable value.
 * Prevents CSS injection and escaping the <style> tag by removing
 * characters that can be used to break out of the context.
 */
export function sanitizeCssValue(value: any): string {
  if (typeof value !== "string") {
    return "";
  }

  // Remove characters that could break out of a CSS rule or a <style> tag:
  // - ; (ends a declaration)
  // - { (starts a rule block)
  // - } (ends a rule block)
  // - \ (CSS escape character)
  // - < (starts a tag, e.g., </style>)
  // - > (ends a tag)
  return value.replace(/[;{}\\\<>]/g, "");
}
