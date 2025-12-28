#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initProject, searchContext, updateContext } from "./mcp-tools/index.js";
import { serverLogger } from "./utils/logger.js";

const server = new Server(
  {
    name: "context-capturing-agents",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  serverLogger.debug("Listing available tools");
  return {
    tools: [
      {
        name: "init_project",
        description:
          "Initialize context capturing for a project. This will explore the codebase using an AI agent and create a structured context tree in the memory directory.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Absolute path to the project directory to analyze",
            },
          },
          required: ["projectPath"],
        },
      },
      {
        name: "search_context",
        description:
          "Search the captured context tree for relevant knowledge. Uses an AI agent to understand your query, find matching topics, and return summarized information with references.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "What you want to know about the project (e.g., 'How does authentication work?')",
            },
            projectName: {
              type: "string",
              description: "Name of the project to search (optional - will auto-detect from cwd or use single available project)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "update_context",
        description:
          "Update the context tree with new information or changes. Uses an AI agent to analyze the provided context, determine what needs to be updated/created/skipped, and make the appropriate changes.",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "Description of what changed or new information to add (e.g., 'Added JWT authentication middleware to API routes')",
            },
            projectName: {
              type: "string",
              description: "Name of the project to update (optional - will auto-detect from cwd or use single available project)",
            },
          },
          required: ["context"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  serverLogger.info("Tool call received", { tool: name });

  if (name === "init_project") {
    const projectPath = (args as { projectPath: string }).projectPath;
    serverLogger.info("Starting init_project", { projectPath });

    const result = await initProject(projectPath);

    if (result.success) {
      serverLogger.info("init_project completed successfully", {
        projectName: result.projectName,
        memoryPath: result.memoryPath,
      });
      return {
        content: [
          {
            type: "text",
            text: `Successfully initialized context for project: ${result.projectName}\n\nContext tree created at: ${result.memoryPath}`,
          },
        ],
      };
    } else {
      serverLogger.error("init_project failed", { error: result.error });
      return {
        content: [
          {
            type: "text",
            text: `Failed to initialize project: ${result.error}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "search_context") {
    const { query, projectName } = args as { query: string; projectName?: string };
    serverLogger.info("Starting search_context", { query, projectName });

    const result = await searchContext({ query, projectName });

    if (result.success) {
      serverLogger.info("search_context completed successfully", {
        projectName: result.projectName,
      });
      return {
        content: [
          {
            type: "text",
            text: result.result,
          },
        ],
      };
    } else {
      serverLogger.error("search_context failed", { error: result.error });
      return {
        content: [
          {
            type: "text",
            text: `Search failed: ${result.error}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (name === "update_context") {
    const { context, projectName } = args as { context: string; projectName?: string };
    serverLogger.info("Starting update_context", { contextLength: context?.length, projectName });

    const result = await updateContext({ context, projectName });

    if (result.success) {
      serverLogger.info("update_context completed successfully", {
        projectName: result.projectName,
      });
      return {
        content: [
          {
            type: "text",
            text: result.result,
          },
        ],
      };
    } else {
      serverLogger.error("update_context failed", { error: result.error });
      return {
        content: [
          {
            type: "text",
            text: `Update failed: ${result.error}`,
          },
        ],
        isError: true,
      };
    }
  }

  serverLogger.warn("Unknown tool called", { tool: name });
  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  serverLogger.info("Starting MCP server", { version: "1.0.0" });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  serverLogger.info("MCP server connected and running on stdio");
}

main().catch((error) => {
  serverLogger.error("Server failed to start", { error: String(error) });
  process.exit(1);
});