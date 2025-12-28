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
          "REQUIRED FIRST STEP: Initialize context capturing for a new project before using search_context or update_context. Run this when: (1) Starting work on a new codebase, (2) User asks to 'set up context capturing', (3) search_context fails because no context exists. This explores the codebase and creates a structured knowledge base.",
        inputSchema: {
          type: "object",
          properties: {
            projectPath: {
              type: "string",
              description: "Absolute path to the project directory to analyze (e.g., '/Users/name/my-project')",
            },
          },
          required: ["projectPath"],
        },
      },
      {
        name: "search_context",
        description:
          "Search project knowledge base for architecture, patterns, and implementation details. USE THIS WHEN: (1) User asks 'how does X work?', (2) Need to understand existing patterns before implementing, (3) Looking for where something is implemented, (4) Need context about project architecture. Returns summarized knowledge with file references. Requires init_project to be run first.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language question about the project (e.g., 'How does authentication work?', 'Where are API endpoints defined?', 'What patterns are used for state management?')",
            },
            projectName: {
              type: "string",
              description: "Project name (optional - auto-detects from current directory)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "update_context",
        description:
          "Keep the project knowledge base in sync with code changes. USE THIS AFTER: (1) Implementing a new feature, (2) Refactoring existing code, (3) Changing architecture or patterns, (4) Adding new modules or components. Provide a description of what changed so the knowledge base stays accurate for future queries.",
        inputSchema: {
          type: "object",
          properties: {
            context: {
              type: "string",
              description: "Description of code changes made (e.g., 'Added JWT authentication middleware', 'Refactored user service to use repository pattern', 'Created new payment processing module')",
            },
            projectName: {
              type: "string",
              description: "Project name (optional - auto-detects from current directory)",
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