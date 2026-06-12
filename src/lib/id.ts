/** Small monotonic-ish id generator. Fine for client-only demo data. */
let counter = 0;

export function uid(prefix = 'id'): string {
  counter += 1;
  const t = Date.now().toString(36);
  return `${prefix}-${t}-${counter.toString(36)}`;
}
