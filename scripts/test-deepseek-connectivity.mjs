/**
 * 脱敏连通性测试：只汇报 success 或 errorType，不打印密钥。
 * 用法：npm run test:deepseek
 *   或：node --env-file=.env.local scripts/test-deepseek-connectivity.mjs
 */

const baseUrl = 'https://api.deepseek.com';
const apiKey = (process.env.DEEPSEEK_API_KEY ?? '').trim();
const model = (process.env.DEEPSEEK_MODEL ?? '').trim() || 'deepseek-flash';

async function probe() {
  if (!apiKey) {
    return { ok: false, errorType: 'missing_key' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
        temperature: 0,
        max_tokens: 8,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      try {
        await response.text();
      } catch {
        /* ignore */
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, errorType: 'auth' };
      }
      if (response.status === 404) return { ok: false, errorType: 'not_found' };
      if (response.status === 429) return { ok: false, errorType: 'rate_limit' };
      return { ok: false, errorType: 'upstream' };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, errorType: 'invalid_response' };
    }
    return { ok: true };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return { ok: false, errorType: 'timeout' };
    }
    return { ok: false, errorType: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

const result = await probe();
if (result.ok) {
  console.log('status: success');
} else {
  console.log('status: error');
  console.log(`errorType: ${result.errorType}`);
  process.exitCode = 1;
}
