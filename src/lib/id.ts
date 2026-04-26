// Short, URL-safe IDs. crypto.randomUUID is available in Workers.
export function newId(): string {
  return crypto.randomUUID();
}
