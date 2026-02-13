import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height 
}: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse bg-gray-700/50',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded',
        variant === 'rectangular' && 'rounded',
        className
      )}
      style={{ width, height }}
    />
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="task-card opacity-60">
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-6 h-6 rounded" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-12" />
          </div>
        </div>
        <Skeleton className="h-4 w-8 rounded-full" />
      </div>

      {/* Description */}
      <Skeleton className="h-2 w-full mb-1" />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-2 w-8" />
      </div>
    </div>
  );
}

export function CompactMissionSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-command-border bg-command-panel min-w-[240px] opacity-60">
      {/* Top row */}
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" className="w-2 h-2" />
        <Skeleton className="h-2 w-16" />
        <Skeleton variant="circular" className="w-3 h-3" />
        <Skeleton className="h-3 w-20 flex-1" />
        <Skeleton variant="circular" className="w-3 h-3" />
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-8" />
        <Skeleton className="h-2 w-12" />
      </div>
    </div>
  );
}

export function TaskQueueSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ActiveMissionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-2 h-full items-center px-3 pb-2">
      {Array.from({ length: count }).map((_, i) => (
        <CompactMissionSkeleton key={i} />
      ))}
    </div>
  );
}
