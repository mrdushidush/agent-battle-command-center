import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '../test/utils';
import { AnimatedCounter } from './shared/AnimatedCounter';

describe('AnimatedCounter', () => {
  it('should render the value with default decimals', async () => {
    render(<AnimatedCounter value={42} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('42.00')).toBeInTheDocument();
    });
  });

  it('should handle zero value', async () => {
    render(<AnimatedCounter value={0} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('0.00')).toBeInTheDocument();
    });
  });

  it('should handle negative values', async () => {
    render(<AnimatedCounter value={-5} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('-5.00')).toBeInTheDocument();
    });
  });

  it('should handle large numbers', async () => {
    render(<AnimatedCounter value={1000000} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('1000000.00')).toBeInTheDocument();
    });
  });

  it('should format with prefix', () => {
    render(<AnimatedCounter value={42} prefix="$" duration={0} />);
    expect(screen.getByText(/\$42\.00/)).toBeInTheDocument();
  });

  it('should format with suffix', async () => {
    render(<AnimatedCounter value={42} suffix="%" duration={0} />);
    await waitFor(() => {
      const element = screen.getByText((content, el) => {
        return el?.textContent?.includes('42.00') && el?.textContent?.includes('%') || false;
      });
      expect(element).toBeInTheDocument();
    });
  });

  it('should format decimals', async () => {
    render(<AnimatedCounter value={42.5678} decimals={2} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('42.57')).toBeInTheDocument();
    });
  });

  it('should format with both prefix and suffix', async () => {
    render(<AnimatedCounter value={42.5} prefix="$" suffix=" USD" decimals={2} duration={0} />);
    await waitFor(() => {
      const element = screen.getByText((content, el) => {
        return el?.textContent?.includes('$') && 
               el?.textContent?.includes('42.50') && 
               el?.textContent?.includes('USD') || false;
      });
      expect(element).toBeInTheDocument();
    });
  });

  it('should respect decimals=0 for integer display', async () => {
    render(<AnimatedCounter value={42} decimals={0} duration={0} />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });
});
