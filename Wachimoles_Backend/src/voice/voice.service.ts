import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sanitizeIntent, VoiceContext, VoiceIntent } from "./voice-intent";
import { buildSystemPrompt } from "./voice-catalog";

export interface InterpretResult {
  intent: VoiceIntent | null;
  /** Mensaje corto para el usuario cuando no hay una acción clara. */
  message?: string;
}

export interface VoiceHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export const VOICE_LOCALES = ["es", "en"] as const;
export type VoiceLocale = (typeof VOICE_LOCALES)[number];

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>("DEEPSEEK_API_KEY") || undefined;
    this.baseUrl = (
      config.get<string>("DEEPSEEK_BASE_URL") || "https://api.deepseek.com"
    ).replace(/\/$/, "");
    this.model = config.get<string>("DEEPSEEK_MODEL") || "deepseek-chat";
  }

  async interpret(
    text: string,
    locale: VoiceLocale = "es",
    history: VoiceHistoryTurn[] = [],
    context?: VoiceContext
  ): Promise<InterpretResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        "LLM interpretation is not configured."
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(locale, context)
            },
            ...history.map(({ role, content }) => ({ role, content })),
            { role: "user", content: text }
          ]
        }),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      this.logger.warn(
        `DeepSeek unreachable: ${error instanceof Error ? error.name + " " + error.message : String(error)}`
      );
      throw new BadGatewayException("The language model is unreachable.");
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logger.warn(`DeepSeek responded ${response.status}: ${detail.slice(0, 300)}`);
      throw new BadGatewayException(
        `The language model request failed (${response.status}).`
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = payload?.choices?.[0]?.message?.content;

    let parsed: unknown = null;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : null;
    } catch {
      parsed = null;
    }

    const intent = sanitizeIntent(parsed);
    if (intent) return { intent };

    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message.slice(0, 200)
        : undefined;
    return { intent: null, message };
  }
}
