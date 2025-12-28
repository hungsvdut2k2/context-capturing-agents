import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
  projectPath: Annotation<string>(),
  projectName: Annotation<string>(),
  memoryPath: Annotation<string>(),
  explorationPath: Annotation<string>(),
});

export type AgentStateType = typeof AgentState.State;