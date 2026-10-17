import { useEffect, useId, useState } from 'react';
import { buildProjectCollaborators } from '../../data/collaborators';
import { projectTemplate } from '../../data/project';
import {
  createDemoRegisterDraft,
  draftToSelectionInputs,
  getRegisterCloseConfirmMessage,
  isRegisterDraftChanged,
  type RegisterCollaboratorDraft,
} from '../../data/registerDraft';
import type { ProjectCollaborator } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CollaboratorPickerPanel } from './CollaboratorPickerPanel';
import { RegisterCollaboratorsSection } from './RegisterCollaboratorsSection';

type ProjectRegisterModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (collaborators: ProjectCollaborator[]) => void;
};

export function ProjectRegisterModal({
  open,
  onClose,
  onCreate,
}: ProjectRegisterModalProps) {
  const titleId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** 打开注册弹窗即视为未提交会话（预置表单已展示） */
  const [hasUnsavedSession, setHasUnsavedSession] = useState(false);
  const [draft, setDraft] = useState<RegisterCollaboratorDraft>(
    createDemoRegisterDraft,
  );
  const [baselineDraft, setBaselineDraft] = useState<RegisterCollaboratorDraft>(
    createDemoRegisterDraft,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lockedHint, setLockedHint] = useState<string | null>(null);
  const [dutyEditorMemberId, setDutyEditorMemberId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setHasUnsavedSession(false);
      setPickerOpen(false);
      setLockedHint(null);
      setDutyEditorMemberId(null);
      return;
    }
    const demoDraft = createDemoRegisterDraft();
    setConfirmOpen(false);
    setHasUnsavedSession(true);
    setDraft(demoDraft);
    setBaselineDraft(demoDraft);
    setPickerOpen(false);
    setLockedHint(null);
    setDutyEditorMemberId(null);
  }, [open]);

  useEffect(() => {
    if (!lockedHint) return;
    const timer = window.setTimeout(() => setLockedHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [lockedHint]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();

      if (confirmOpen) {
        setConfirmOpen(false);
        return;
      }
      if (dutyEditorMemberId) {
        setDutyEditorMemberId(null);
        return;
      }
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      if (hasUnsavedSession) {
        setConfirmOpen(true);
        return;
      }
      onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    open,
    confirmOpen,
    pickerOpen,
    dutyEditorMemberId,
    hasUnsavedSession,
    onClose,
  ]);

  if (!open) return null;

  const collaboratorDraftChanged = isRegisterDraftChanged(draft, baselineDraft);
  const confirmMessage = getRegisterCloseConfirmMessage(draft);

  /** 取消 / 点击遮罩：关闭整个注册会话（侧板 Esc 另有分层关闭） */
  function requestClose() {
    if (hasUnsavedSession) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  }

  function handleDraftChange(next: RegisterCollaboratorDraft) {
    setDraft(next);
    setHasUnsavedSession(true);
    if (
      dutyEditorMemberId &&
      !next.selectedIds.includes(dutyEditorMemberId)
    ) {
      setDutyEditorMemberId(null);
    }
  }

  function discardAndClose() {
    setConfirmOpen(false);
    setHasUnsavedSession(false);
    setPickerOpen(false);
    setDutyEditorMemberId(null);
    setDraft(createDemoRegisterDraft());
    onClose();
  }

  function handleCreate() {
    const collaborators = buildProjectCollaborators(
      draftToSelectionInputs(draft),
    );
    setHasUnsavedSession(false);
    setPickerOpen(false);
    setDutyEditorMemberId(null);
    onCreate(collaborators);
  }

  return (
    <>
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={requestClose}
      >
        <div
          className={`register-modal-cluster${pickerOpen ? ' is-picker-open' : ''}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="register-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="discussion-modal-header">
              <h2 id={titleId}>注册课程项目</h2>
              <p>核心业务流程由系统预置，体验者不能修改。</p>
            </header>

            <div className="register-modal-body">
              <section className="register-section">
                <h3>项目基本信息</h3>
                <div className="entry-meta">
                  <div className="entry-meta-row">
                    <span>项目名称</span>
                    <span>{projectTemplate.name}</span>
                  </div>
                  <div className="entry-meta-row">
                    <span>所属课程</span>
                    <span>{projectTemplate.courseName}</span>
                  </div>
                  <div className="entry-meta-row">
                    <span>项目目标</span>
                    <span>{projectTemplate.goal}</span>
                  </div>
                </div>
              </section>

              <section className="register-section">
                <h3>核心业务流程</h3>
                <ol className="process-steps">
                  {projectTemplate.processSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <RegisterCollaboratorsSection
                draft={draft}
                pickerOpen={pickerOpen}
                lockedHint={lockedHint}
                onDraftChange={handleDraftChange}
                onLockedHint={setLockedHint}
                onOpenPicker={() => setPickerOpen(true)}
                onRequestDutyEdit={(memberId) => {
                  setPickerOpen(true);
                  setDutyEditorMemberId(memberId);
                }}
              />

              {collaboratorDraftChanged ? (
                <p className="register-draft-dirty" aria-live="polite">
                  协作者选择已修改，创建前不会保存到项目。
                </p>
              ) : null}
            </div>

            <footer className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={requestClose}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
              >
                创建项目并生成任务蓝图
              </button>
            </footer>
          </div>

          {pickerOpen ? (
            <CollaboratorPickerPanel
              draft={draft}
              dutyEditorMemberId={dutyEditorMemberId}
              lockedHint={lockedHint}
              onDraftChange={handleDraftChange}
              onLockedHint={setLockedHint}
              onClose={() => {
                setPickerOpen(false);
                setDutyEditorMemberId(null);
              }}
              onRequestDutyEdit={(memberId) => {
                setDutyEditorMemberId(memberId);
              }}
              onCloseDutyEditor={() => setDutyEditorMemberId(null)}
            />
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="关闭注册弹窗？"
        message={confirmMessage}
        confirmLabel="关闭并不保存"
        cancelLabel="继续查看"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={discardAndClose}
      />
    </>
  );
}
