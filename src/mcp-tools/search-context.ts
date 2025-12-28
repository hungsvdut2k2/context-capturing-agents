import path from "path";
import fs from "fs-extra";
import { runSearcherAgent } from "../agents/index.js";
import { getMemoryBasePath, listProjects } from "../memory/index.js";
import { type SearcherState } from "../tools/searcher.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("search-context");

export interface SearchContextResult {
  success: boolean;
  projectName: string;
  query: string;
  result: string;
  error?: string;
}

export interface SearchContextParams {
  query: string;
  projectName?: string;
  projectPath?: string;
}

/**
 * Resolve project name from various inputs
 * Priority: explicit projectName > derived from projectPath > auto-detect from cwd
 */
async function resolveProjectName(params: SearchContextParams): Promise<string | null> {
  // 1. Explicit project name provided
  if (params.projectName) {
    return params.projectName;
  }

  // 2. Derive from project path
  if (params.projectPath) {
    return path.basename(params.projectPath);
  }

  // 3. Try to auto-detect from current working directory
  const cwd = process.cwd();
  const cwdProjectName = path.basename(cwd);
  const projects = await listProjects();

  if (projects.includes(cwdProjectName)) {
    return cwdProjectName;
  }

  // 4. If only one project exists, use it
  if (projects.length === 1) {
    return projects[0];
  }

  return null;
}

export async function searchContext(
  params: SearchContextParams
): Promise<SearchContextResult> {
  const { query } = params;

  logger.info("Searching context", { query, projectName: params.projectName });

  if (!query || query.trim() === "") {
    logger.error("Empty query provided");
    return {
      success: false,
      projectName: "",
      query,
      result: "",
      error: "Query cannot be empty",
    };
  }

  // Resolve project name
  const projectName = await resolveProjectName(params);

  if (!projectName) {
    const projects = await listProjects();
    logger.error("Could not resolve project name", { availableProjects: projects });
    return {
      success: false,
      projectName: "",
      query,
      result: "",
      error: projects.length === 0
        ? "No projects have been initialized. Use init_project first."
        : `Could not determine project. Available projects: ${projects.join(", ")}. Please specify projectName.`,
    };
  }

  const memoryPath = path.join(getMemoryBasePath(), projectName);

  // Verify project exists
  if (!(await fs.pathExists(memoryPath))) {
    logger.error("Project context does not exist", { projectName, memoryPath });
    return {
      success: false,
      projectName,
      query,
      result: "",
      error: `No context exists for project "${projectName}". Use init_project first.`,
    };
  }

  logger.debug("Paths configured", { projectName, memoryPath });

  // Build state for searcher agent
  const state: SearcherState = {
    projectName,
    memoryPath,
    query,
  };

  try {
    logger.info("Starting Searcher agent");
    const searchStart = Date.now();
    const result = await runSearcherAgent(state);
    logger.info("Searcher agent completed", {
      durationMs: Date.now() - searchStart,
    });

    return {
      success: true,
      projectName,
      query,
      result,
    };
  } catch (error) {
    logger.error("Search failed", { error: String(error) });
    return {
      success: false,
      projectName,
      query,
      result: "",
      error: String(error),
    };
  }
}
