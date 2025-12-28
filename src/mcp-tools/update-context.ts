import path from "path";
import fs from "fs-extra";
import { runUpdaterAgent } from "../agents/index.js";
import { getMemoryBasePath, listProjects } from "../memory/index.js";
import { type UpdaterState } from "../tools/updater.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("update-context");

export interface UpdateContextResult {
  success: boolean;
  projectName: string;
  context: string;
  result: string;
  error?: string;
}

export interface UpdateContextParams {
  context: string;
  projectName?: string;
  projectPath?: string;
}

interface ResolvedProject {
  projectName: string;
  projectPath: string;
}

/**
 * Resolve project name and path from various inputs
 * Priority: explicit projectName > derived from projectPath > auto-detect from cwd
 */
async function resolveProject(
  params: UpdateContextParams
): Promise<ResolvedProject | null> {
  // 1. Explicit project path provided
  if (params.projectPath) {
    const resolvedPath = path.resolve(params.projectPath);
    return {
      projectName: params.projectName || path.basename(resolvedPath),
      projectPath: resolvedPath,
    };
  }

  // 2. Try to auto-detect from current working directory
  const cwd = process.cwd();
  const cwdProjectName = path.basename(cwd);
  const projects = await listProjects();

  if (projects.includes(cwdProjectName)) {
    return {
      projectName: cwdProjectName,
      projectPath: cwd,
    };
  }

  // 3. Explicit project name without path - use cwd as fallback
  if (params.projectName && projects.includes(params.projectName)) {
    return {
      projectName: params.projectName,
      projectPath: cwd, // Best guess - user is likely in the project dir
    };
  }

  // 4. If only one project exists, use it with cwd
  if (projects.length === 1) {
    return {
      projectName: projects[0],
      projectPath: cwd,
    };
  }

  return null;
}

export async function updateContext(
  params: UpdateContextParams
): Promise<UpdateContextResult> {
  const { context } = params;

  logger.info("Updating context", {
    contextLength: context?.length || 0,
    projectName: params.projectName,
  });

  if (!context || context.trim() === "") {
    logger.error("Empty context provided");
    return {
      success: false,
      projectName: "",
      context,
      result: "",
      error: "Context cannot be empty",
    };
  }

  // Resolve project name and path
  const resolved = await resolveProject(params);

  if (!resolved) {
    const projects = await listProjects();
    logger.error("Could not resolve project", {
      availableProjects: projects,
    });
    return {
      success: false,
      projectName: "",
      context,
      result: "",
      error:
        projects.length === 0
          ? "No projects have been initialized. Use init_project first."
          : `Could not determine project. Available projects: ${projects.join(", ")}. Please specify projectName or projectPath.`,
    };
  }

  const { projectName, projectPath } = resolved;
  const memoryPath = path.join(getMemoryBasePath(), projectName);

  // Verify project exists
  if (!(await fs.pathExists(memoryPath))) {
    logger.error("Project context does not exist", { projectName, memoryPath });
    return {
      success: false,
      projectName,
      context,
      result: "",
      error: `No context exists for project "${projectName}". Use init_project first.`,
    };
  }

  logger.debug("Paths configured", { projectName, projectPath, memoryPath });

  // Build state for updater agent
  const state: UpdaterState = {
    projectName,
    projectPath,
    memoryPath,
    context,
  };

  try {
    logger.info("Starting Updater agent");
    const updateStart = Date.now();
    const result = await runUpdaterAgent(state);
    logger.info("Updater agent completed", {
      durationMs: Date.now() - updateStart,
    });

    return {
      success: true,
      projectName,
      context,
      result,
    };
  } catch (error) {
    logger.error("Update failed", { error: String(error) });
    return {
      success: false,
      projectName,
      context,
      result: "",
      error: String(error),
    };
  }
}
