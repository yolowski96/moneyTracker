// Thin console-logger shared by route handlers, server actions, and cached
// queries. Keeps log lines greppable: `[scope status] code: message {json}`.
//
// 2xx   -> console.log
// 4xx   -> console.warn
// 5xx   -> console.error
// no status (e.g. query timing) -> console.log

export type LogDetail = Record<string, unknown>;

function stringify(detail?: LogDetail): string {
  if (!detail) return "";
  try {
    return JSON.stringify(detail);
  } catch {
    return "<unserializable>";
  }
}

export function log(
  scope: string,
  status: number | null,
  code: string,
  message: string,
  detail?: LogDetail,
): void {
  const head = status === null ? `[${scope}]` : `[${scope} ${status}]`;
  const line = `${head} ${code}: ${message}`;
  const tail = stringify(detail);

  if (status !== null && status >= 500) console.error(line, tail);
  else if (status !== null && status >= 400) console.warn(line, tail);
  else console.log(line, tail);
}

// Times an async function and logs its outcome. Re-throws so callers see
// the original error.
export async function timed<T>(
  scope: string,
  code: string,
  fn: () => Promise<T>,
  detailFor?: (result: T, ms: number) => LogDetail,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - started;
    const detail = detailFor?.(result, ms) ?? { ms };
    log(scope, 200, code, "ok", detail);
    return result;
  } catch (err) {
    const ms = Date.now() - started;
    log(scope, 500, `${code}_error`, (err as Error).message, { ms });
    throw err;
  }
}
