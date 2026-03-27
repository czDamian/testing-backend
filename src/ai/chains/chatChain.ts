import { Anthropic } from "@anthropic-ai/sdk";
import { settings } from "../../config.js";
import { getHistory, appendMessages, SessionMessage } from "../../db/repos/sessionRepo.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";
import { CLAUDE_TOOLS, executeTool } from "../tools/index.js";
import log from "../../logger.js";

const anthropic = new Anthropic({
  apiKey: settings.anthropicApiKey,
});

/**
 * Runs a single turn of the chat conversation using the native Anthropic SDK.
 * Implements a recursive tool-calling loop.
 */
export async function runChat(smeId: string, userId: string, message: string) {
  // 1. Load context
  const systemPrompt = await buildSystemPrompt(smeId);
  const history = await getHistory(smeId, userId);
  
  // 2. Prepare conversation messages (limit to 10 most recent)
  const recentHistory = history.slice(-10);
  const messages: Anthropic.Messages.MessageParam[] = recentHistory.map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }));
  messages.push({ role: "user", content: message });

  let finalReply = "";
  let orderPlaced = false;

  try {
    // 3. Tool Loop
    while (true) {
      const response = await anthropic.messages.create({
        model: settings.anthropicModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools: CLAUDE_TOOLS,
        messages: messages
      });

      log.info({ msg: "chat_agent_response", stop_reason: response.stop_reason });

      // Add Claude's response to history
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find(c => c.type === "text");
        finalReply = textBlock?.type === "text" ? textBlock.text : "";
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === "tool_use") {
            log.info({ msg: "chat_agent_tool_call", tool: block.name, input: block.input });
            const result = await executeTool(smeId, block.name, block.input);
            log.info({ msg: "chat_agent_tool_result", tool: block.name, result: result.substring(0, 100) + "..." });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result
            });
            
            if (block.name === "place_order" && result.includes("successfully")) {
              orderPlaced = true;
            }
          }
        }

        messages.push({ role: "user", content: toolResults });
        // Continue loop to let Claude see tool results
      } else {
        break; 
      }
    }

    // 4. Save to DB
    await appendMessages(smeId, userId, message, finalReply);

    return { reply: finalReply, orderPlaced };

  } catch (err: any) {
    log.error({ msg: "chat_chain_error", smeId, userId, error: err.message });
    return {
      reply: "I'm sorry, I encountered an error. Please try again in a moment.",
      orderPlaced: false
    };
  }
}
