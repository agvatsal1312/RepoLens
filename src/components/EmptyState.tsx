import { ReactNode, ElementType } from 'react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
      <div className="w-16 h-16 bg-surface-card border border-border-base rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <Icon size={28} className="text-text-muted" />
      </div>
      <h3 className="font-headline-sm font-semibold text-text-primary mb-2">
        {title}
      </h3>
      <p className="font-body-md text-text-secondary max-w-sm mb-8">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
