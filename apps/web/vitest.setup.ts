import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// the notification bell polls the API; layout tests render without a QueryClient
process.env.NEXT_PUBLIC_NOTIFICATIONS = '0';
