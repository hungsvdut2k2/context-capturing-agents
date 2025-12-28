#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initProject } from "./mcp-tools/index.js";
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