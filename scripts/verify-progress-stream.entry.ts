/**
 * Assert progress-qa/stream emits multiple token frames (true stream, not one-shot).
 */
import assert from 'node:assert/strict';
import { streamProgressQa } from '../server/ai/index';

process.env.COTRACE_AI_MODE = process.env.COTRACE_AI_MODE || 'mock';

let tokenCount = 0;
let sawResult = false;
let sawDone = false;
let answer = '';

for await (const frame of streamProgressQa({
  projectId: 'proj-1',
  question: '当前版本还缺什么才能安心联调？',
  contextSummary: '版本 ver-1；待确认：错误码提示',
})) {
  if (frame.type === 'token') {
    tokenCount += 1;
    answer += frame.text;
  } else if (frame.type === 'result') {
    sawResult = true;
    assert.ok(frame.result.answer.length > 0);
    assert.equal(frame.result.provider, 'mock');
    assert.ok(Array.isArray(frame.result.nextChecks));
  } else if (frame.type === 'done') {
    sawDone = true;
  } else if (frame.type === 'error') {
    assert.fail(`unexpected stream error: ${frame.message}`);
  }
}

assert.ok(tokenCount >= 2, `expected >=2 token frames, got ${tokenCount}`);
assert.equal(sawResult, true);
assert.equal(sawDone, true);
assert.ok(answer.length > 0);

console.log(
  JSON.stringify({
    ok: true,
    streamProgressQa: true,
    tokenCount,
    answerChars: answer.length,
  }),
);
