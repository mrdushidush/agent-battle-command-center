import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/utils';
import { mockTask } from '../test/utils';
import { TaskCard } from './shared/TaskCard';

// Mock the store and hooks
vi.mock('../../store/uiState', () => ({
  useUIStore: () => ({
    selectedTaskId: null,
    selectTask: vi.fn(),
    agents: [],
    agentHealth: {},
  }),
}));

vi.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    deleteTask: vi.fn(),
  }),
}));

vi.mock('../../api/client', () => ({
  executeApi: vi.fn(),
}));

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render task title', () => {
      render(<TaskCard task={mockTask} />);
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should render task type icon', () => {
      const { container } = render(<TaskCard task={mockTask} />);
      // Check for Code icon (lucide-react renders SVG)
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should render priority level', () => {
      const highPriorityTask = { ...mockTask, priority: 9 };
      render(<TaskCard task={highPriorityTask} />);
      expect(screen.getByText('P9')).toBeInTheDocument();
    });
  });

  describe('Priority Levels', () => {
    it('should show high priority for priority >= 8', () => {
      const { container } = render(<TaskCard task={{ ...mockTask, priority: 8 }} />);
      const priorityBadge = screen.getByText('P8').closest('span');
      expect(priorityBadge).toHaveClass('bg-hud-red/20', 'text-hud-red');
    });

    it('should show medium priority for priority 5-7', () => {
      const { container } = render(<TaskCard task={{ ...mockTask, priority: 6 }} />);
      const priorityBadge = screen.getByText('P6').closest('span');
      expect(priorityBadge).toHaveClass('bg-hud-amber/20', 'text-hud-amber');
    });

    it('should show low priority for priority < 5', () => {
      const { container } = render(<TaskCard task={{ ...mockTask, priority: 3 }} />);
      const priorityBadge = screen.getByText('P3').closest('span');
      expect(priorityBadge).toHaveClass('bg-gray-500/20', 'text-gray-400');
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      const { container } = render(<TaskCard task={mockTask} compact />);
      // Compact mode should still show title
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      // But with different styling
      expect(container.firstChild).toHaveClass('cursor-pointer');
    });
  });

  describe('Task Types', () => {
    it('should render code task type', () => {
      render(<TaskCard task={{ ...mockTask, taskType: 'code' }} />);
      // Icon should be present
      const { container } = render(<TaskCard task={{ ...mockTask, taskType: 'code' }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render test task type', () => {
      const { container } = render(<TaskCard task={{ ...mockTask, taskType: 'test' }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render review task type', () => {
      const { container } = render(<TaskCard task={{ ...mockTask, taskType: 'review' }} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onClick when provided', () => {
      const onClick = vi.fn();
      render(<TaskCard task={mockTask} onClick={onClick} />);

      const card = screen.getByText('Test Task').closest('.task-card');
      card?.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
