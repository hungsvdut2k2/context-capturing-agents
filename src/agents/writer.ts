import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createWriterTools } from "../tools/index.js";
import { WRITER_SYSTEM_PROMPT } from "../prompts/index.js";
import { type AgentStateType } from "../state/index.js";
import { writerAgentLogger as logger } from "../utils/logger.js";

export function createWriterAgent(state: AgentStateType) {
  logger.debug("Creating writer agent", {
    projectName: state.projectName,
    memoryPath: state.memoryPath,
  });

  const tools = createWriterTools(state);
  logger.debug("Writer tools created", { toolCount: tools.length });

  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
  });

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: WRITER_SYSTEM_PROMPT,
  });

  logger.debug("Writer agent created successfully");
  return agent;
}

export async function runWriterAgent(state: AgentStateType): Promise<void> {
  logger.info("Running writer agent", { projectName: state.projectName });

  const agent = createWriterAgent(state);

  logger.debug("Invoking writer agent with initial prompt");
  const result = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          "Please read the exploration document, then organize its content into a structured context tree with appropriate domains and topics. Use write_context to create markdown files for each topic. When done, use list_context to show the final structure."
        ),
      ],
    },
    {
      recursionLimit: 100,
    }
  );

  logger.info("Writer agent finished", {
    messageCount: result.messages?.length || 0,
  });
}