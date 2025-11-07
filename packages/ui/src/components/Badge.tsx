import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = ''
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-green-500/15 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-400',
    danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
    info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    neutral: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

// Status-specific badges for transactions
export type TransactionStatus = 'completed' | 'pending' | 'canceled';

export interface StatusBadgeProps {
  status: TransactionStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const statusMap: Record<TransactionStatus, { variant: BadgeVariant; label: string }> = {
    completed: { variant: 'success', label: 'Completed' },
    pending: { variant: 'warning', label: 'Pending' },
    canceled: { variant: 'neutral', label: 'Canceled' },
  };

  const { variant, label } = statusMap[status];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
};
