import path from 'node:path';

const DEFAULT_LOG_FILE_NAME = 'events.log';

export function resolveLogFilePath(): string {
  const configuredPath = process.env.EVENTS_LOG_PATH;

  if (configuredPath && configuredPath.trim().length > 0) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), DEFAULT_LOG_FILE_NAME);
}