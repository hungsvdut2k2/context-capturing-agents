import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import {
  getDirectoryStructure,
  structureToString,
  readFileContent,
  shouldIgnore,
} from "../utils/filesystem.js";
import { type AgentStateType } from "../state/index.js";
import { explorerToolsLogger as logger } from "../utils/logger.js";

export const EXPLORATION_FILE = "EXPLORATION.md";

const GLOB_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/.idea/**",
  "**/.vscode/**",
  "**/coverage/**",
  "**/.nyc_output/**",
];

export function createExplorerTools(state: AgentStateType) {
  const { projectPath, memoryPath, explorationPath } = state;
  logger.debug("Creating explorer tools", { projectPath, memoryPath });

  const readFileTool = tool(
    async ({ filePath }) => {
      logger.debug("read_file called", { filePath });
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(projectPath, filePath);

      if (!fullPath.startsWith(projectPath)) {
        logger.warn("Attempted to read file outside project", { filePath, fullPath });
        return "Error: Cannot read files outside project directory";
      }

      const content = await readFileContent(fullPath);
      if (!content) {
        logger.warn("Could not read file", { filePath });
        return `Error: Could not read file ${filePath}`;
      }

      logger.debug("File read successfully", { filePath, contentLength: content.length });
      if (content.length > 10000) {
        return content.slice(0, 10000) + "\n\n... [truncated]";
      }
      return content;
    },
    {
      name: "read_file",
      description:
        "Read the contents of a file in the project. Use relative paths from project root.",
      schema: z.object({
        filePath: z.string().describe("Path to the file to read"),
      }),
    }
  );

  const listDirectoryTool = tool(
    async ({ dirPath, recursive, maxDepth }) => {
      logger.debug("list_directory called", { dirPath, recursive, maxDepth });
      const fullPath = path.isAbsolute(dirPath)
        ? dirPath
        : path.join(projectPath, dirPath);

      if (!fullPath.startsWith(projectPath)) {
        logger.warn("Attempted to list directory outside project", { dirPath, fullPath });
        return "Error: Cannot list directories outside project directory";
      }

      try {
        if (recursive) {
          const structure = await getDirectoryStructure(
            fullPath,
            maxDepth || 3
          );
          logger.debug("Directory structure retrieved", { dirPath, itemCount: structure.length });
          return structureToString(structure);
        } else {
          const entries = await fs.readdir(fullPath, { withFileTypes: true });
          const filtered = entries.filter((e) => !shouldIgnore(e.name));
          logger.debug("Directory listed", { dirPath, entryCount: filtered.length });
          return filtered
            .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`))
            .join("\n");
        }
      } catch (error) {
        logger.error("Error listing directory", { dirPath, error: String(error) });
        return `Error listing directory: ${error}`;
      }
    },
    {
      name: "list_directory",
      description:
        "List files and directories. Use recursive=true to see nested structure.",
      schema: z.object({
        dirPath: z
          .string()
          .default(".")
          .describe("Directory path to list (default: project root)"),
        recursive: z
          .boolean()
          .default(false)
          .describe("Whether to list recursively"),
        maxDepth: z
          .number()
          .optional()
          .describe("Max depth for recursive listing (default: 3)"),
      }),
    }
  );

  const searchFilesTool = tool(
    async ({ pattern, filePattern }) => {
      logger.debug("search_files called", { pattern, filePattern });
      try {
        const files = await glob(filePattern || "**/*", {
          cwd: projectPath,
          ignore: GLOB_IGNORE_PATTERNS,
          nodir: true,
        });
        logger.debug("Files to search", { fileCount: files.length });

        const results: string[] = [];
        const regex = new RegExp(pattern, "gi");

        for (const file of files.slice(0, 50)) {
          try {
            const content = await readFileContent(path.join(projectPath, file));
            if (!content) continue;

            const lines = content.split("\n");
            const matches: string[] = [];

            lines.forEach((line, index) => {
              if (regex.test(line)) {
                matches.push(`  ${index + 1}: ${line.trim()}`);
              }
              regex.lastIndex = 0;
            });

            if (matches.length > 0) {
              results.push(`${file}:\n${matches.slice(0, 5).join("\n")}`);
            }
          } catch {
            // Skip unreadable files
          }
        }

        logger.debug("Search completed", { pattern, matchingFiles: results.length });
        if (results.length === 0) {
          return "No matches found";
        }

        return results.slice(0, 20).join("\n\n");
      } catch (error) {
        logger.error("Error searching files", { pattern, error: String(error) });
        return `Error searching: ${error}`;
      }
    },
    {
      name: "search_files",
      description:
        "Search for a pattern (regex) across project files. Returns matching lines with file paths and line numbers.",
      schema: z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        filePattern: z
          .string()
          .optional()
          .describe("Glob pattern to filter files (e.g., **/*.ts)"),
      }),
    }
  );

  const writeExplorationTool = tool(
    async ({ content }) => {
      logger.info("write_exploration called", { contentLength: content.length });
      try {
        await fs.ensureDir(memoryPath);
        await fs.writeFile(explorationPath, content, "utf-8");
        logger.info("Exploration file written", { path: explorationPath });
        return `Exploration saved to: ${explorationPath}`;
      } catch (error) {
        logger.error("Error writing exploration", { error: String(error) });
        return `Error writing exploration: ${error}`;
      }
    },
    {
      name: "write_exploration",
      description:
        "Write your exploration findings to EXPLORATION.md. This overwrites the file with your complete analysis.",
      schema: z.object({
        content: z
          .string()
          .describe("Complete markdown content for the exploration"),
      }),
    }
  );

  const updateExplorationTool = tool(
    async ({ content }) => {
      logger.info("update_exploration called", { contentLength: content.length });
      try {
        if (!(await fs.pathExists(explorationPath))) {
          logger.warn("Exploration file does not exist for update");
          return "Error: EXPLORATION.md does not exist. Use write_exploration to create it first.";
        }
        await fs.writeFile(explorationPath, content, "utf-8");
        logger.info("Exploration file updated", { path: explorationPath });
        return `Exploration updated: ${explorationPath}`;
      } catch (error) {
        logger.error("Error updating exploration", { error: String(error) });
        return `Error updating exploration: ${error}`;
      }
    },
    {
      name: "update_exploration",
      description:
        "Update the existing EXPLORATION.md with refined content. The file must already exist.",
      schema: z.object({
        content: z.string().describe("Updated markdown content"),
      }),
    }
  );

  return [
    readFileTool,
    listDirectoryTool,
    searchFilesTool,
    writeExplorationTool,
    updateExplorationTool,
  ];
}