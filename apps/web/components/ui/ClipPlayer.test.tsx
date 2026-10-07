import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClipPlayer } from './ClipPlayer';

describe('ClipPlayer', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      value: vi.fn(),
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('video error calls onRefreshNeeded', () => {
    const onRefreshMock = vi.fn();

    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1', durationSec: 60 }]} onRefreshNeeded={onRefreshMock} />
    );

    const video = screen.getByTestId('clip-video') as HTMLVideoElement;
    fireEvent.error(video);
    expect(onRefreshMock).toHaveBeenCalled();
  });

  it('two clips render two tabs and switching changes src', () => {
    const { rerender } = render(
      <ClipPlayer
        clips={[
          { id: 'c1', status: 'ready', viewUrl: 'url1' },
          { id: 'c2', status: 'ready', viewUrl: 'url2' },
        ]}
      />
    );

    expect(screen.getByTestId('clip-tab-0')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('clip-video')).toHaveAttribute('src', 'url1');

    fireEvent.click(screen.getByTestId('clip-tab-1'));
    expect(screen.getByTestId('clip-tab-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('clip-video')).toHaveAttribute('src', 'url2');
  });

  it('status pending shows not-ready + refresh button calls callback', () => {
    const onRefreshMock = vi.fn();

    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'pending', viewUrl: null }]} onRefreshNeeded={onRefreshMock} />
    );

    expect(screen.getByTestId('clip-not-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('clip-video')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('clip-refresh'));
    expect(onRefreshMock).toHaveBeenCalled();
  });

  it('plays a clip the API marks as uploaded', () => {
    render(<ClipPlayer clips={[{ id: 'c1', status: 'uploaded', viewUrl: 'url1', durationSec: 60 }]} />);
    expect(screen.getByTestId('clip-rewind')).toBeInTheDocument();
  });

  it('rewind button exists and is clickable', () => {
    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1', durationSec: 60 }]} />
    );

    expect(screen.getByTestId('clip-rewind')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clip-rewind'));
  });

  it('speed button sets aria-pressed correctly', () => {
    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1' }]} />
    );

    const btn15 = screen.getByTestId('clip-speed-1.5');
    fireEvent.click(btn15);

    expect(btn15).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('clip-speed-1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('Space key handler attached to container', () => {
    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1' }]} />
    );

    const container = screen.getByTestId('clip-player');
    expect(container).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(container, { key: ' ' });
  });

  it('onTimeUpdate callback provided and component renders', () => {
    const onTimeUpdateMock = vi.fn();

    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1' }]} onTimeUpdate={onTimeUpdateMock} />
    );

    expect(screen.getByTestId('clip-video')).toBeInTheDocument();
  });

  it('Arrow keys attach to container', () => {
    render(
      <ClipPlayer clips={[{ id: 'c1', status: 'ready', viewUrl: 'url1', durationSec: 60 }]} />
    );

    const container = screen.getByTestId('clip-player');
    fireEvent.keyDown(container, { key: 'ArrowLeft' });
    fireEvent.keyDown(container, { key: 'ArrowRight' });
  });
});
