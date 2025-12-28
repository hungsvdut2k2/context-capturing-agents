import path from "path";
import fs from "fs-extra";
import { runExplorerAgent } from "../agents/index.js";
import { runWriterAgent } from "../agents/index.js";
import { getMemoryBasePath } from "../memory/index.js";
import { EXPLORATION_FILE } from "../tools/explorer.js";
import { type AgentStateType } from "../state/index.js";
import { initProjectLogger as logger } from "../utils/logger.js";

export interface InitProjectResult {
  success: boolean;
  projectName: string;
  memoryPath: string;
  error?: string;
}

export async function initProject(
  projectPath: string
): Promise<InitProjectResult> {
  logger.info("Initializing project", { projectPath });

  // Validate project path
  if (!(await fs.pathExists(projectPath))) {
    logger.error("Project path does not exist", { projectPath });
    return {
      success: false,
      projectName: "",
      memoryPath: "",
      error: `Project path does not exist: ${projectPath}`,
    };
  }

  const projectName = path.basename(projectPath);
  const memoryPath = path.join(getMemoryBasePath(), projectName);
  const explorationPath = path.join(memoryPath, EXPLORATION_FILE);

  logger.debug("Paths configured", {
    projectName,
    memoryPath,
    explorationPath,
  });

  // Build state for agents
  const state: AgentStateType = {
    messages: [],
    projectPath,
    projectName,
    memoryPath,
    explorationPath,
  };

  try {
    // Step 1: Run Explorer agent
    logger.info("Starting Explorer agent");
    const explorerStart = Date.now();
    await runExplorerAgent(state);
    logger.info("Explorer agent completed", {
      durationMs: Date.now() - explorerStart,
    });

    // Verify exploration file was created
    if (!(await fs.pathExists(explorationPath))) {
      logger.error("Explorer agent did not create EXPLORATION.md");
      return {
        success: false,
        projectName,
        memoryPath,
        error: "Explorer agent did not create EXPLORATION.md",
      };
    }

    // Step 2: Run Writer agent
    logger.info("Starting Writer agent");
    const writerStart = Date.now();
    await runWriterAgent(state);
    logger.info("Writer agent completed", {
      durationMs: Date.now() - writerStart,
    });

    logger.info("Project initialization completed successfully", {
      projectName,
    });
    return {
      success: true,
      projectName,
      memoryPath,
    };
  } catch (error) {
    logger.error("Project initialization failed", { error: String(error) });
    return {
      success: false,
      projectName,
      memoryPath,
      error: String(error),
    };
  }
}
