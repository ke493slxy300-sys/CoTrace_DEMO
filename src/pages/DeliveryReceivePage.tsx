import { useEffect, useRef, useState } from 'react';
import { Check, FileText } from 'lucide-react';
import { AppHeader } from '../components/layout/AppHeader';
import { MemberAvatar } from '../components/common/MemberAvatar';
import { receiveDelivery, useDelivery } from '../data/deliveryStore';
import { getMemberById } from '../data/members';
import { useActiveMemberId } from '../data/demoRoleStore';
import { DeliveryFactList } from './DeliveryFactList';
import './deliveryHandoff.css';

type DeliveryReceivePageProps = {
  onBack: () => void;
  onReceived: (integrationNodeId: string) => void;
};

type Phase = 'ready' | 'expanding' | 'done';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function DeliveryReceivePage({
  onBack,
  onReceived,
}: DeliveryReceivePageProps) {
  const delivery = useDelivery();
  const actorId = useActiveMemberId();
  const receiver = getMemberById(delivery.receiverId);
  const publisher = getMemberById(delivery.publisherId);
  const receiverName = receiver?.name ?? delivery.receiverId;
  const publisherName = publisher?.name ?? delivery.publisherId;
  const canReceive =
    delivery.status === 'published' && actorId === delivery.receiverId;

  const [phase, setPhase] = useState<Phase>(
    delivery.status === 'received' ? 'done' : 'ready',
  );
  const [busy, setBusy] = useState(false);
  const animatingRef = useRef(false);

  useEffect(() => {
    if (animatingRef.current) return;
    setPhase(delivery.status === 'received' ? 'done' : 'ready');
  }, [delivery.status]);

  const handleReceive = () => {
    if (!canReceive || busy) return;
    const reduced = prefersReducedMotion();
    if (reduced) {
      const result = receiveDelivery(actorId);
      if (!result.ok) return;
      setPhase('done');
      onReceived(result.integrationNodeId);
      return;
    }

    setBusy(true);
    animatingRef.current = true;
    setPhase('expanding');
    const result = receiveDelivery(actorId);
    if (!result.ok) {
      animatingRef.current = false;
      setPhase('ready');
      setBusy(false);
      return;
    }
    window.setTimeout(() => {
      animatingRef.current = false;
      setPhase('done');
      setBusy(false);
      onReceived(result.integrationNodeId);
    }, 300);
  };

  const showReceived =
    delivery.status === 'received' &&
    (phase === 'done' || phase === 'expanding');
  const showExpanding = phase === 'expanding';

  const cardClass = [
    'handoff-card',
    'is-receive',
    showExpanding ? 'is-expanding' : '',
    showReceived && phase === 'done' ? 'is-received' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="demo-light">
      <AppHeader />
      <div className="demo-light-page handoff-page">
        <button
          type="button"
          className="btn btn-ghost btn-compact demo-light-back"
          onClick={onBack}
        >
          返回蓝图
        </button>

        <div className="handoff-shell">
          <div className="handoff-main">
            <p className="handoff-kicker">原位交互</p>
            <h1>接收交付</h1>
            <p className="handoff-lead">
              先看清收到什么、下一步做什么、还需验证什么。确认后蓝图「交易流程联调」进入进行中。
            </p>

            <article className={cardClass} aria-label="接收卡片">
              <header className="handoff-card-head">
                <h2>
                  {delivery.title} {delivery.version}
                </h2>
                <div className="handoff-person handoff-head-avatar">
                  {publisher ? <MemberAvatar member={publisher} /> : null}
                  <span>{publisherName}</span>
                </div>
              </header>

              {delivery.status !== 'draft' ? (
                <span className="handoff-pending">
                  {delivery.pendingHighlight}
                </span>
              ) : null}

              <p className="handoff-count">
                <FileText size={16} strokeWidth={1.5} aria-hidden="true" />
                {delivery.files.length} 份文件
              </p>

              <div className="handoff-action-slot">
                {delivery.status === 'draft' ? (
                  <p className="handoff-note">尚未发布，还不能接收。</p>
                ) : showReceived && phase === 'done' ? (
                  <div className="handoff-received-bar">
                    <strong>
                      <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                      已接收 {delivery.version}
                    </strong>
                    <span className="handoff-received-divider" aria-hidden="true" />
                    <span>{delivery.nextStep}</span>
                  </div>
                ) : delivery.status === 'published' || showExpanding ? (
                  <button
                    type="button"
                    className={[
                      'btn',
                      'btn-primary',
                      'handoff-receive-btn',
                      showExpanding ? 'is-expanding' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={!canReceive || busy}
                    onClick={handleReceive}
                  >
                    接收 {delivery.version}
                  </button>
                ) : null}
              </div>
            </article>

            {delivery.status === 'published' &&
            actorId !== delivery.receiverId ? (
              <p className="handoff-note">
                请切换到 {receiverName}{' '}
                的视角后再确认接收。这个按钮不会由发布人代为接收。
              </p>
            ) : null}
          </div>

          <DeliveryFactList
            delivery={delivery}
            summary={delivery.summary}
            summaryEditable={false}
            surface="receive"
          />
        </div>
      </div>
    </div>
  );
}
