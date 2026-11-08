import { useMemo, useState } from 'react';
import type { BlueprintNode } from '../../types';
import { BLUEPRINT_STATUS_LABELS } from '../../data/blueprint';
import { useDelivery } from '../../data/deliveryStore';
import { useActiveMemberId, useDemoRole } from '../../data/demoRoleStore';
import {
  HANDOFF_NODE_INTEGRATION,
  HANDOFF_PROJECT_ID,
  HANDOFF_PROJECT_NAME,
} from '../../data/handoffDemoSeed';
import { getMemberById } from '../../data/members';
import { getSeatflowProjectCard, SEATFLOW_PROJECT_ID } from '../../data/projectLogs';
import {
  hashBlueprint,
  hashPublish,
  hashReceive,
} from './studentRoutes';
import { StudentShell, type StudentPlace } from './StudentShell';
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
    const items: WorkRequest[] = [];

    if (
      delivery.status === 'published' &&
      actorId === delivery.receiverId
    ) {
      items.push({
        id: `req-receive-${delivery.currentVersionId ?? delivery.version}`,
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

    if (
      delivery.status === 'needs-revision' &&
      actorId === delivery.publisherId
    ) {
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

    if (
      delivery.status === 'needs-revision' &&
      actorId === delivery.receiverId
    ) {
      items.push({
        id: `req-revision-sent-${delivery.revisionRequest?.versionId ?? 'sent'}`,
        kind: 'revision',
        pending: false,
        fromName: '我',
        fromInitial: '我',
        title: delivery.title,
        version: delivery.version,
        summary: '已提交修改意见，等待发布方修订。',
        actionLabel: '查看交付',
        hash: hashReceive(projectId, { from: 'work' }),
      });
    }

    if (delivery.status === 'received') {
      const forReceiver = actorId === delivery.receiverId;
      const forPublisher = actorId === delivery.publisherId;
      if (forReceiver || forPublisher) {
        items.push({
          id: `req-received-${delivery.currentVersionId ?? delivery.version}`,
          kind: 'receive',
          pending: false,
          fromName: publisher?.name ?? 'Alex Lee',
          fromInitial: (publisher?.initials ?? 'A').slice(0, 1),
          title: delivery.title,
          version: delivery.version,
          summary: `已确认接收 ${delivery.version}。`,
          actionLabel: '查看交付',
          hash: forReceiver
            ? hashReceive(projectId, { from: 'work' })
            : hashPublish(projectId, { from: 'work' }),
        });
      }
    }

    if (
      delivery.status === 'published' &&
      actorId === delivery.publisherId
    ) {
      items.push({
        id: `req-wait-${delivery.currentVersionId ?? delivery.version}`,
        kind: 'receive',
        pending: false,
        fromName: receiver?.name ?? 'Priya Shah',
        fromInitial: (receiver?.initials ?? 'P').slice(0, 1),
        title: delivery.title,
        version: delivery.version,
        summary: `已发布 ${delivery.version}，等待对方确认接收。`,
        actionLabel: '查看交付',
        hash: hashPublish(projectId, { from: 'work' }),
      });
    }

    return items;
  }, [actorId, delivery, isCampus, projectId]);

  const pending = requests.filter((item) => item.pending);
  const processed = requests.filter((item) => !item.pending);

  const myNodes = useMemo(() => {
    if (!isCampus) return [] as Array<{
      node: BlueprintNode;
      statusLabel: string;
      reason: string | null;
      waiting: boolean;
    }>;

    const waitingReceive =
      delivery.status === 'published' || delivery.status === 'needs-revision';
    const received = delivery.status === 'received';
    const needsRevision = delivery.status === 'needs-revision';

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
          statusLabel = '等待确认接收';
          reason = needsRevision
            ? `上游 ${delivery.title} ${delivery.version} 待修订；确认有效版本后可开始联调。`
            : `确认${delivery.title} ${delivery.version} 后可开始联调。`;
        } else if (isIntegration && received) {
          statusLabel =
            node.status === 'todo' ? '进行中' : BLUEPRINT_STATUS_LABELS[node.status];
          reason = delivery.nextStep || '上游交付已确认，可继续联调。';
        } else if (node.status === 'done' || node.status === 'accepted') {
          reason = null;
        } else {
          reason = node.summary;
        }
        return { node, statusLabel, reason, waiting };
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
          <p className="wi-kicker">{seat.name}</p>
          <div className="wi-head">
            <h1>工作</h1>
            <p>SeatFlow 为已完成项目，协作请求与节点工作已归档。</p>
          </div>
          <div className="wi-empty" role="status">
            请从「记录」回看已确认经验，或返回「所有项目」打开进行中的校园项目。
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
        <p className="wi-kicker">{projectName}</p>
        <div className="wi-head">
          <h1>工作</h1>
          <p>处理队友请求，继续负责的节点。</p>
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
                    <span
                      className={`wi-pill ${
                        item.kind === 'revision' ? 'is-revision' : 'is-receive'
                      }`}
                    >
                      {item.kind === 'revision' ? '修改意见' : '请求接收'}
                    </span>
                  </div>
                  <div className="wi-request-title">
                    <strong>{item.title}</strong>
                    <span className="wi-ver">{item.version}</span>
                  </div>
                  <p>{item.summary}</p>
                  <button
                    type="button"
                    className="wi-btn"
                    onClick={() => onOpenHash(item.hash)}
                  >
                    {item.actionLabel}
                  </button>
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
                  {showProcessed ? '∨' : '>'} 已处理请求
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
                        <button
                          type="button"
                          className="wi-btn"
                          onClick={() => onOpenHash(item.hash)}
                        >
                          {item.actionLabel}
                        </button>
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
              <div className="wi-empty">当前视角暂无负责节点</div>
            ) : (
              <div className="wi-nodes">
                {myNodes.map(({ node, statusLabel, reason, waiting }) => (
                  <article
                    key={node.id}
                    className={`wi-node${waiting ? ' is-wait' : ''}`}
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
                    {reason ? <p>{reason}</p> : <p style={{ marginBottom: 14 }} />}
                    <button
                      type="button"
                      className="wi-btn is-ghost"
                      onClick={() =>
                        onOpenHash(
                          hashBlueprint(projectId, {
                            node: node.id,
                            from: 'work',
                          }),
                        )
                      }
                    >
                      查看节点
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </StudentShell>
  );
}
