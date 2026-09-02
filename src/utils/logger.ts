const SENSITIVE_KEY = /authorization|token|password|secret|cookie|email|phone|invoic|client.?code/i;

const sanitize = (value: unknown, depth = 0): unknown => {
  if (depth > 3) return '[truncated]';
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : sanitize(item, depth + 1),
      ]),
    );
  }
  return value;
};

const write = (level: 'log' | 'warn' | 'error', message: string, context?: unknown) => {
  if (!__DEV__) return;
  const args: [string] | [string, unknown] = context === undefined
    ? [message]
    : [message, sanitize(context)];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.log(...args);
};

export const logger = {
  debug: (message: string, context?: unknown) => write('log', message, context),
  warn: (message: string, context?: unknown) => write('warn', message, context),
  error: (message: string, context?: unknown) => write('error', message, context),
};
