import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogsSection } from './LogsSection';
import { LogEntry } from '../../vite-env';

describe('LogsSection', () => {
  const sampleLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: 1727170000000,
      level: 'info',
      tag: '[Engine]',
      message: 'Server listening on port 8384'
    },
    {
      id: '2',
      timestamp: 1727170005000,
      level: 'error',
      tag: '[Security]',
      message: 'Blocked unauthorized upload attempt',
      details: 'Stack trace details here'
    },
    {
      id: '3',
      timestamp: 1727170010000,
      level: 'warn',
      tag: '[Security]',
      message: 'Invalid auth token'
    }
  ];

  let onLogEntryCallback: ((entry: LogEntry) => void) | null = null;
  let onLogsClearedCallback: (() => void) | null = null;

  beforeEach(() => {
    onLogEntryCallback = null;
    onLogsClearedCallback = null;

    // Mock window.macdrop
    window.macdrop = {
      ...((window.macdrop || {}) as any),
      getLogs: vi.fn().mockResolvedValue([...sampleLogs]),
      clearLogs: vi.fn().mockImplementation(() => {
        onLogsClearedCallback?.();
        return Promise.resolve(true);
      }),
      openLogsFolder: vi.fn().mockResolvedValue(true),
      onLogEntry: vi.fn().mockImplementation((cb) => {
        onLogEntryCallback = cb;
        return () => {
          onLogEntryCallback = null;
        };
      }),
      onLogsCleared: vi.fn().mockImplementation((cb) => {
        onLogsClearedCallback = cb;
        return () => {
          onLogsClearedCallback = null;
        };
      })
    };

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders initial logs correctly', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Server listening on port 8384')).toBeDefined();
      expect(screen.getByText('Blocked unauthorized upload attempt')).toBeDefined();
      expect(screen.getByText('Invalid auth token')).toBeDefined();
    });
  });

  it('filters logs by level', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Server listening on port 8384')).toBeDefined();
    });

    // Click 'Ошибки' filter
    const errorBtn = screen.getByText(/Ошибки \(1\)/i);
    fireEvent.click(errorBtn);

    expect(screen.queryByText('Server listening on port 8384')).toBeNull();
    expect(screen.getByText('Blocked unauthorized upload attempt')).toBeDefined();
  });

  it('filters logs by search query', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Server listening on port 8384')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Поиск по событиям и тегам...');
    fireEvent.change(searchInput, { target: { value: 'port 8384' } });

    expect(screen.getByText('Server listening on port 8384')).toBeDefined();
    expect(screen.queryByText('Blocked unauthorized upload attempt')).toBeNull();
  });

  it('toggles log details accordion', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Blocked unauthorized upload attempt')).toBeDefined();
    });

    // Initially details should not be shown
    expect(screen.queryByText('Stack trace details here')).toBeNull();

    // Click detail expand button
    const expandBtn = screen.getByTitle('Показать детали');
    fireEvent.click(expandBtn);

    expect(screen.getByText('Stack trace details here')).toBeDefined();
  });

  it('handles clearing logs', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Server listening on port 8384')).toBeDefined();
    });

    const clearBtn = screen.getByText('Очистить');
    fireEvent.click(clearBtn);

    expect(window.macdrop.clearLogs).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/Журнал пуст/i)).toBeDefined();
    });
  });

  it('calls openLogsFolder when clicking folder button', async () => {
    render(<LogsSection />);

    await waitFor(() => {
      expect(screen.getByText('Папка')).toBeDefined();
    });

    const folderBtn = screen.getByText('Папка');
    fireEvent.click(folderBtn);

    expect(window.macdrop.openLogsFolder).toHaveBeenCalled();
  });
});
