import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { type AgentStateType } from "../state/index.js";
import { writerToolsLogger as logger } from "../utils/logger.js";

export function createWriterTools(state: AgentStateType) {
  const { memoryPath, explorationPath } = state;
  logger.debug("Creating writer tools", { memoryPath, explorationPath });

  const readExplorationTool = tool(
    async () => {
      logger.debug("read_exploration called");
      try {
        if (!(await fs.pathExists(explorationPath))) {
          logger.warn("Exploration file does not exist");
          return "Error: EXPLORATION.md does not exist. Explorer agent must run first.";
        }
        const content = await fs.readFile(explorationPath, "utf-8");
        logger.debug("Exploration file read", { contentLength: content.length });
        return content;
      } catch (error) {
        logger.error("Error reading exploration", { error: String(error) });
        return `Error reading exploration: ${error}`;
      }
    },
    {
      name: "read_exploration",
      description: "Read the EXPLORATION.md file created by the Explorer agent.",
      schema: z.object({}),
    }
  );

  const writeContextTool = tool(
    async ({ domain, topic, content }) => {
      logger.info("write_context called", { domain, topic, contentLength: content.length });
      try {
        const domainPath = path.join(memoryPath, domain);
        const filePath = path.join(domainPath, `${topic}.md`);

        await fs.ensureDir(domainPath);
        await fs.writeFile(filePath, content, "utf-8");

        logger.info("Context file written", { path: `${domain}/${topic}.md` });
        return `Context written: ${domain}/${topic}.md`;
      } catch (error) {
        logger.error("Error writing context", { domain, topic, error: String(error) });
        return `Error writing context: ${error}`;
      }
    },
    {
      name: "write_context",
      description:
        "Write a context file to the Domain/Topic structure. Creates the domain folder if needed.",
      schema: z.object({
        domain: z
          .string()
          .describe("Domain name (e.g., Architecture, API, Frontend)"),
        topic: z
          .string()
          .describe("Topic name without extension (e.g., authentication, components)"),
        content: z.string().describe("Markdown content for the topic"),
      }),
    }
  );

  const updateContextTool = tool(
    async ({ domain, topic, content }) => {
      logger.info("update_context called", { domain, topic, contentLength: content.length });
      try {
        const filePath = path.join(memoryPath, domain, `${topic}.md`);

        if (!(await fs.pathExists(filePath))) {
          logger.warn("Context file does not exist for update", { domain, topic });
          return `Error: ${domain}/${topic}.md does not exist. Use write_context to create it.`;
        }

        await fs.writeFile(filePath, content, "utf-8");
        logger.info("Context file updated", { path: `${domain}/${topic}.md` });
        return `Context updated: ${domain}/${topic}.md`;
      } catch (error) {
        logger.error("Error updating context", { domain, topic, error: String(error) });
        return `Error updating context: ${error}`;
      }
    },
    {
      name: "update_context",
      description: "Update an existing context file with new content.",
      schema: z.object({
        domain: z.string().describe("Domain name"),
        topic: z.string().describe("Topic name without extension"),
        content: z.string().describe("Updated markdown content"),
      }),
    }
  );

  const listContextTool = tool(
    async () => {
      logger.debug("list_context called");
      try {
        if (!(await fs.pathExists(memoryPath))) {
          logger.debug("Memory path does not exist yet");
          return "No context tree exists yet.";
        }

        const entries = await fs.readdir(memoryPath, { withFileTypes: true });
        const domains: string[] = [];

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const domainPath = path.join(memoryPath, entry.name);
            const files = await glob("*.md", { cwd: domainPath });
            const topics = files.map((f) => path.basename(f, ".md"));
            domains.push(`📁 ${entry.name}/\n${topics.map((t) => `   📄 ${t}.md`).join("\n")}`);
          } else if (entry.name.endsWith(".md")) {
            domains.push(`📄 ${entry.name}`);
          }
        }

        logger.debug("Context tree listed", { domainCount: domains.length });
        if (domains.length === 0) {
          return "Context tree is empty.";
        }

        return domains.join("\n");
      } catch (error) {
        logger.error("Error listing context", { error: String(error) });
        return `Error listing context: ${error}`;
      }
    },
    {
      name: "list_context",
      description: "List the current context tree structure (domains and topics).",
      schema: z.object({}),
    }
  );

  const readContextTool = tool(
    async ({ domain, topic }) => {
      logger.debug("read_context called", { domain, topic });
      try {
        const filePath = path.join(memoryPath, domain, `${topic}.md`);

        if (!(await fs.pathExists(filePath))) {
          logger.warn("Context file does not exist", { domain, topic });
          return `Error: ${domain}/${topic}.md does not exist.`;
        }

        const content = await fs.readFile(filePath, "utf-8");
        logger.debug("Context file read", { domain, topic, contentLength: content.length });
        return content;
      } catch (error) {
        logger.error("Error reading context", { domain, topic, error: String(error) });
        return `Error reading context: ${error}`;
      }
    },
    {
      name: "read_context",
      description: "Read a specific context file.",
      schema: z.object({
        domain: z.string().describe("Domain name"),
        topic: z.string().describe("Topic name without extension"),
      }),
    }
  );

  return [
    readExplorationTool,
    writeContextTool,
    updateContextTool,
    listContextTool,
    readContextTool,
  ];
}
