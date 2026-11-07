import { runHandoffAnalysis } from '../server/ai/index.ts';

const pairs: Array<[string, string, string]> = [
  ['match', 'mat-code-order-v04', 'mat-chat-order-v04'],
  ['wrong', 'mat-code-order-v03', 'mat-chat-order-v03'],
  ['irrelevant', 'mat-code-unrelated-frontend', 'mat-chat-unrelated-seat'],
  ['no-test', 'mat-code-order-v04', 'mat-chat-order-no-test'],
];

const rows: Array<Record<string, unknown>> = [];
for (const [name, codeMaterialId, chatMaterialId] of pairs) {
  const started = Date.now();
  const result = await runHandoffAnalysis({
    projectId: 'project-campus-marketplace',
    taskId: 'node-backend',
    codeMaterialId,
    chatMaterialId,
  });
  const row = {
    name,
    ok: result.ok,
    verdict: result.ok ? result.result.verdict : null,
    provider: result.ok ? result.result.provider : null,
    model: result.ok ? result.result.modelLabel : null,
    latencyMs: result.ok ? result.result.latencyMs : Date.now() - started,
    message: result.ok ? undefined : result.message,
    differences: result.ok ? result.result.differences.slice(0, 2) : [],
    humanActions: result.ok
      ? result.result.collaborationLog.humanActions.length
      : 0,
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
console.log('LIVE_REPORT', JSON.stringify(rows, null, 2));
