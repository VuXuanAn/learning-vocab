import { GoogleGenAI } from '@google/genai'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

// Normalize Gemini responses so the existing JSON/table validation stays shared.
export function createGeminiClient({ apiKey, ai } = {}) {
  const google = ai ?? new GoogleGenAI({ apiKey, httpOptions: { timeout: 45_000, retryOptions: { attempts: 1 } } })
  return { responses: { create: async request => {
    const result = await google.models.generateContent({
      model: request.model,
      contents: request.input,
      config: {
        systemInstruction: request.instructions,
        responseMimeType: 'application/json',
        responseJsonSchema: request.text.format.schema,
        maxOutputTokens: request.max_output_tokens,
      },
    })
    const candidate = result.candidates?.[0]
    const blocked = !!result.promptFeedback?.blockReason || ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(candidate?.finishReason)
    const usage = result.usageMetadata
    return {
      status: candidate?.finishReason === 'STOP' && !blocked ? 'completed' : 'incomplete',
      output_text: blocked ? '' : result.text ?? '',
      output: blocked ? [{ type: 'message', content: [{ type: 'refusal' }] }] : [],
      usage: usage ? { input_tokens: usage.promptTokenCount ?? 0, output_tokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) } : undefined,
    }
  } } }
}

export function providerError(error) {
  const status = Number(error?.status ?? error?.code)
  if (status === 401 || status === 403 || (status === 400 && /API_KEY_INVALID|API key not valid/i.test(error?.message ?? ''))) return { status: 502, error: 'Gemini API key chưa hợp lệ hoặc chưa có quyền truy cập. Kiểm tra GEMINI_API_KEY trong server/.env.' }
  if (status === 429) return { status: 429, error: 'Gemini đã đạt giới hạn request/token hoặc quota của project. Kiểm tra hạn mức trong Google AI Studio; free tier cũng có giới hạn.' }
  if (status === 404) return { status: 502, error: 'Model Gemini không tồn tại hoặc project chưa được dùng model này. Kiểm tra GEMINI_MODEL trong server/.env.' }
  if (status === 408 || status === 504 || ['AbortError', 'TimeoutError'].includes(error?.name) || /timeout|timed out/i.test(error?.message ?? '')) return { status: 504, error: 'Gemini phản hồi quá lâu. Hãy giảm số từ rồi thử lại.' }
  if (status === 400) return { status: 502, error: 'Gemini không chấp nhận cấu trúc yêu cầu hoặc model chưa hỗ trợ định dạng JSON này.' }
  return { status: 502, error: 'Không kết nối được Gemini. Kiểm tra mạng, API key và cấu hình model rồi thử lại.' }
}
