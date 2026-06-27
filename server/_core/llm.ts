import Anthropic from "@anthropic-ai/sdk";
import { scrubText } from "../pii";

/**
 * LLM-lagret kör Claude (Anthropic Messages API) men behåller ett OpenAI-format
 * invokeLLM(params) → InvokeResult ({choices:[{message:{content}}]}) så anroparna
 * (emails.generate, intelligence.generate) inte behöver ändras.
 *
 * - Modell: claude-opus-4-8 (Anthropics mest kapabla modell).
 * - Prompt caching: system-blocket cachas (cache_control ephemeral).
 * - Strukturerad JSON: när anroparen skickar response_format json_schema mappas
 *   det till Anthropics output_config.format → svaret är giltig JSON i text-blocket.
 * - Nyckel via ANTHROPIC_API_KEY.
 */

const MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 8000;

// ─── OpenAI-kompatibla typer (oförändrade — anroparna importerar dessa) ─────────
export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = { type: "function"; function: { name: string } };
export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type JsonSchema = { name: string; schema: Record<string, unknown>; strict?: boolean };
export type OutputSchema = JsonSchema;
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string; tool_calls?: ToolCall[] };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

// ─── Hjälpare ──────────────────────────────────────────────────────────────────
function partToText(part: MessageContent): string {
  if (typeof part === "string") return part;
  if (part.type === "text") return part.text;
  // bild/fil-delar stöds inte i text-mappningen — anroparna använder bara text
  return "";
}

function contentToText(content: MessageContent | MessageContent[]): string {
  return (Array.isArray(content) ? content : [content]).map(partToText).join("\n").trim();
}

// Strippa ev. ```json … ``` -staket som modellen kan lägga runt JSON.
function stripCodeFences(s: string): string {
  const m = s.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  return m ? m[1].trim() : s;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();

  // Dela upp OpenAI-meddelanden: system → top-level, user/assistant → messages[]
  const systemParts: string[] = [];
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.messages) {
    const text = contentToText(m.content);
    if (!text) continue;
    if (m.role === "system") systemParts.push(text);
    else if (m.role === "user" || m.role === "assistant") messages.push({ role: m.role, content: text });
    // tool/function-roller används inte av våra anropare
  }
  const systemText = systemParts.join("\n\n");
  if (messages.length === 0) messages.push({ role: "user", content: systemText || "." });

  // Strukturerad JSON-output om schema angetts
  const rf = params.responseFormat || params.response_format;
  const schema =
    params.outputSchema ||
    params.output_schema ||
    (rf && rf.type === "json_schema" ? rf.json_schema : undefined);

  // PII-skyddsnät (Order 1): maska ev. e-post/telefon i ALLT utgående innehåll.
  const safeMessages = messages.map((m) => ({ role: m.role, content: scrubText(m.content) }));
  const safeSystem = scrubText(systemText);

  const req: Record<string, unknown> = {
    model: MODEL,
    max_tokens: params.maxTokens || params.max_tokens || DEFAULT_MAX_TOKENS,
    messages: safeMessages,
  };
  if (safeSystem) {
    // Prompt caching på system-blocket (återanvänds mellan genereringar)
    req.system = [{ type: "text", text: safeSystem, cache_control: { type: "ephemeral" } }];
  }
  if (schema?.schema) {
    // Anthropic structured outputs — garanterar schema-giltig JSON i text-blocket
    req.output_config = { format: { type: "json_schema", schema: schema.schema } };
  }

  const resp = await client.messages.create(req as any);

  const rawText = ((resp.content as any[]) || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const content = schema?.schema ? rawText : stripCodeFences(rawText);

  return {
    id: resp.id,
    created: Math.floor((resp as any).created ?? 0),
    model: resp.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: (resp.stop_reason as string) ?? null,
      },
    ],
    usage: resp.usage
      ? {
          prompt_tokens: resp.usage.input_tokens,
          completion_tokens: resp.usage.output_tokens,
          total_tokens: resp.usage.input_tokens + resp.usage.output_tokens,
        }
      : undefined,
  };
}
