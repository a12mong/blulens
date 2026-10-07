import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WizardPage } from './WizardPage';

let me: unknown = { roles: ['Admin'] };
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/api', () => ({ useMe: () => ({ data: me, isPending: false }) }));
vi.mock('./CreateTournamentWizard', () => ({ CreateTournamentWizard: () => <div data-testid="wizard" /> }));

describe('WizardPage', () => {
  it('shows the wizard only to Committee', () => {
    me = { roles: ['Admin'] };
    const { unmount } = render(<WizardPage />);
    expect(screen.getByTestId('wizard-forbidden')).toBeInTheDocument();
    unmount();
    me = { roles: ['Admin', 'Committee'] };
    render(<WizardPage />);
    expect(screen.getByTestId('wizard')).toBeInTheDocument();
  });
});
