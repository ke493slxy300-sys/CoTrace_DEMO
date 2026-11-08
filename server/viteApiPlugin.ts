/**
 * Vite 开发/预览中间件：/api/* 业务与真实模型入口。
 * 密钥只读服务端环境变量。
 */

import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { listDemoMaterials, getDemoMaterialMeta } from './materials/catalog';
import { loadMaterialBody } from './materials/bodies';
import {
  CAMPUS_INTEGRATION_GOAL,
  normalizeSharedLog,
  hasLiveApiKey,
  resolveAiMode,
  runHandoffAnalysis,
  runHandoffFocus,
  runHelpContext,
  runProgressQa,
  streamProgressQa,
  runStageBriefAi,
  runMemoryDraft,
  runBlueprintSuggest,
} from './ai/index';
import { actorFromRequest, readJson, sendJson } from './httpUtil';
import { checkRateLimit } from './rateLimit';
import {
  appendEvent,
  attachTeacherFeedback,
  getVersionSnapshot,
  listDeliveryMeta,
  listEvents,
  markNeedsRevision,
  markReceived,
  peekIdempotent,
  setIdempotent,
  upsertPublishedVersion,
  type ServerDeliveryVersion,
  type ServerProcessEvent,
} from './delivery/serverDeliveryStore';

function rateLimited(
  req: IncomingMessage,
  res: ServerResponse,
  routeKey: string,
  max = 60,
): boolean {
  const limited = checkRateLimit(req, routeKey, max);
  if (!limited.ok) {
    res.setHeader('Retry-After', String(limited.retryAfterSec));
    sendJson(res, 429, {
      ok: false,
      message: `请求过于频繁，请 ${limited.retryAfterSec}s 后重试`,
    });
    return true;
  }
  return false;
}

