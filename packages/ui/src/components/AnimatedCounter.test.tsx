import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/utils';
import { AnimatedCounter } from './shared/AnimatedCounter';

describe('AnimatedCounter', () => {
  it('should render the value', () => {
    render(<AnimatedCounter value={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should handle zero value', () => {
    render(<AnimatedCounter value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle negative values', () => {
    render(<AnimatedCounter value={-5} />);
    expect(screen.getByText('-5')).toBeInTheDocument();
  });

  it('should handle large numbers', () => {
    render(<AnimatedCounter value={1000000} />);
    expect(screen.getByText('1000000')).toBeInTheDocument();
  });

  it('should format with prefix', () => {
    render(<AnimatedCounter value={42} prefix="$" />);
    expect(screen.getByText(/\$42/)).toBeInTheDocument();
  });

  it('should format with suffix', () => {
    render(<AnimatedCounter value={42} suffix="%" />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it('should format decimals', () => {
    render(<AnimatedCounter value={42.5678} decimals={2} />);
    expect(screen.getByText('42.57')).toBeInTheDocument();
  });

  it('should format with both prefix and suffix', () => {
    render(<AnimatedCounter value={42.5} prefix="$" suffix=" USD" decimals={2} />);
    expect(screen.getByText(/\$42\.50 USD/)).toBeInTheDocument();
  });
});
