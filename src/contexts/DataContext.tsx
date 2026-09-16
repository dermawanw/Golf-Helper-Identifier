import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  Player, Coach, SwingVideo, AnalysisResult, LeaderboardEntry, 
  Tutorial, ProgressMetric, Schedule, CoachFeedback,
  mockPlayers, mockCoaches, mockVideos, mockAnalysis, 
  mockLeaderboard, mockTutorials, mockProgress, mockSchedules, mockFeedback
} from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';
import { getApiBase, getWsUrl } from '@/lib/apiConfig';

interface DataContextType {
  players: Player[];
  coaches: Coach[];
  videos: SwingVideo[];
  analysis: AnalysisResult[];
  leaderboard: LeaderboardEntry[];
  tutorials: Tutorial[];
  progress: ProgressMetric[];
  schedules: Schedule[];
  feedback: CoachFeedback[];
  messages: any[];
  loading: boolean;
  isBackendConnected: boolean;
  refreshData: () => Promise<void>;
  syncVideoAnalysis: (videoId: string) => Promise<boolean>;
  reanalyzeVideo: (videoId: string) => Promise<boolean>;
  
  // CRUD Actions
  uploadVideo: (title: string, file: File | null, duration?: number) => Promise<{ success: boolean; videoId?: string }>;
  deleteVideo: (id: string) => Promise<boolean>;
  addFeedback: (videoId: string, feedbackText: string, rating: number) => Promise<boolean>;
  bookSchedule: (scheduleId: string) => Promise<boolean>;
  createSchedule: (date: string, time: string) => Promise<boolean>;
  addTutorial: (title: string, description: string, category: string, isPremium: boolean, duration: string, videoUrl?: string) => Promise<boolean>;
  sendMessage: (from: string, to: string, text: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | null>(null);

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
};

const BACKEND_URL = getApiBase();
const WS_URL = getWsUrl();

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // States initialized with mockData baseline
  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem('golf_players');
    return saved ? JSON.parse(saved) : mockPlayers;
  });
  const [coaches, setCoaches] = useState<Coach[]>(() => {
    const saved = localStorage.getItem('golf_coaches');
    return saved ? JSON.parse(saved) : mockCoaches;
  });
  const [videos, setVideos] = useState<SwingVideo[]>(() => {
    const saved = localStorage.getItem('golf_videos');
    return saved ? JSON.parse(saved) : mockVideos;
  });
  const [analysis, setAnalysis] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('golf_analysis');
    return saved ? JSON.parse(saved) : mockAnalysis;
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    const saved = localStorage.getItem('golf_leaderboard');
    return saved ? JSON.parse(saved) : mockLeaderboard;
  });
  const [tutorials, setTutorials] = useState<Tutorial[]>(() => {
    const saved = localStorage.getItem('golf_tutorials');
    return saved ? JSON.parse(saved) : mockTutorials;
  });
  const [progress, setProgress] = useState<ProgressMetric[]>(() => {
    const saved = localStorage.getItem('golf_progress');
    return saved ? JSON.parse(saved) : mockProgress;
  });
  const [schedules, setSchedules] = useState<Schedule[]>(() => {
    const saved = localStorage.getItem('golf_schedules');
    return saved ? JSON.parse(saved) : mockSchedules;
  });
  const [feedback, setFeedback] = useState<CoachFeedback[]>(() => {
    const saved = localStorage.getItem('golf_feedback');
    return saved ? JSON.parse(saved) : mockFeedback;
  });
  const [messages, setMessages] = useState<any[]>(() => {
    const saved = localStorage.getItem('golf_messages');
    return saved ? JSON.parse(saved) : [];
  });

  // Keep localStorage in sync (Offline safety fallback)
  useEffect(() => {
    localStorage.setItem('golf_players', JSON.stringify(players));
    localStorage.setItem('golf_coaches', JSON.stringify(coaches));
    localStorage.setItem('golf_videos', JSON.stringify(videos));
    localStorage.setItem('golf_analysis', JSON.stringify(analysis));
    localStorage.setItem('golf_leaderboard', JSON.stringify(leaderboard));
    localStorage.setItem('golf_tutorials', JSON.stringify(tutorials));
    localStorage.setItem('golf_progress', JSON.stringify(progress));
    localStorage.setItem('golf_schedules', JSON.stringify(schedules));
    localStorage.setItem('golf_feedback', JSON.stringify(feedback));
    localStorage.setItem('golf_messages', JSON.stringify(messages));
  }, [players, coaches, videos, analysis, leaderboard, tutorials, progress, schedules, feedback, messages]);

  // Load from Backend on mount & periodically
  const fetchAllData = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/data`);
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
        setCoaches(data.coaches || []);
        setVideos(data.videos || []);
        setAnalysis(data.analysis || []);
        setLeaderboard(data.leaderboard || []);
        setTutorials(data.tutorials || []);
        setProgress(data.progress || []);
        setSchedules(data.schedules || []);
        setFeedback(data.feedback || []);
        setMessages(data.messages || []);
        setIsBackendConnected(true);
      }
    } catch (e) {
      console.warn('[Backend] Offline. Falling back to local storage data.');
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const syncVideoAnalysis = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/videos/${videoId}/analysis`);
      if (!response.ok) return false;

      const data = await response.json();
      if (!data.success) return false;

      if (data.video) {
        setVideos(prev => {
          const exists = prev.some(v => v.id === videoId);
          if (exists) {
            return prev.map(v => (v.id === videoId ? data.video : v));
          }
          return [data.video, ...prev];
        });
      }

      if (data.analysis) {
        setAnalysis(prev => {
          if (prev.some(a => a.videoId === videoId)) {
            return prev.map(a => (a.videoId === videoId ? data.analysis : a));
          }
          return [data.analysis, ...prev];
        });
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }, []);

  const reanalyzeVideo = useCallback(async (videoId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/videos/${videoId}/reanalyze`, {
        method: 'POST',
      });
      if (!response.ok) return false;
      await fetchAllData();
      return true;
    } catch {
      return false;
    }
  }, [fetchAllData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Poll backend while any video is still being analyzed (WebSocket may be unavailable in production)
  useEffect(() => {
    const hasPendingAnalysis = videos.some(
      v => v.status === 'processing' || v.status === 'uploaded'
    );
    if (!hasPendingAnalysis) return;

    const interval = window.setInterval(() => {
      fetchAllData();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [videos, fetchAllData]);

  // WebSocket Live Sync
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;

    const connectWebSocket = () => {
      try {
        socket = new WebSocket(WS_URL);

        socket.onopen = () => {
          console.log('[WebSocket] Connected to backend');
          setIsBackendConnected(true);
        };

        socket.onclose = () => {
          console.log('[WebSocket] Disconnected from backend');
          // Keep isBackendConnected true — REST API may still work even if WS drops
          reconnectTimeout = window.setTimeout(connectWebSocket, 5000);
        };

        socket.onerror = (error) => {
          console.warn('[WebSocket] Error occurred:', error);
          socket?.close();
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const { type, payload } = msg;
            console.log(`[WebSocket] Message received: ${type}`, payload);

            switch (type) {
              case 'USER_REGISTERED':
                if (payload.players) setPlayers(payload.players);
                if (payload.coaches) setCoaches(payload.coaches);
                break;

              case 'VIDEO_UPLOADED':
                setVideos(prev => {
                  if (prev.some(v => v.id === payload.video.id)) return prev;
                  return [payload.video, ...prev];
                });
                if (payload.players) setPlayers(payload.players);
                break;

              case 'VIDEO_UPDATE':
                setVideos(prev =>
                  prev.map(video =>
                    video.id === payload.videoId
                      ? {
                          ...video,
                          status: payload.status,
                          analysisError: payload.analysisError
                        }
                      : video
                  )
                );

                if (payload.status === 'processing') {
                  toast({
                    title: 'Analyzing Swing',
                    description: 'Your swing video is currently being processed by our AI Engine...',
                  });
                }

                if (payload.status === 'failed') {
                  toast({
                    title: 'Analisis gagal',
                    description:
                      payload.analysisError ||
                      'Analisis tidak dapat diselesaikan. Silakan coba lagi.',
                    variant: 'destructive',
                  });
                }

                
                if (payload.status === 'analyzed' && payload.analysis) {
                  // Add analysis report
                  setAnalysis(prev => {
                    if (prev.some(a => a.id === payload.analysis.id)) return prev;
                    return [payload.analysis, ...prev];
                  });
                  // Update leaderboard & player stats
                  if (payload.leaderboard) setLeaderboard(payload.leaderboard);
                  if (payload.players) setPlayers(payload.players);
                  
                  toast({
                    title: 'AI Analysis Ready!',
                    description: `Swing analysis completed. Score: ${payload.analysis.swingScore}/100!`,
                  });
                }
                break;

              case 'VIDEO_DELETED':
                setVideos(prev => prev.filter(v => v.id !== payload.videoId));
                setAnalysis(prev => prev.filter(a => a.videoId !== payload.videoId));
                setFeedback(prev => prev.filter(f => f.videoId !== payload.videoId));
                if (payload.leaderboard) setLeaderboard(payload.leaderboard);
                if (payload.players) setPlayers(payload.players);
                toast({
                  title: 'Video Deleted',
                  description: 'The swing video and all associated reports were successfully deleted.',
                });
                break;

              case 'FEEDBACK_ADDED':
                setFeedback(prev => {
                  if (prev.some(f => f.id === payload.feedback.id)) return prev;
                  return [payload.feedback, ...prev];
                });
                toast({
                  title: 'New Coach Feedback!',
                  description: `${payload.feedback.coachName} added a review for your swing.`,
                });
                break;

              case 'SCHEDULE_UPDATED':
                if (payload.schedules) setSchedules(payload.schedules);
                break;

              case 'TUTORIAL_ADDED':
                if (payload.tutorials) setTutorials(payload.tutorials);
                break;

              case 'CHAT_UPDATE':
                setMessages(prev => [...prev, payload]);
                break;

              default:
                break;
            }
          } catch (e) {
            console.error('[WebSocket] Failed parsing message data:', e);
          }
        };

      } catch (err) {
        console.error('[WebSocket] Connection attempt failed:', err);
      }
    };

    connectWebSocket();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [toast]);

  // CRUD Actions
  const uploadVideo = async (title: string, file: File | null, duration: number = 8): Promise<{ success: boolean; videoId?: string }> => {
    if (!user) return { success: false };
    
    // Always try backend first — don't rely on WebSocket connection state
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('duration', String(duration));
      formData.append('playerId', user.id);
      if (file) {
        formData.append('video', file);
      }

      const token = localStorage.getItem('golf_token');
      const headers: Record<string, string> = {
        'X-Player-Id': user.id,
        'X-Video-Title': encodeURIComponent(title)
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/videos`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload.video) {
          setVideos(prev => {
            if (prev.some(v => v.id === payload.video.id)) {
              return prev.map(v => (v.id === payload.video.id ? payload.video : v));
            }
            return [payload.video, ...prev];
          });
        }
        setIsBackendConnected(true);
        await fetchAllData();
        return { success: true, videoId: payload.video?.id };
      }
    } catch (e) {
      console.error('Failed uploading video to backend:', e);
    }

    return { success: false };
  };

  const deleteVideo = async (id: string): Promise<boolean> => {
    if (isBackendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/videos/${id}`, {
          method: 'DELETE',
        });
        return response.ok;
      } catch (e) {
        console.error('Failed deleting video from backend:', e);
      }
    }

    // Offline Fallback flow
    setVideos(prev => prev.filter(v => v.id !== id));
    setAnalysis(prev => prev.filter(a => a.videoId !== id));
    setFeedback(prev => prev.filter(f => f.videoId !== id));

    toast({
      title: 'Video Deleted (Offline)',
      description: 'The swing video and all reports were removed.',
    });
    return true;
  };

  const addFeedback = async (videoId: string, feedbackText: string, rating: number): Promise<boolean> => {
    if (!user) return false;
    
    if (isBackendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, coachId: user.id, coachName: user.name, feedbackText, rating }),
        });
        return response.ok;
      } catch (e) {
        console.error('Failed leaving feedback:', e);
      }
    }

    // Offline Fallback flow
    const newFeedback: CoachFeedback = {
      id: `f_${Date.now()}`,
      videoId,
      coachId: user.id,
      coachName: user.name,
      feedback: feedbackText,
      rating,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setFeedback(prev => [newFeedback, ...prev]);
    toast({
      title: 'Feedback Submitted (Offline)',
      description: 'Your feedback was successfully posted.',
    });
    return true;
  };

  const bookSchedule = async (scheduleId: string): Promise<boolean> => {
    if (!user) return false;

    if (isBackendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/schedule/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleId, playerId: user.id, playerName: user.name }),
        });
        return response.ok;
      } catch (e) {
        console.error('Failed booking slot:', e);
      }
    }

    // Offline Fallback flow
    setSchedules(prev => prev.map(s => 
      s.id === scheduleId ? { ...s, type: 'booked', playerId: user.id, playerName: user.name } : s
    ));
    toast({
      title: 'Session Booked!',
      description: 'Your golf training slot has been confirmed.',
    });
    return true;
  };

  const createSchedule = async (date: string, time: string): Promise<boolean> => {
    if (!user) return false;

    if (isBackendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/schedule/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId: user.id, date, time }),
        });
        return response.ok;
      } catch (e) {
        console.error('Failed creating schedule slot:', e);
      }
    }

    // Offline Fallback flow
    const newSlot: Schedule = {
      id: `s_${Date.now()}`,
      coachId: user.id,
      date,
      time,
      type: 'available'
    };

    setSchedules(prev => [newSlot, ...prev]);
    toast({
      title: 'Slot Created (Offline)',
      description: 'A new availability slot has been added.',
    });
    return true;
  };

  const addTutorial = async (
    title: string, description: string, category: string, isPremium: boolean, duration: string, videoUrl?: string
  ): Promise<boolean> => {
    if (!user) return false;

    if (isBackendConnected) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/tutorials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            title, description, coachId: user.id, coachName: user.name, category, isPremium, duration, videoUrl 
          }),
        });
        return response.ok;
      } catch (e) {
        console.error('Failed adding tutorial:', e);
      }
    }

    // Offline Fallback flow
    const newTutorial: Tutorial = {
      id: `t_${Date.now()}`,
      title,
      description,
      coachId: user.id,
      coachName: user.name,
      category,
      isPremium,
      duration,
      thumbnail: '',
      createdAt: new Date().toISOString().split('T')[0],
      videoUrl: videoUrl || 'https://www.youtube.com/watch?v=0h5oVfF3Krs'
    };

    setTutorials(prev => [newTutorial, ...prev]);
    toast({
      title: 'Tutorial Created (Offline)',
      description: 'Your new instructional lesson has been created.',
    });
    return true;
  };

  const sendMessage = async (from: string, to: string, text: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, text })
      });
      return res.ok;
    } catch {
      // Offline fallback
      const newMessage = {
        id: `msg_${Date.now()}`,
        from, to, text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      return true;
    }
  };

  // Dynamically calculate player metrics to avoid dummy values
  const dynamicPlayers = React.useMemo(() => {
    return players.map(p => {
      const playerVids = videos.filter(v => v.playerId === p.id);
      const playerAnalyses = analysis.filter(a => playerVids.some(v => v.id === a.videoId));
      
      const totalVideos = playerVids.length;
      const avgScore = playerAnalyses.length > 0
        ? Math.round(playerAnalyses.reduce((sum, item) => sum + item.swingScore, 0) / playerAnalyses.length)
        : 0;
        
      return {
        ...p,
        totalVideos,
        avgScore
      };
    });
  }, [players, videos, analysis]);

  // Dynamically calculate leaderboard based exclusively on active analysis records
  const dynamicLeaderboard = React.useMemo(() => {
    return dynamicPlayers
      .filter(p => p.avgScore > 0 && !['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(p.id))
      .sort((a, b) => b.avgScore - a.avgScore)
      .map((p, index) => ({
        rank: index + 1,
        playerId: p.id,
        playerName: p.name,
        avgScore: p.avgScore,
        totalSwings: p.totalVideos,
        handicap: p.handicap || 18,
        trend: 'stable' as const
      }));
  }, [dynamicPlayers]);

  return (
    <DataContext.Provider value={{
      players: dynamicPlayers, 
      coaches, 
      videos, 
      analysis, 
      leaderboard: dynamicLeaderboard, 
      tutorials, 
      progress, 
      schedules, 
      feedback,
      messages,
      loading, 
      isBackendConnected,
      refreshData: fetchAllData,
      syncVideoAnalysis,
      reanalyzeVideo,
      uploadVideo, 
      deleteVideo, 
      addFeedback, 
      bookSchedule, 
      createSchedule, 
      addTutorial,
      sendMessage
    }}>
      {children}
    </DataContext.Provider>
  );
};
