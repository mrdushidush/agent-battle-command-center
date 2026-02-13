import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/utils';
import { StatusBadge } from './shared/StatusBadge';

describe('StatusBadge', () => {
  describe('Task Status Badges', () => {
    it('should render pending status', () => {
      render(<StatusBadge status="pending" type="task" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should render assigned status', () => {
      render(<StatusBadge status="assigned" type="task" />);
      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });

    it('should render in_progress status', () => {
      render(<StatusBadge status="in_progress" type="task" />);
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('should render needs_human status', () => {
      render(<StatusBadge status="needs_human" type="task" />);
      expect(screen.getByText('Needs Human')).toBeInTheDocument();
    });

    it('should render completed status', () => {
      render(<StatusBadge status="completed" type="task" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should render failed status', () => {
      render(<StatusBadge status="failed" type="task" />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should render aborted status', () => {
      render(<StatusBadge status="aborted" type="task" />);
      expect(screen.getByText('Aborted')).toBeInTheDocument();
    });
  });

  describe('Agent Status Badges', () => {
    it('should render idle status', () => {
      render(<StatusBadge status="idle" type="agent" />);
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should render busy status', () => {
      render(<StatusBadge status="busy" type="agent" />);
      expect(screen.getByText('Busy')).toBeInTheDocument();
    });

    it('should render stuck status', () => {
      render(<StatusBadge status="stuck" type="agent" />);
      expect(screen.getByText('Stuck')).toBeInTheDocument();
    });

    it('should render offline status', () => {
      render(<StatusBadge status="offline" type="agent" />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render small size', () => {
      const { container } = render(<StatusBadge status="pending" size="sm" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-[10px]');
    });

    it('should render medium size by default', () => {
      const { container } = render(<StatusBadge status="pending" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-xs');
    });

    it('should render medium size explicitly', () => {
      const { container } = render(<StatusBadge status="pending" size="md" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-xs');
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct class for pending status', () => {
      const { container } = render(<StatusBadge status="pending" type="task" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-status-pending/20', 'text-status-pending');
    });

    it('should apply correct class for completed status', () => {
      const { container } = render(<StatusBadge status="completed" type="task" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-status-completed/20', 'text-status-completed');
    });

    it('should apply correct class for failed status', () => {
      const { container } = render(<StatusBadge status="failed" type="task" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-status-failed/20', 'text-status-failed');
    });
  });
});
