import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BlueprintNode } from '../../types';
import { BLUEPRINT_STATUS_LABELS } from '../../data/blueprint';
import { handoffStatusLine } from '../../data/deliveryChain';
import { useDelivery } from '../../data/deliveryStore';
import { useActiveMemberId, useDemoRole } from '../../data/demoRoleStore';
import {
  HANDOFF_NODE_INTEGRATION,
  HANDOFF_PROJECT_ID,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { getMemberById } from '../../data/members';
import { getSeatflowProjectCard, SEATFLOW_PROJECT_ID } from '../../data/projectLogs';
import { getTeammateDatabaseFiles } from '../../datasets/built-in/campus-marketplace/content/teammatePack';
import {
  hashNodeDetail,
  hashPublish,
  hashReceive,
} from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
import { StudentTrail } from './StudentTrail';
import './workInbox.css';

type WorkInboxPageProps = {
  projectId: string;
  projectName: string;
  nodes: BlueprintNode[];
  onNavigate: (place: StudentPlace) => void;
  onOpenHash: (hash: string) => void;
};

type WorkRequest = {
  id: string;
  kind: 'receive' | 'revision';
  pending: boolean;
  fromName: string;
  fromInitial: string;
  title: string;
  version: string;
  summary: string;
  actionLabel: string;
  hash: string;
};

function displayNodeTitle(node: BlueprintNode): string {
  if (node.id === 'node-frontend') return '商品详情页';
  return node.name;
}

/** 数据库节点卡片：前三份 SQL 文件一行概览（对齐工作页原型信息密度） */
const DATABASE_FILE_BLURBS: Record<string, string> = {
  'sql/001_create_users_items.sql': 'users / items 表与商品 available·sold 状态',
  'sql/002_create_orders.sql': 'orders 表及标题、价格快照字段',
  'sql/003_add_order_constraints.sql': '一商品一单唯一约束与快照注释',
};

function databaseFilePreviews() {
  return getTeammateDatabaseFiles()
    .slice(0, 3)
    .map((file) => ({
      id: file.id,
      name: file.name.split('/').pop() ?? file.name,
      path: file.name,
      blurb:
        DATABASE_FILE_BLURBS[file.name] ??
        file.content
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith('--') && !line.startsWith('BEGIN'))
          ?.slice(0, 42) ??
        '数据库脚本',
    }));
}

