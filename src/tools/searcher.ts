import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs-extra";
import path from "path";
import { glob } from "glob";
import { searcherToolsLogger as logger } from "../utils/logger.js";

export interface SearcherState {
  projectName: string;
  memoryPath: string;
  query: string;
}

export function createSearcherTools(state: SearcherState) {
  const { memoryPath } = state;
  logger.debug("Creating searcher tools", { memoryPath });

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
          domainCount: entries.filter(e => e.isDirectory()).length
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
        "List the entire context tree structure showing all domains and their topics. Use this first to understand what knowledge is available.",
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
          contentLength: content.length
        });
        return content;
      } catch (error) {
        logger.error("Error reading topic", { domain, topic, error: String(error) });
        return `Error reading topic: ${error}`;
      }
    },
    {
      name: "read_topic",
      description:
        "Read the content of a specific topic file. Provide the domain and topic name.",
      schema: z.object({
        domain: z.string().describe("Domain name (folder name)"),
        topic: z
          .string()
          .describe("Topic name without .md extension"),
      }),
    }
  );

  return [listContextTreeTool, readTopicTool];
}
