/**
 * 最小校验：DemoSubmission 序列化 / 解析（不依赖浏览器）。
 * 运行：node scripts/verify-demo-submission.mjs
 */

import assert from 'node:assert/strict';

function serializeSubmissions(map) {
  return JSON.stringify({ submissionsByNodeId: map });
}

function parseSubmissions(raw) {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    return data.submissionsByNodeId ?? {};
  } catch {
    return {};
  }
}

const sample = {
  'node-backend': {
    id: 'demo-sub-1',
    projectId: 'project-campus-market-001',
    nodeId: 'node-backend',
    taskId: 'node-backend',
    author: 'Maya Chen',
    description: '测试提交说明',
    codeFiles: [
      {
        id: 'f1',
        name: 'src/services/orderService.js',
        language: 'javascript',
        content: 'export {}',
        taskId: 'node-backend',
        source: 'preset',
      },
    ],
    traceCards: [
      {
        id: 'trace-gap-analysis',
        title: '识别订单创建流程缺口',
        fragmentSummary: '摘要',
        humanUnderstanding: '理解',
        humanDecision: '决定',
      },
    ],
    createdAt: '2026-10-16T12:00:00.000Z',
  },
};

const raw = serializeSubmissions(sample);
const restored = parseSubmissions(raw);

assert.equal(Object.keys(restored).length, 1);
assert.equal(restored['node-backend'].author, 'Maya Chen');
assert.equal(restored['node-backend'].codeFiles.length, 1);
assert.equal(restored['node-backend'].traceCards[0].id, 'trace-gap-analysis');
assert.deepEqual(parseSubmissions(null), {});
assert.deepEqual(parseSubmissions('{bad'), {});
assert.ok(!('status' in restored['node-backend']));

console.log('verify-demo-submission: ok');