function requireActor(req: IncomingMessage, res: ServerResponse): string | null {
  const actor = actorFromRequest(req);
  if (!actor || actor === 'demo-anonymous') {
    // Demo：允许匿名读；写接口在各自 handler 再校验
    return actor;
  }
  return actor;
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      aiMode: resolveAiMode(),
      hasLiveKey: hasLiveApiKey(),
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/demo-materials') {
    const kind = url.searchParams.get('kind');
    let items = listDemoMaterials();
    if (kind === 'code' || kind === 'ai-chat') {
      items = items.filter((item) => item.kind === kind);
    }
    sendJson(res, 200, {
      materials: items.map(({ fixtureTag: _tag, ...meta }) => meta),
      aiMode: resolveAiMode(),
    });
    return true;
  }

  if (
    req.method === 'GET' &&
    pathname.startsWith('/api/demo-materials/') &&
    pathname.endsWith('/preview')
  ) {
    const id = pathname
      .slice('/api/demo-materials/'.length)
      .replace(/\/preview$/, '');
    const body = loadMaterialBody(id);
    if (!body) {
      sendJson(res, 404, { ok: false, message: '材料不存在' });
      return true;
    }
    sendJson(res, 200, {
      id: body.id,
      title: body.title,
      kind: body.kind,
      versionLabel: body.versionLabel,
      preview: body.body.slice(0, 400),
      fragmentLabels: body.fragments.map((item) => item.label),
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/handoff-analysis') {
    if (rateLimited(req, res, 'ai-analysis', 20)) return true;
    const body = await readJson(req);
    const codeMaterialId = String(body.codeMaterialId ?? '');
    const chatMaterialId = String(body.chatMaterialId ?? '');
    if (
      !getDemoMaterialMeta(codeMaterialId) ||
      !getDemoMaterialMeta(chatMaterialId)
    ) {
      sendJson(res, 400, { ok: false, message: '材料 ID 非法' });
      return true;
    }
    const result = await runHandoffAnalysis({
      projectId: String(body.projectId ?? ''),
      taskId: String(body.taskId ?? ''),
      codeMaterialId,
      chatMaterialId,
      requestToken:
        typeof body.requestToken === 'number' ? body.requestToken : undefined,
      taskGoal: typeof body.taskGoal === 'string' ? body.taskGoal : undefined,
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      analysis: result.result,
      requestToken: body.requestToken ?? null,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/handoff-focus') {
    if (rateLimited(req, res, 'ai-focus', 30)) return true;
    const body = await readJson(req);
    const codeMaterialId = String(body.codeMaterialId ?? '');
    const chatMaterialId = String(body.chatMaterialId ?? '');
    const code = loadMaterialBody(codeMaterialId);
    const chat = loadMaterialBody(chatMaterialId);
    if (!code || !chat) {
      sendJson(res, 400, { ok: false, message: '材料不存在' });
      return true;
    }
    const collaborationSummary = String(body.collaborationSummary ?? '');
    const sharedLog = normalizeSharedLog(body.sharedLog, collaborationSummary);
    const result = await runHandoffFocus({
      deliveryId: String(body.deliveryId ?? ''),
      versionId: String(body.versionId ?? ''),
      projectId: String(body.projectId ?? ''),
      collaborationSummary: sharedLog.summary || collaborationSummary,
      risks: Array.isArray(body.risks) ? body.risks.map(String) : [],
      riskNotes: String(body.riskNotes ?? ''),
      riskAcknowledged: Boolean(body.riskAcknowledged),
      sharedLog,
      integrationGoal:
        String(body.integrationGoal ?? '').trim() || CAMPUS_INTEGRATION_GOAL,
      codeBody: code.body,
      chatBody: chat.body,
      codeMaterialId,
      chatMaterialId,
      bypassCache: Boolean(body.bypassCache),
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, focus: result.result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/help-context') {
    if (rateLimited(req, res, 'ai-help', 30)) return true;
    const body = await readJson(req);
    const mode =
      body.mode === 'student-clarify' ? 'student-clarify' : 'teacher-brief';
    const collaborationSummary = String(body.collaborationSummary ?? '');
    const sharedLog = normalizeSharedLog(body.sharedLog, collaborationSummary);
    const result = await runHelpContext({
      mode,
      projectId: String(body.projectId ?? ''),
      taskId: String(body.taskId ?? ''),
      deliveryVersionId: String(body.deliveryVersionId ?? ''),
      studentText: String(body.studentText ?? ''),
      collaborationSummary: sharedLog.summary || collaborationSummary,
      sharedEvidence: Array.isArray(body.sharedEvidence)
        ? body.sharedEvidence.map(String)
        : [],
      selectedEvidence: Array.isArray(body.selectedEvidence)
        ? body.selectedEvidence.map(String)
        : [],
      adoptedSupplements: Array.isArray(body.adoptedSupplements)
        ? body.adoptedSupplements.map(String)
        : [],
      sharedLog,
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, help: result.result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/progress-qa') {
    if (rateLimited(req, res, 'ai-progress', 20)) return true;
    const body = await readJson(req);
    const result = await runProgressQa({
      projectId: String(body.projectId ?? ''),
      question: String(body.question ?? ''),
      contextSummary: String(body.contextSummary ?? ''),
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, progress: result.result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/stage-brief') {
    if (rateLimited(req, res, 'ai-stage', 20)) return true;
    const body = await readJson(req);
    const result = await runStageBriefAi({
      projectId: String(body.projectId ?? ''),
      eventsSummary: String(body.eventsSummary ?? ''),
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, stage: result.result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/memory-draft') {
    if (rateLimited(req, res, 'ai-memory', 20)) return true;
    const body = await readJson(req);
    const result = await runMemoryDraft({
      projectId: String(body.projectId ?? ''),
      topic: String(body.topic ?? ''),
      evidenceSummary: String(body.evidenceSummary ?? ''),
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, memory: result.result });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/blueprint-suggest') {
    if (rateLimited(req, res, 'ai-blueprint', 20)) return true;
    const body = await readJson(req);
    const result = await runBlueprintSuggest({
      projectId: String(body.projectId ?? ''),
      goal: String(body.goal ?? ''),
    });
    if (!result.ok) {
      sendJson(res, 422, result);
      return true;
    }
    sendJson(res, 200, { ok: true, blueprint: result.result });
    return true;
  }

  /** 真 token SSE：meta → token* → result → done（失败则 error → done） */
  if (req.method === 'POST' && pathname === '/api/ai/progress-qa/stream') {
    if (rateLimited(req, res, 'ai-progress-stream', 10)) return true;
    const body = await readJson(req);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      for await (const frame of streamProgressQa({
        projectId: String(body.projectId ?? ''),
        question: String(body.question ?? ''),
        contextSummary: String(body.contextSummary ?? ''),
      })) {
        if (frame.type === 'meta') {
          writeEvent('meta', { aiMode: frame.aiMode });
        } else if (frame.type === 'token') {
          writeEvent('token', { text: frame.text });
        } else if (frame.type === 'result') {
          writeEvent('result', frame.result);
        } else if (frame.type === 'error') {
          writeEvent('error', { message: frame.message });
        } else if (frame.type === 'done') {
          writeEvent('done', {});
        }
      }
    } catch (error) {
      writeEvent('error', {
        message: error instanceof Error ? error.message : 'stream failed',
      });
      writeEvent('done', {});
    }
    res.end();
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/deliveries/publish') {
    if (rateLimited(req, res, 'delivery-write', 40)) return true;
    const actor = requireActor(req, res);
    const body = await readJson(req);
    const idempotencyKey = String(
      body.idempotencyKey ?? req.headers['idempotency-key'] ?? '',
    );
    if (idempotencyKey) {
      const hit = peekIdempotent(`publish:${idempotencyKey}`);
      if (hit.hit) {
        sendJson(res, 200, { ok: true, replay: true, snapshot: hit.result });
        return true;
      }
    }
    const snapshot = body.snapshot as ServerDeliveryVersion | undefined;
    if (!snapshot?.deliveryId || !snapshot.versionId) {
      sendJson(res, 400, { ok: false, message: '缺少 snapshot' });
      return true;
    }
    if (
      actor &&
      actor !== 'demo-anonymous' &&
      snapshot.publisherId &&
      actor !== snapshot.publisherId
    ) {
      sendJson(res, 403, { ok: false, message: '仅发布人可发布该交付' });
      return true;
    }
    const saved = upsertPublishedVersion(snapshot);
    if (idempotencyKey) {
      setIdempotent(`publish:${idempotencyKey}`, saved);
    }
    const event: ServerProcessEvent = {
      id: String(body.eventId ?? `evt-pub-${snapshot.versionId}`),
      projectId: snapshot.projectId,
      kind: 'delivery-published',
      title: `发布 ${snapshot.version}`,
      summary: snapshot.summary || snapshot.brief,
      authorLabel: String(body.authorLabel ?? snapshot.publisherId),
      authorId: snapshot.publisherId,
      deliveryId: snapshot.deliveryId,
      deliveryVersionId: snapshot.versionId,
      statusLabel: '待接收',
      statusTone: 'warning',
      dateLabel: snapshot.publishedAt.slice(0, 10),
      createdAt: snapshot.publishedAt,
      evidence: [],
    };
    appendEvent(event);
    sendJson(res, 200, { ok: true, snapshot: saved, event });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/deliveries/receive') {
    if (rateLimited(req, res, 'delivery-write', 40)) return true;
    const body = await readJson(req);
    const deliveryId = String(body.deliveryId ?? '');
    const versionId = String(body.versionId ?? '');
    const at = String(body.at ?? new Date().toISOString());
    const idempotencyKey = String(body.idempotencyKey ?? '');
    if (idempotencyKey) {
      const hit = peekIdempotent(`receive:${idempotencyKey}`);
      if (hit.hit) {
        sendJson(res, 200, { ok: true, replay: true, ...(hit.result as object) });
        return true;
      }
    }
    const outcome = markReceived(deliveryId, versionId, at);
    if (!outcome.ok) {
      sendJson(res, 409, outcome);
      return true;
    }
    const event: ServerProcessEvent = {
      id: String(body.eventId ?? `evt-rcv-${versionId}`),
      projectId: String(body.projectId ?? ''),
      kind: 'delivery-received',
      title: '确认接收',
      summary: String(body.summary ?? '已接收交付'),
      authorLabel: String(body.authorLabel ?? ''),
      authorId: String(body.actorId ?? ''),
      deliveryId,
      deliveryVersionId: versionId,
      statusLabel: '已接收',
      statusTone: 'success',
      dateLabel: at.slice(0, 10),
      createdAt: at,
      evidence: [],
    };
    appendEvent(event);
    const payload = { ok: true, event };
    if (idempotencyKey) setIdempotent(`receive:${idempotencyKey}`, payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/deliveries/revision') {
    if (rateLimited(req, res, 'delivery-write', 40)) return true;
    const body = await readJson(req);
    const deliveryId = String(body.deliveryId ?? '');
    const versionId = String(body.versionId ?? '');
    const note = String(body.note ?? '');
    const at = String(body.at ?? new Date().toISOString());
    const outcome = markNeedsRevision(deliveryId, versionId, note, at);
    if (!outcome.ok) {
      sendJson(res, 409, outcome);
      return true;
    }
    const event: ServerProcessEvent = {
      id: String(body.eventId ?? `evt-rev-${versionId}-${Date.now()}`),
      projectId: String(body.projectId ?? ''),
      kind: 'delivery-revision',
      title: '提出修改意见',
      summary: note,
      authorLabel: String(body.authorLabel ?? ''),
      authorId: String(body.actorId ?? ''),
      deliveryId,
      deliveryVersionId: versionId,
      statusLabel: '待修改',
      statusTone: 'warning',
      dateLabel: at.slice(0, 10),
      createdAt: at,
      evidence: [],
    };
    appendEvent(event);
    sendJson(res, 200, { ok: true, event });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/help') {
    if (rateLimited(req, res, 'delivery-write', 40)) return true;
    const body = await readJson(req);
    const at = String(body.createdAt ?? new Date().toISOString());
    const event: ServerProcessEvent = {
      id: String(body.id ?? `evt-help-${Date.now()}`),
      projectId: String(body.projectId ?? ''),
      kind: 'student-help',
      title: '学生求助',
      summary: String(body.studentText ?? ''),
      authorLabel: String(body.authorLabel ?? ''),
      authorId: String(body.authorId ?? ''),
      deliveryId: String(body.deliveryId ?? ''),
      deliveryVersionId: String(body.versionId ?? ''),
      statusLabel: '待指导',
      statusTone: 'warning',
      dateLabel: at.slice(0, 10),
      createdAt: at,
      evidence: Array.isArray(body.adoptedClarify)
        ? body.adoptedClarify.map((item, index) => ({
            id: `ev-clarify-${index}`,
            kind: 'ai-suggestion',
            label: '采纳的澄清',
            summary: String(item),
            at,
            linkLabel: '求助',
          }))
        : [],
    };
    appendEvent(event);
    sendJson(res, 200, { ok: true, event });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    const projectId = url.searchParams.get('projectId') || '';
    sendJson(res, 200, {
      ok: true,
      events: listEvents(projectId),
    });
    return true;
  }

  if (
    req.method === 'POST' &&
    /^\/api\/events\/[^/]+\/feedback$/.test(pathname)
  ) {
    if (rateLimited(req, res, 'delivery-write', 40)) return true;
    const eventId = pathname.split('/')[3]!;
    const body = await readJson(req);
    const feedback = attachTeacherFeedback(eventId, {
      id: String(body.id ?? `evt-fb-${Date.now()}`),
      text: String(body.text ?? ''),
      authorLabel: String(body.authorLabel ?? '教师'),
      authorId: String(body.authorId ?? ''),
      at: String(body.at ?? new Date().toISOString()),
    });
    if (!feedback) {
      sendJson(res, 404, { ok: false, message: '事件不存在' });
      return true;
    }
    sendJson(res, 200, { ok: true, event: feedback });
    return true;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/deliveries/')) {
    const parts = pathname.split('/');
    // /api/deliveries/:id
    if (parts.length === 4 && parts[1] === 'api' && parts[2] === 'deliveries') {
      const meta = listDeliveryMeta(parts[3]!);
      if (!meta) {
        sendJson(res, 404, { ok: false, message: '交付不存在' });
        return true;
      }
      sendJson(res, 200, { ok: true, delivery: meta });
      return true;
    }
  }

  if (
    req.method === 'GET' &&
    /^\/api\/deliveries\/[^/]+\/versions\/[^/]+$/.test(pathname)
  ) {
    const parts = pathname.split('/');
    const deliveryId = parts[3]!;
    const versionId = parts[5]!;
    const snapshot = getVersionSnapshot(deliveryId, versionId);
    const codeId =
      url.searchParams.get('codeMaterialId') ||
      snapshot?.codeMaterialId ||
      null;
    const chatId =
      url.searchParams.get('chatMaterialId') ||
      snapshot?.chatMaterialId ||
      null;
    if (!snapshot) {
      sendJson(res, 404, {
        ok: false,
        message: '服务端尚无该版本快照；请先经 /api/deliveries/publish 同步',
        deliveryId,
        versionId,
        materials: {
          code: codeId ? loadMaterialBody(codeId) : null,
          chat: chatId ? loadMaterialBody(chatId) : null,
        },
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      deliveryId,
      versionId,
      snapshot,
      materials: {
        code: codeId ? loadMaterialBody(codeId) : null,
        chat: chatId ? loadMaterialBody(chatId) : null,
      },
    });
    return true;
  }

  return false;
}

function attachApiMiddleware(
  middlewares: Connect.Server,
  label: string,
): void {
  middlewares.use((req, res, next) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/') && rawUrl !== '/api') {
      next();
      return;
    }
    const host = req.headers.host || 'localhost';
    const url = new URL(rawUrl, `http://${host}`);
    void handleApi(req, res, url)
      .then((handled) => {
        if (!handled) next();
      })
      .catch((error: unknown) => {
        console.error(`[cotrace-api:${label}]`, error);
        sendJson(res, 500, {
          ok: false,
          message: error instanceof Error ? error.message : 'api error',
        });
      });
  });
}

function install(server: ViteDevServer | PreviewServer, label: string): void {
  console.log(`[cotrace-api] middleware installed (${label})`);
  attachApiMiddleware(server.middlewares, label);
}

export function cotraceApiPlugin(): Plugin {
  return {
    name: 'cotrace-api',
    configureServer(server) {
      install(server, 'dev');
    },
    configurePreviewServer(server) {
      install(server, 'preview');
    },
  };
}
