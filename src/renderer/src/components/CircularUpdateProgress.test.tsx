import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CircularUpdateProgress } from './CircularUpdateProgress';

describe('CircularUpdateProgress', () => {
  it('does not render when status is idle', () => {
    const { container } = render(
      <CircularUpdateProgress
        updateState={{ status: 'idle' }}
        onOpenUpdatesSettings={vi.fn()}
        onInstallUpdate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders progress and arrow down during download', () => {
    const onOpen = vi.fn();
    const onInstall = vi.fn();

    render(
      <CircularUpdateProgress
        updateState={{
          status: 'downloading',
          percent: 45,
          version: '2.3.5'
        }}
        onOpenUpdatesSettings={onOpen}
        onInstallUpdate={onInstall}
      />
    );

    const button = screen.getByTitle(/Загрузка обновления: 45%/i);
    expect(button).toBeDefined();

    // Clicking during download opens updates settings tab
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onInstall).not.toHaveBeenCalled();
  });

  it('renders ready state and calls onInstallUpdate when clicked', () => {
    const onOpen = vi.fn();
    const onInstall = vi.fn();

    render(
      <CircularUpdateProgress
        updateState={{
          status: 'downloaded',
          version: '2.3.5',
          percent: 100
        }}
        onOpenUpdatesSettings={onOpen}
        onInstallUpdate={onInstall}
      />
    );

    const button = screen.getByTitle(/Обновление v2.3.5 готово/i);
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onInstall).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
