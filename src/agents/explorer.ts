import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createExplorerTools } from "../tools/index.js";
import { EXPLORER_SYSTEM_PROMPT } from "../prompts/index.js";
import { type AgentStateType } from "../state/index.js";
import { explorerAgentLogger as logger } from "../utils/logger.js";

export function createExplorerAgent(state: AgentStateType) {
  logger.debug("Creating explorer agent", {
    projectPath: state.projectPath,
    projectName: state.projectName,
  });

  const tools = createExplorerTools(state);
  logger.debug("Explorer tools created", { toolCount: tools.length });

  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
  });

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: EXPLORER_SYSTEM_PROMPT,
  });

  logger.debug("Explorer agent created successfully");
  return agent;
}

export async function runExplorerAgent(state: AgentStateType): Promise<void> {
  logger.info("Running explorer agent", { projectName: state.projectName });

  const agent = createExplorerAgent(state);

  logger.debug("Invoking explorer agent with initial prompt");
  const result = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          "Please explore the codebase and document your findings. " +
          "IMPORTANT: Start by calling read_agent_context to check for existing AI agent documentation (CLAUDE.md, .cursor/rules, agents.md, etc.). " +
          "Then list the directory structure, read key files, and finally write a comprehensive EXPLORATION.md file that integrates both your findings and any existing agent context."
        ),
      ],
    },
    {
      recursionLimit: 100,
    }
  );

  logger.info("Explorer agent finished", {
    messageCount: result.messages?.length || 0,
  });
}
