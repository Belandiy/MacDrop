import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UpdatesSection } from './UpdatesSection';

describe('UpdatesSection', () => {
  it('renders up to date status and check updates button', async () => {
    const onCheck = vi.fn().mockResolvedValue(undefined);
    const onInstall = vi.fn();

    render(
      <UpdatesSection
        updateState={{ status: 'idle' }}
        onCheckForUpdates={onCheck}
        onInstallUpdate={onInstall}
        appVersion="2.2.1"
        platform="darwin"
      />
    );

    expect(screen.getByText(/У вас установлена последняя версия/i)).toBeDefined();
    const checkBtn = screen.getByText(/Проверить обновления/i);
    expect(checkBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(checkBtn);
    });
    expect(onCheck).toHaveBeenCalled();
  });

  it('renders downloading state with explicit percentage and stats', () => {
    render(
      <UpdatesSection
        updateState={{
          status: 'downloading',
          version: '2.3.5',
          percent: 62.4,
          transferred: 67000000,
          total: 109000000,
          bytesPerSecond: 4500000
        }}
        onCheckForUpdates={vi.fn()}
        onInstallUpdate={vi.fn()}
        appVersion="2.2.1"
        platform="darwin"
      />
    );

    expect(screen.getByText(/Загрузка v2.3.5.../i)).toBeDefined();
    expect(screen.getByText('62%')).toBeDefined();
    expect(screen.getAllByText(/МБ/i).length).toBeGreaterThan(0);
  });

  it('renders downloaded state with "Перезагрузить и установить" button', () => {
    const onInstall = vi.fn();

    render(
      <UpdatesSection
        updateState={{
          status: 'downloaded',
          version: '2.3.5',
          percent: 100
        }}
        onCheckForUpdates={vi.fn()}
        onInstallUpdate={onInstall}
        appVersion="2.2.1"
        platform="darwin"
      />
    );

    expect(screen.getByText(/Версия v2.3.5 готова к установке/i)).toBeDefined();
    const installBtn = screen.getByText('Перезагрузить и установить');
    expect(installBtn).toBeDefined();

    fireEvent.click(installBtn);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });
});
