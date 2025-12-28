import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  model: string = "gpt-4o"
): Promise<string> {
  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model,
    messages,
  });
  return response.choices[0]?.message?.content || "";
}
