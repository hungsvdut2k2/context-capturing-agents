import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { filesystemLogger as logger } from "./logger.js";

export interface FileInfo {
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
}

export interface DirectoryStructure {
  name: string;
  type: "file" | "directory";
  children?: DirectoryStructure[];
}

const IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "*.log",
  ".DS_Store",
  "coverage",
  ".nyc_output",
];

export async function getDirectoryStructure(
  dirPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<DirectoryStructure[]> {
  if (currentDepth >= maxDepth) {
    logger.debug("Max depth reached", { dirPath, maxDepth, currentDepth });
    return [];
  }

  logger.debug("Reading directory structure", { dirPath, currentDepth, maxDepth });
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const structure: DirectoryStructure[] = [];

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) {
      continue;
    }

    const item: DirectoryStructure = {
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    };

    if (entry.isDirectory()) {
      const childPath = path.join(dirPath, entry.name);
      item.children = await getDirectoryStructure(
        childPath,
        maxDepth,
        currentDepth + 1
      );
    }

    structure.push(item);
  }

  logger.debug("Directory structure built", { dirPath, itemCount: structure.length });
  return structure;
}

export function shouldIgnore(name: string): boolean {
  return IGNORE_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace("*", ".*"));
      return regex.test(name);
    }
    return name === pattern;
  });
}

export async function findKeyFiles(projectPath: string): Promise<string[]> {
  logger.debug("Finding key files", { projectPath });
  const keyPatterns = [
    "README.md",
    "README.rst",
    "readme.md",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "build.gradle",
    "tsconfig.json",
    "webpack.config.js",
    "vite.config.ts",
    "docker-compose.yml",
    "Dockerfile",
    ".env.example",
    "Makefile",
  ];

  const foundFiles: string[] = [];

  for (const pattern of keyPatterns) {
    const matches = await glob(pattern, {
      cwd: projectPath,
      ignore: IGNORE_PATTERNS,
    });
    foundFiles.push(...matches.map((m) => path.join(projectPath, m)));
  }

  logger.debug("Key files found", { count: foundFiles.length, files: foundFiles });
  return foundFiles;
}

export async function findSourceFiles(
  projectPath: string,
  limit: number = 20
): Promise<string[]> {
  logger.debug("Finding source files", { projectPath, limit });
  const sourcePatterns = [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.js",
    "src/**/*.jsx",
    "src/**/*.py",
    "src/**/*.go",
    "src/**/*.rs",
    "lib/**/*.ts",
    "lib/**/*.js",
    "app/**/*.ts",
    "app/**/*.tsx",
    "pages/**/*.tsx",
    "components/**/*.tsx",
  ];

  const files: string[] = [];

  for (const pattern of sourcePatterns) {
    if (files.length >= limit) break;
    const matches = await glob(pattern, {
      cwd: projectPath,
      ignore: IGNORE_PATTERNS,
    });
    files.push(
      ...matches.slice(0, limit - files.length).map((m) => path.join(projectPath, m))
    );
  }

  logger.debug("Source files found", { count: files.length });
  return files;
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    logger.debug("File content read", { filePath, contentLength: content.length });
    return content;
  } catch (error) {
    logger.warn("Failed to read file content", { filePath, error: String(error) });
    return "";
  }
}

export function structureToString(
  structure: DirectoryStructure[],
  indent: string = ""
): string {
  let result = "";
  for (const item of structure) {
    const icon = item.type === "directory" ? "📁" : "📄";
    result += `${indent}${icon} ${item.name}\n`;
    if (item.children) {
      result += structureToString(item.children, indent + "  ");
    }
  }
  return result;
}
