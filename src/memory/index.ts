import os from "os";
import path from "path";

const MEMORY_DIR_NAME = ".context-capturing-agents";

export function getMemoryBasePath(): string {
  return path.join(os.homedir(), MEMORY_DIR_NAME);
}

export * from "./read.js";
export * from "./write.js";
export * from "./update.js";
export * from "./delete.js";
