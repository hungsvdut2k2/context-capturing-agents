import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("tools:updater");

export interface UpdaterState {
  projectName: string;
  projectPath: string;
  memoryPath: string;
  context: string;
}

export function createUpdaterTools(state: UpdaterState) {
  const { memoryPath, projectPath } = state;
  logger.debug("Creating updater tools", { memoryPath, projectPath });

  const listContextTreeTool = tool(
    async () => {
      logger.debug("list_context_tree called", { memoryPath });
      try {
        if (!(await fs.pathExists(memoryPath))) {
          logger.warn("Memory path does not exist", { memoryPath });
          return "No context tree exists for this project.";
        }

        const entries = await fs.readdir(memoryPath, { withFileTypes: true });
        const tree: string[] = [];

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const domainPath = path.join(memoryPath, entry.name);
            const files = await glob("*.md", { cwd: domainPath });
            const topics = files.map((f) => path.basename(f, ".md"));

            if (topics.length > 0) {
              tree.push(`${entry.name}/`);
              topics.forEach((topic) => {
                tree.push(`  ├── ${topic}.md`);
              });
            }
          }
        }

        if (tree.length === 0) {
          logger.debug("Context tree is empty");
          return "Context tree is empty. No domains or topics found.";
        }

        logger.debug("Context tree listed", {
          domainCount: entries.filter((e) => e.isDirectory()).length,
        });
        return tree.join("\n");
      } catch (error) {
        logger.error("Error listing context tree", { error: String(error) });
        return `Error listing context tree: ${error}`;
      }
    },
    {
      name: "list_context_tree",
      description:
        "List the entire context tree structure showing all domains and their topics. Use this first to understand what knowledge exists.",
      schema: z.object({}),
    }
  );

  const readTopicTool = tool(
    async ({ domain, topic }) => {
      logger.debug("read_topic called", { domain, topic });
      try {
        const filePath = path.join(memoryPath, domain, `${topic}.md`);

        if (!(await fs.pathExists(filePath))) {
          logger.warn("Topic file does not exist", { domain, topic });
          return `Error: ${domain}/${topic}.md does not exist.`;
        }

        const content = await fs.readFile(filePath, "utf-8");
        logger.debug("Topic file read", {
          domain,
          topic,
          contentLength: content.length,
        });
        return content;
      } catch (error) {
        logger.error("Error reading topic", {
          domain,
          topic,
          error: String(error),
        });
        return `Error reading topic: ${error}`;
      }
    },
    {
      name: "read_topic",
      description:
        "Read the content of a specific topic file. Provide the domain and topic name.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name)"),
        topic: z.string().describe("Topic name without .md extension"),
      }),
    }
  );

  const updateTopicTool = tool(
    async ({ domain, topic, content, appendMode }) => {
      logger.debug("update_topic called", { domain, topic, appendMode });
      try {
        const filePath = path.join(memoryPath, domain, `${topic}.md`);

        if (!(await fs.pathExists(filePath))) {
          logger.warn("Topic file does not exist for update", {
            domain,
            topic,
          });
          return `Error: ${domain}/${topic}.md does not exist. Use create_topic instead.`;
        }

        if (appendMode) {
          const existingContent = await fs.readFile(filePath, "utf-8");
          const newContent = existingContent + "\n\n" + content;
          await fs.writeFile(filePath, newContent, "utf-8");
          logger.info("Topic file appended", { domain, topic });
          return `Successfully appended to ${domain}/${topic}.md`;
        } else {
          await fs.writeFile(filePath, content, "utf-8");
          logger.info("Topic file replaced", { domain, topic });
          return `Successfully updated ${domain}/${topic}.md`;
        }
      } catch (error) {
        logger.error("Error updating topic", {
          domain,
          topic,
          error: String(error),
        });
        return `Error updating topic: ${error}`;
      }
    },
    {
      name: "update_topic",
      description:
        "Update an existing topic file with new content. Can either replace the entire content or append to it.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name)"),
        topic: z.string().describe("Topic name without .md extension"),
        content: z.string().describe("New content to write or append"),
        appendMode: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, append content to existing file. If false (default), replace entire content."
          ),
      }),
    }
  );

  const createTopicTool = tool(
    async ({ domain, topic, content }) => {
      logger.debug("create_topic called", { domain, topic });
      try {
        const domainPath = path.join(memoryPath, domain);
        const filePath = path.join(domainPath, `${topic}.md`);

        // Check if domain exists
        if (!(await fs.pathExists(domainPath))) {
          logger.warn("Domain does not exist", { domain });
          return `Error: Domain "${domain}" does not exist. Use create_domain first or specify an existing domain.`;
        }

        // Check if topic already exists
        if (await fs.pathExists(filePath)) {
          logger.warn("Topic already exists", { domain, topic });
          return `Error: ${domain}/${topic}.md already exists. Use update_topic instead.`;
        }

        await fs.writeFile(filePath, content, "utf-8");
        logger.info("Topic file created", { domain, topic });
        return `Successfully created ${domain}/${topic}.md`;
      } catch (error) {
        logger.error("Error creating topic", {
          domain,
          topic,
          error: String(error),
        });
        return `Error creating topic: ${error}`;
      }
    },
    {
      name: "create_topic",
      description:
        "Create a new topic file in an existing domain. Use this for adding new subjects within an existing category.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name) - must exist"),
        topic: z
          .string()
          .describe("Topic name without .md extension - must not exist"),
        content: z.string().describe("Content for the new topic file"),
      }),
    }
  );

  const createDomainTool = tool(
    async ({ domain, initialTopic, initialContent }) => {
      logger.debug("create_domain called", { domain, initialTopic });
      try {
        const domainPath = path.join(memoryPath, domain);

        // Check if domain already exists
        if (await fs.pathExists(domainPath)) {
          logger.warn("Domain already exists", { domain });
          return `Error: Domain "${domain}" already exists. Use create_topic to add topics to it.`;
        }

        // Create domain directory
        await fs.ensureDir(domainPath);

        // Create initial topic if provided
        if (initialTopic && initialContent) {
          const filePath = path.join(domainPath, `${initialTopic}.md`);
          await fs.writeFile(filePath, initialContent, "utf-8");
          logger.info("Domain and initial topic created", {
            domain,
            topic: initialTopic,
          });
          return `Successfully created domain "${domain}" with initial topic ${initialTopic}.md`;
        }

        logger.info("Domain created", { domain });
        return `Successfully created domain "${domain}"`;
      } catch (error) {
        logger.error("Error creating domain", {
          domain,
          error: String(error),
        });
        return `Error creating domain: ${error}`;
      }
    },
    {
      name: "create_domain",
      description:
        "Create a new domain (category) in the context tree. Only use for genuinely new areas not covered by existing domains. Can optionally create an initial topic.",
      schema: z.object({
        domain: z
          .string()
          .describe(
            "Domain name (use PascalCase, e.g., Infrastructure, GraphQL)"
          ),
        initialTopic: z
          .string()
          .optional()
          .describe("Optional: name of initial topic without .md extension"),
        initialContent: z
          .string()
          .optional()
          .describe("Optional: content for initial topic (required if initialTopic is provided)"),
      }),
    }
  );

  const deleteTopicTool = tool(
    async ({ domain, topic }) => {
      logger.debug("delete_topic called", { domain, topic });
      try {
        const filePath = path.join(memoryPath, domain, `${topic}.md`);

        if (!(await fs.pathExists(filePath))) {
          logger.warn("Topic file does not exist for deletion", {
            domain,
            topic,
          });
          return `Error: ${domain}/${topic}.md does not exist.`;
        }

        await fs.remove(filePath);
        logger.info("Topic file deleted", { domain, topic });
        return `Successfully deleted ${domain}/${topic}.md`;
      } catch (error) {
        logger.error("Error deleting topic", {
          domain,
          topic,
          error: String(error),
        });
        return `Error deleting topic: ${error}`;
      }
    },
    {
      name: "delete_topic",
      description:
        "Delete a topic file that is no longer relevant or has become obsolete. Use this to clean up outdated documentation.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name)"),
        topic: z.string().describe("Topic name without .md extension"),
      }),
    }
  );

  const deleteDomainTool = tool(
    async ({ domain }) => {
      logger.debug("delete_domain called", { domain });
      try {
        const domainPath = path.join(memoryPath, domain);

        if (!(await fs.pathExists(domainPath))) {
          logger.warn("Domain does not exist for deletion", { domain });
          return `Error: Domain "${domain}" does not exist.`;
        }

        // Check if domain has topics
        const files = await glob("*.md", { cwd: domainPath });
        if (files.length > 0) {
          logger.warn("Domain has topics, confirming deletion", {
            domain,
            topicCount: files.length,
          });
        }

        await fs.remove(domainPath);
        logger.info("Domain deleted", { domain, topicsRemoved: files.length });
        return `Successfully deleted domain "${domain}" (${files.length} topic(s) removed)`;
      } catch (error) {
        logger.error("Error deleting domain", {
          domain,
          error: String(error),
        });
        return `Error deleting domain: ${error}`;
      }
    },
    {
      name: "delete_domain",
      description:
        "Delete an entire domain and all its topics. Use with caution - only when an entire area of documentation is no longer relevant.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name) to delete"),
      }),
    }
  );

  const readSourceFileTool = tool(
    async ({ filePath: relativePath }) => {
      logger.debug("read_source_file called", { relativePath, projectPath });
      try {
        // Resolve relative path against project path
        const absolutePath = path.isAbsolute(relativePath)
          ? relativePath
          : path.join(projectPath, relativePath);

        // Security: ensure file is within project directory
        const normalizedPath = path.normalize(absolutePath);
        const normalizedProjectPath = path.normalize(projectPath);
        if (!normalizedPath.startsWith(normalizedProjectPath)) {
          logger.warn("Attempted to read file outside project", {
            relativePath,
            absolutePath,
          });
          return `Error: Cannot read files outside the project directory.`;
        }

        if (!(await fs.pathExists(absolutePath))) {
          logger.warn("Source file does not exist", { absolutePath });
          return `Error: File "${relativePath}" does not exist.`;
        }

        const stats = await fs.stat(absolutePath);
        if (stats.isDirectory()) {
          logger.warn("Path is a directory, not a file", { absolutePath });
          return `Error: "${relativePath}" is a directory, not a file.`;
        }

        // Limit file size to prevent reading huge files
        const maxSize = 100 * 1024; // 100KB
        if (stats.size > maxSize) {
          logger.warn("File too large to read", {
            absolutePath,
            size: stats.size,
          });
          return `Error: File "${relativePath}" is too large (${Math.round(stats.size / 1024)}KB). Maximum size is 100KB.`;
        }

        const content = await fs.readFile(absolutePath, "utf-8");
        logger.debug("Source file read", {
          relativePath,
          contentLength: content.length,
        });
        return content;
      } catch (error) {
        logger.error("Error reading source file", {
          relativePath,
          error: String(error),
        });
        return `Error reading source file: ${error}`;
      }
    },
    {
      name: "read_source_file",
      description:
        "Read a file from the original project codebase. Use this to verify changes, understand implementation details, or gather accurate information for documentation updates.",
      schema: z.object({
        filePath: z
          .string()
          .describe(
            "Path to the file, relative to project root (e.g., 'src/auth/middleware.ts')"
          ),
      }),
    }
  );

  const listSourceDirectoryTool = tool(
    async ({ dirPath: relativePath }) => {
      logger.debug("list_source_directory called", { relativePath, projectPath });
      try {
        const absolutePath = relativePath
          ? path.isAbsolute(relativePath)
            ? relativePath
            : path.join(projectPath, relativePath)
          : projectPath;

        // Security: ensure directory is within project
        const normalizedPath = path.normalize(absolutePath);
        const normalizedProjectPath = path.normalize(projectPath);
        if (!normalizedPath.startsWith(normalizedProjectPath)) {
          logger.warn("Attempted to list directory outside project", {
            relativePath,
            absolutePath,
          });
          return `Error: Cannot list directories outside the project.`;
        }

        if (!(await fs.pathExists(absolutePath))) {
          logger.warn("Directory does not exist", { absolutePath });
          return `Error: Directory "${relativePath || '.'}" does not exist.`;
        }

        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        const result: string[] = [];

        for (const entry of entries) {
          // Skip hidden files and common non-essential directories
          if (entry.name.startsWith(".") || entry.name === "node_modules") {
            continue;
          }
          if (entry.isDirectory()) {
            result.push(`${entry.name}/`);
          } else {
            result.push(entry.name);
          }
        }

        logger.debug("Directory listed", {
          relativePath,
          entryCount: result.length,
        });
        return result.length > 0 ? result.join("\n") : "Directory is empty.";
      } catch (error) {
        logger.error("Error listing directory", {
          relativePath,
          error: String(error),
        });
        return `Error listing directory: ${error}`;
      }
    },
    {
      name: "list_source_directory",
      description:
        "List files and subdirectories in a project directory. Use this to explore the project structure and find relevant files.",
      schema: z.object({
        dirPath: z
          .string()
          .optional()
          .describe(
            "Path to directory relative to project root (e.g., 'src/auth'). Leave empty for project root."
          ),
      }),
    }
  );

  return [
    listContextTreeTool,
    readTopicTool,
    updateTopicTool,
    createTopicTool,
    createDomainTool,
    deleteTopicTool,
    deleteDomainTool,
    readSourceFileTool,
    listSourceDirectoryTool,
  ];
}
