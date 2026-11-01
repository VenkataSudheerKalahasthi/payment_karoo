export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...(meta ? { meta } : {}),
      }),
    );
  },
  warn: (message: string, errorOrMeta?: unknown) => {
    const details =
      errorOrMeta instanceof Error
        ? { message: errorOrMeta.message, stack: errorOrMeta.stack }
        : typeof errorOrMeta === 'object' && errorOrMeta !== null
          ? errorOrMeta
          : errorOrMeta !== undefined
            ? { detail: String(errorOrMeta) }
            : undefined;

    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...(details ? { details } : {}),
      }),
    );
  },
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const errorDetails =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : typeof error === 'object' && error !== null
          ? error
          : error !== undefined
            ? { detail: String(error) }
            : undefined;

    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        error: errorDetails,
        ...(meta ? { meta } : {}),
      }),
    );
  },
};
