import { env } from '../../config/env';
import { logger } from '../../observability/logger';

export async function generateGeminiJson(input: {
  systemInstruction: string;
  prompt: unknown;
  timeoutMs?: number;
}): Promise<unknown | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(input.prompt) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 8_000),
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed with ${response.status}`);
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    return text ? JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) : null;
  } catch (error) {
    logger.warn({ err: error }, 'Gemini request failed');
    return null;
  }
}

export async function generateGeminiText(input: { systemInstruction: string; prompt: string; timeoutMs?: number }): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed with ${response.status}`);
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return (
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() || null
    );
  } catch (error) {
    logger.warn({ err: error }, 'Gemini request failed');
    return null;
  }
}
