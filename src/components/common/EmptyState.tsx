import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
        {title}
      </strong>
      <p>{description}</p>
    </div>
  );
}
