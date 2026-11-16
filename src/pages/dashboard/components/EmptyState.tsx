interface EmptyStateProps {
  message?: string
}

export function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return <div className="dashboard-empty-state">{message}</div>
}
