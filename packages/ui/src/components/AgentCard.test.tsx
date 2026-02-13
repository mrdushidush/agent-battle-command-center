import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/utils';
import { mockAgent, mockTask } from '../test/utils';
import { AgentCard } from './shared/AgentCard';

// Mock the store and hooks
vi.mock('../../store/uiState', () => ({
  useUIStore: () => ({
    selectedAgentId: null,
    selectAgent: vi.fn(),
    tasks: [],
  }),
}));

vi.mock('../../hooks/useAgents', () => ({
  useAgents: () => ({
    pauseAgent: vi.fn(),
    resumeAgent: vi.fn(),
    abortAgentTask: vi.fn(),
  }),
}));

describe('AgentCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render agent name', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });

    it('should render agent status', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText('idle')).toBeInTheDocument();
    });

    it('should render agent type icon', () => {
      const { container } = render(<AgentCard agent={mockAgent} />);
      // Check for icon (lucide-react renders SVG)
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Status Dot', () => {
    it('should show idle status dot', () => {
      const { container } = render(<AgentCard agent={{ ...mockAgent, status: 'idle' }} />);
      const statusDot = container.querySelector('.status-dot');
      expect(statusDot).toHaveClass('status-dot-idle');
    });

    it('should show busy status dot', () => {
      const { container } = render(<AgentCard agent={{ ...mockAgent, status: 'busy' }} />);
      const statusDot = container.querySelector('.status-dot');
      expect(statusDot).toHaveClass('status-dot-busy');
    });

    it('should show stuck status dot', () => {
      const { container } = render(<AgentCard agent={{ ...mockAgent, status: 'stuck' }} />);
      const statusDot = container.querySelector('.status-dot');
      expect(statusDot).toHaveClass('status-dot-stuck');
    });

    it('should show offline status dot', () => {
      const { container } = render(<AgentCard agent={{ ...mockAgent, status: 'offline' }} />);
      const statusDot = container.querySelector('.status-dot');
      expect(statusDot).toHaveClass('status-dot-offline');
    });
  });

  describe('Agent Types', () => {
    it('should render coder agent', () => {
      const coderAgent = { ...mockAgent, type: 'coder', agentType: { ...mockAgent.agentType, name: 'coder' } };
      render(<AgentCard agent={coderAgent as any} />);
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });

    it('should render qa agent', () => {
      const qaAgent = { ...mockAgent, type: 'qa', agentType: { ...mockAgent.agentType, name: 'qa' } };
      render(<AgentCard agent={qaAgent as any} />);
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
    });
  });

  describe('Stats Display', () => {
    it('should display tasks completed', () => {
      render(<AgentCard agent={mockAgent} />);
      // Stats are rendered in the full card
      expect(screen.getByText(/10/)).toBeInTheDocument(); // tasksCompleted
    });

    it('should display tasks failed', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText(/2/)).toBeInTheDocument(); // tasksFailed
    });

    it('should display success rate', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText(/83%/)).toBeInTheDocument(); // successRate
    });

    it('should display average time', () => {
      render(<AgentCard agent={mockAgent} />);
      expect(screen.getByText(/12s/)).toBeInTheDocument(); // avgTimeMs
    });
  });

  describe('Compact Mode', () => {
    it('should render in compact mode', () => {
      render(<AgentCard agent={mockAgent} compact />);
      expect(screen.getByText('Test Agent')).toBeInTheDocument();
      // In compact mode, status text should still be visible but stats hidden
    });

    it('should show truncated current task in compact mode', () => {
      const busyAgent = {
        ...mockAgent,
        status: 'busy' as const,
        currentTaskId: 'test-task-1',
      };

      // Mock the useUIStore to return a task
      vi.mocked(vi.importMock('../../store/uiState')).useUIStore = () => ({
        selectedAgentId: null,
        selectAgent: vi.fn(),
        tasks: [mockTask],
      });

      render(<AgentCard agent={busyAgent} compact />);
      // Current task title should be shown in compact mode
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  describe('Agent Colors', () => {
    it('should apply coder color scheme', () => {
      const coderAgent = { ...mockAgent, type: 'coder', agentType: { ...mockAgent.agentType, name: 'coder' } };
      const { container } = render(<AgentCard agent={coderAgent as any} />);
      const icon = container.querySelector('.text-agent-coder');
      expect(icon).toBeInTheDocument();
    });

    it('should apply qa color scheme', () => {
      const qaAgent = { ...mockAgent, type: 'qa', agentType: { ...mockAgent.agentType, name: 'qa' } };
      const { container } = render(<AgentCard agent={qaAgent as any} />);
      const icon = container.querySelector('.text-agent-qa');
      expect(icon).toBeInTheDocument();
    });
  });
});
