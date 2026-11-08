import { useCallback, useState } from 'react';

/** Format 1-based evidence index as 01, 02, … */
export function evidenceLabel(index: number): string {
  return String(index).padStart(2, '0');
}

export function useEvidenceFocus(durationMs = 1200) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const focusEvidence = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setActiveId(id);
      window.setTimeout(() => {
        setActiveId((current) => (current === id ? null : current));
      }, durationMs);
    },
    [durationMs],
  );

  return { activeId, focusEvidence };
}

export function EvidenceChip({
  index,
  onFocus,
}: {
  index: number;
  onFocus: (id: string) => void;
}) {
  const label = evidenceLabel(index);
  const id = `evidence-${label}`;
  return (
    <button
      type="button"
      className="rd-chip"
      onClick={() => onFocus(id)}
      aria-label={`定位证据 ${label}`}
    >
      [{label}]
    </button>
  );
}
