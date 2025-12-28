/**
 * Logger utility for debugging context-capturing-agents
 *
 * Log levels: DEBUG < INFO < WARN < ERROR
 * Set LOG_LEVEL environment variable to control verbosity
 *
 * Note: MCP servers communicate over stdio, so we use stderr for logging
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : "INFO";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getLogLevel()];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level}] [${module}]`;

  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export interface Logger {
  debug: (message: string, data?: Record<string, unknown>) => void;
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  child: (subModule: string) => Logger;
}

export function createLogger(module: string): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog("DEBUG")) {
        console.error(formatMessage("DEBUG", module, message, data));
      }
    },

    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog("INFO")) {
        console.error(formatMessage("INFO", module, message, data));
      }
    },

    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog("WARN")) {
        console.error(formatMessage("WARN", module, message, data));
      }
    },

    error(message: string, data?: Record<string, unknown>) {
      if (shouldLog("ERROR")) {
        console.error(formatMessage("ERROR", module, message, data));
      }
    },

    child(subModule: string): Logger {
      return createLogger(`${module}:${subModule}`);
    },
  };
}

// Pre-configured loggers for each module
export const serverLogger = createLogger("mcp-server");
export const initProjectLogger = createLogger("init-project");
export const explorerAgentLogger = createLogger("agent:explorer");
export const writerAgentLogger = createLogger("agent:writer");
export const explorerToolsLogger = createLogger("tools:explorer");
export const writerToolsLogger = createLogger("tools:writer");
export const filesystemLogger = createLogger("utils:filesystem");
export const memoryLogger = createLogger("memory");
