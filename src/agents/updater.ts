import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createUpdaterTools, type UpdaterState } from "../tools/updater.js";
import { UPDATER_SYSTEM_PROMPT } from "../prompts/index.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("agent:updater");

export function createUpdaterAgent(state: UpdaterState) {
  logger.debug("Creating updater agent", {
    projectName: state.projectName,
    memoryPath: state.memoryPath,
  });

  const tools = createUpdaterTools(state);
  logger.debug("Updater tools created", { toolCount: tools.length });

  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
  });

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: UPDATER_SYSTEM_PROMPT,
  });

  logger.debug("Updater agent created successfully");
  return agent;
}

export async function runUpdaterAgent(state: UpdaterState): Promise<string> {
  logger.info("Running updater agent", {
    projectName: state.projectName,
    contextLength: state.context.length,
  });

  const agent = createUpdaterAgent(state);

  logger.debug("Invoking updater agent with context");
  const result = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          `Please update the context tree with the following new information or changes:\n\n"${state.context}"\n\nFirst list the context tree to see existing domains and topics, then determine what needs to be updated, created, or skipped. Execute the appropriate actions and provide a summary of what was done.`
        ),
      ],
    },
    {
      recursionLimit: 100,
    }
  );

  logger.info("Updater agent finished", {
    messageCount: result.messages?.length || 0,
  });

  // Extract the final response from the agent
  const messages = result.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (lastMessage && lastMessage instanceof AIMessage) {
    const content = lastMessage.content;
    if (typeof content === "string") {
      return content;
    }
    // Handle complex content (array of content blocks)
    if (Array.isArray(content)) {
      return content
        .filter(
          (block): block is { type: "text"; text: string } =>
            typeof block === "object" &&
            block !== null &&
            "type" in block &&
            block.type === "text"
        )
        .map((block) => block.text)
        .join("\n");
    }
  }

  return "No response generated from update agent.";
}
