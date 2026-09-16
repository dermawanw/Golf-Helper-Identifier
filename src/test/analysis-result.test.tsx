import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AnalysisResultPage from '@/pages/AnalysisResultPage';

const mocks = vi.hoisted(() => ({
  reanalyzeVideo: vi.fn(),
}));

vi.mock('@/contexts/DataContext', () => ({
  useData: () => ({
    analysis: [],
    feedback: [],
    videos: [
      {
        id: 'video-1',
        playerId: 'player-1',
        uploadDate: '2026-09-16',
        status: 'failed',
        duration: 8,
        thumbnail: '',
        title: 'Test swing',
        analysisError: 'Pesan kegagalan uji.',
      },
    ],
    reanalyzeVideo: mocks.reanalyzeVideo,
    syncVideoAnalysis: vi.fn(),
    loading: false,
  }),
}));

describe('AnalysisResultPage', () => {
  it('menampilkan kegagalan dan menjalankan analisis ulang', () => {
    render(
      <MemoryRouter initialEntries={['/analysis/video-1']}>
        <Routes>
          <Route
            path="/analysis/:videoId"
            element={<AnalysisResultPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Pesan kegagalan uji.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Coba Lagi' }));

    expect(mocks.reanalyzeVideo).toHaveBeenCalledWith('video-1');
  });
});