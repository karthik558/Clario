/** SQLite timestamps are UTC, including legacy values without a zone suffix. */
export function workspaceDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
}
