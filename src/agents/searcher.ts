import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createSearcherTools, type SearcherState } from "../tools/searcher.js";
import { SEARCHER_SYSTEM_PROMPT } from "../prompts/index.js";
import { searcherAgentLogger as logger } from "../utils/logger.js";

export function createSearcherAgent(state: SearcherState) {
  logger.debug("Creating searcher agent", {
    projectName: state.projectName,
    memoryPath: state.memoryPath,
  });

  const tools = createSearcherTools(state);
  logger.debug("Searcher tools created", { toolCount: tools.length });

  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
  });

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: SEARCHER_SYSTEM_PROMPT,
  });

  logger.debug("Searcher agent created successfully");
  return agent;
}

export async function runSearcherAgent(state: SearcherState): Promise<string> {
  logger.info("Running searcher agent", {
    projectName: state.projectName,
    query: state.query,
  });

  const agent = createSearcherAgent(state);

  logger.debug("Invoking searcher agent with query");
  const result = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          `Please search the context tree for information related to this query:\n\n"${state.query}"\n\nFirst list the context tree to see available domains and topics, then read relevant topics, and provide a summarized response with references.`
        ),
      ],
    },
    {
      recursionLimit: 50,
    }
  );

  logger.info("Searcher agent finished", {
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
        .filter((block): block is { type: "text"; text: string } =>
          typeof block === "object" && block !== null && "type" in block && block.type === "text"
        )
        .map((block) => block.text)
        .join("\n");
    }
  }

  return "No response generated from search agent.";
}