export function WorkInboxPage({
  projectId,
  projectName,
  nodes,
  onNavigate,
  onOpenHash,
}: WorkInboxPageProps) {
  const delivery = useDelivery();
  const role = useDemoRole();
  const actorId = useActiveMemberId();
  const [showProcessed, setShowProcessed] = useState(false);

  const isCampus = projectId === HANDOFF_PROJECT_ID;
  const isSeatflow = projectId === SEATFLOW_PROJECT_ID;

  const requests = useMemo(() => {
    if (!isCampus) return [] as WorkRequest[];
    const publisher = getMemberById(delivery.publisherId);
    const receiver = getMemberById(delivery.receiverId);
    const isPublisher = actorId === delivery.publisherId;
    const isReceiver = actorId === delivery.receiverId;
    const items: WorkRequest[] = [];
    const versionKey = delivery.currentVersionId ?? delivery.version;

    // 草稿：发布方看到可打开的交付卡（避免重置后左栏空虚线盒）
    if (delivery.status === 'draft' && isPublisher) {
      items.push({
        id: `req-draft-${versionKey}`,
        kind: 'receive',
        pending: true,
        fromName: publisher?.name ?? 'Alex Lee',
        fromInitial: (publisher?.initials ?? 'A').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: handoffStatusLine(delivery.status, 'publisher'),
        actionLabel: '整理交付',
        hash: hashPublish(projectId, { from: 'work' }),
      });
      return items;
    }

    if (delivery.status === 'published' && isReceiver) {
      items.push({
        id: `req-receive-${versionKey}`,
        kind: 'receive',
        pending: true,
        fromName: publisher?.name ?? 'Alex Lee',
        fromInitial: (publisher?.initials ?? 'A').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: `请确认${delivery.title}的交付材料。`,
        actionLabel: '查看交付',
        hash: hashReceive(projectId, { from: 'work' }),
      });
    }

    // 进行中交接：发布方等待接收也放在待处理栏，便于打开交付内容
    if (delivery.status === 'published' && isPublisher) {
      items.push({
        id: `req-wait-${versionKey}`,
        kind: 'receive',
        pending: true,
        fromName: receiver?.name ?? 'Priya Shah',
        fromInitial: (receiver?.initials ?? 'P').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: handoffStatusLine(delivery.status, 'publisher'),
        actionLabel: '查看交付',
        hash: hashPublish(projectId, { from: 'work' }),
      });
    }

    if (delivery.status === 'needs-revision' && isPublisher) {
      items.push({
        id: `req-revision-${delivery.revisionRequest?.versionId ?? 'open'}`,
        kind: 'revision',
        pending: true,
        fromName: receiver?.name ?? 'Priya Shah',
        fromInitial: (receiver?.initials ?? 'P').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary:
          delivery.revisionRequest?.note ||
          `请根据修改意见修订 ${delivery.version} 后重发。`,
        actionLabel: '查看修改意见',
        hash: hashPublish(projectId, { from: 'work' }),
      });
    }

    // 接收方已提修改意见：仍展示进行中交接卡（等 Alex），不收入折叠的「已处理」
    if (delivery.status === 'needs-revision' && isReceiver) {
      items.push({
        id: `req-revision-sent-${delivery.revisionRequest?.versionId ?? 'sent'}`,
        kind: 'revision',
        pending: true,
        fromName: publisher?.name ?? 'Alex Lee',
        fromInitial: (publisher?.initials ?? 'A').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: handoffStatusLine(delivery.status, 'receiver'),
        actionLabel: '查看交付',
        hash: hashReceive(projectId, { from: 'work' }),
      });
    }

    if (delivery.status === 'received' && (isReceiver || isPublisher)) {
      items.push({
        id: `req-received-${versionKey}`,
        kind: 'receive',
        pending: false,
        fromName: publisher?.name ?? 'Alex Lee',
        fromInitial: (publisher?.initials ?? 'A').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: '已确认',
        actionLabel: '查看交付',
        hash: isReceiver
          ? hashReceive(projectId, { from: 'work' })
          : hashPublish(projectId, { from: 'work' }),
      });
    }

    return items;
  }, [actorId, delivery, isCampus, projectId]);

  const pending = requests.filter((item) => item.pending);
  const processed = requests.filter((item) => !item.pending);

  const myNodes = useMemo(() => {
    if (!isCampus) {
      return [] as Array<{
        node: BlueprintNode;
        statusLabel: string;
        reason: string | null;
        waiting: boolean;
        files: Array<{ id: string; name: string; path: string; blurb: string }>;
      }>;
    }

    const waitingReceive =
      delivery.status === 'published' || delivery.status === 'needs-revision';
    const received = delivery.status === 'received';

    const owned = nodes.filter((node) => node.ownerId === actorId);
    const extra: BlueprintNode[] = [];

    // 接收方在工作页可见联调节点（即使负责人是他人），以便处理上游门禁
    if (
      actorId === delivery.receiverId &&
      !owned.some((node) => node.id === HANDOFF_NODE_INTEGRATION)
    ) {
      const integration = nodes.find(
        (node) => node.id === HANDOFF_NODE_INTEGRATION,
      );
      if (integration) extra.push(integration);
    }

    // 发布方在修订态突出后端节点
    if (
      role === 'alex' &&
      !owned.some((node) => node.id === delivery.nodeId)
    ) {
      const backend = nodes.find((node) => node.id === delivery.nodeId);
      if (backend) extra.push(backend);
    }

    const list = [...owned, ...extra];
    const seen = new Set<string>();
    return list
      .filter((node) => {
        if (seen.has(node.id)) return false;
        seen.add(node.id);
        return true;
      })
      .map((node) => {
        const isIntegration = node.id === HANDOFF_NODE_INTEGRATION;
        const waiting = isIntegration && waitingReceive;
        let statusLabel = BLUEPRINT_STATUS_LABELS[node.status];
        let reason: string | null = null;
        if (waiting) {
          statusLabel = BLUEPRINT_STATUS_LABELS[node.status];
          reason = handoffStatusLine(
            delivery.status,
            role === 'priya' ? 'receiver' : 'publisher',
          );
        } else if (isIntegration && received) {
          statusLabel =
            node.status === 'todo' ? '进行中' : BLUEPRINT_STATUS_LABELS[node.status];
          reason = delivery.nextStep || '上游交付已确认，可继续联调。';
        } else {
          reason =
            node.summary ||
            (node.status === 'todo'
              ? '待开始 · 打开节点查看材料与交付'
              : null);
        }
        const files =
          node.id === 'node-database' ? databaseFilePreviews() : [];
        return { node, statusLabel, reason, waiting, files };
      });
  }, [actorId, delivery, isCampus, nodes, role]);

  if (isSeatflow) {
    const seat = getSeatflowProjectCard();
    return (
      <StudentShell
        place="work"
        projectName={seat.name}
        onNavigate={onNavigate}
      >
        <div className="wi">
          <div className="wi-head">
            <div>
              <StudentTrail
                segments={[{ label: seat.name }, { label: '工作' }]}
              />
              <h1>工作</h1>
            </div>
            <p>已完成 · 协作已归档</p>
          </div>
          <div className="wi-empty" role="status">
            协作已归档。
            <div className="wi-empty-links">
              <button type="button" className="wi-btn is-text" onClick={() => onNavigate('history')}>
                打开记录
              </button>
              <button type="button" className="wi-btn is-text" onClick={() => onNavigate('projects')}>
                所有项目
              </button>
            </div>
          </div>
        </div>
      </StudentShell>
    );
  }

  return (
    <StudentShell
      place="work"
      projectName={projectName || HANDOFF_PROJECT_NAME}
      onNavigate={onNavigate}
    >
      <div className="wi">
        <div className="wi-head">
          <div>
            <StudentTrail
              segments={[
                { label: projectName || HANDOFF_PROJECT_NAME },
                { label: '工作' },
              ]}
            />
            <h1>工作</h1>
          </div>
        </div>

        <div className="wi-grid">
          <section aria-label="队友协作请求">
            <div className="wi-col-head">
              <h2>队友协作请求</h2>
              {pending.length > 0 ? (
                <span className="wi-badge">待处理 {pending.length}</span>
              ) : null}
            </div>

            {pending.length === 0 ? (
              <div className="wi-empty">暂无待处理请求</div>
            ) : (
              pending.map((item) => (
                <article key={item.id} className="wi-request">
                  <div className="wi-request-top">
                    <span className="wi-avatar" aria-hidden="true">
                      {item.fromInitial}
                    </span>
                    <strong>{item.fromName}</strong>
                    <span className="wi-ver">{item.version}</span>
                  </div>
                  <div className="wi-request-title">
                    <strong>
                      {item.kind === 'revision' ? '修改意见 · ' : ''}
                      {item.title}
                    </strong>
                  </div>
                  <p>{item.summary}</p>
                  <div className="wi-request-actions">
                    <button
                      type="button"
                      className="wi-btn"
                      onClick={() => onOpenHash(item.hash)}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                </article>
              ))
            )}

            {processed.length > 0 ? (
              <>
                <button
                  type="button"
                  className="wi-processed"
                  onClick={() => setShowProcessed((value) => !value)}
                >
                  {showProcessed ? (
                    <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
                  )}{' '}
                  已处理请求
                </button>
                {showProcessed ? (
                  <div className="wi-processed-list">
                    {processed.map((item) => (
                      <article key={item.id} className="wi-request">
                        <div className="wi-request-top">
                          <span className="wi-avatar" aria-hidden="true">
                            {item.fromInitial}
                          </span>
                          <strong>{item.fromName}</strong>
                        </div>
                        <div className="wi-request-title">
                          <strong>{item.title}</strong>
                          <span className="wi-ver">{item.version}</span>
                        </div>
                        <p>{item.summary}</p>
                        <div className="wi-request-actions">
                          <button
                            type="button"
                            className="wi-btn is-text"
                            onClick={() => onOpenHash(item.hash)}
                          >
                            {item.actionLabel}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          <section aria-label="我负责的节点">
            <div className="wi-col-head">
              <h2>我负责的节点</h2>
            </div>
            {myNodes.length === 0 ? (
              <div className="wi-empty">还没有你负责的节点</div>
            ) : (
              <div className="wi-nodes">
                {myNodes.map(({ node, statusLabel, reason, waiting, files }) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`wi-node${waiting ? ' is-wait' : ''}${
                      node.status === 'done' || node.status === 'accepted'
                        ? ' is-done'
                        : ''
                    }`}
                    aria-label={`打开节点 ${displayNodeTitle(node)}`}
                    onClick={() =>
                      onOpenHash(
                        hashNodeDetail(projectId, {
                          node: node.id,
                          from: 'work',
                        }),
                      )
                    }
                  >
                    <div className="wi-node-top">
                      <strong>{displayNodeTitle(node)}</strong>
                      <span
                        className={`wi-node-status${
                          waiting
                            ? ' is-wait'
                            : node.status === 'done' || node.status === 'accepted'
                              ? ' is-done'
                              : ' is-progress'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {reason ? <p className="wi-node-summary">{reason}</p> : null}
                    {files.length > 0 ? (
                      <ul className="wi-file-preview" aria-label="数据库文件概览">
                        {files.map((file) => (
                          <li key={file.id}>
                            <code>{file.name}</code>
                            <span>{file.blurb}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </StudentShell>
  );
}
