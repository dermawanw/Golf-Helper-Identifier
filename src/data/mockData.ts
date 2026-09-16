// ==========================================
// MOCK DATA LAYER - Simulates database
// ==========================================

export type UserRole = 'player' | 'coach' | 'admin';
export type SubscriptionStatus = 'free' | 'premium' | 'expired';
export type VideoStatus = 'uploaded' | 'processing' | 'analyzed' | 'failed';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type SwingPhase = 'address' | 'backswing' | 'downswing' | 'impact' | 'follow-through';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
}

export interface Player extends User {
  role: 'player';
  handicap: number;
  totalVideos: number;
  avgScore: number;
}

export interface Coach extends User {
  role: 'coach';
  certification: string;
  rating: number;
  specialty: string;
  assignedPlayers: string[];
}

export interface SwingVideo {
  id: string;
  playerId: string;
  uploadDate: string;
  status: VideoStatus;
  duration: number;
  thumbnail: string;
  title: string;
  videoUrl?: string;
  analysisError?: string;
}

export interface AnalysisResult {
  id: string;
  videoId: string;
  swingScore: number;
  swingPhases: { phase: SwingPhase; score: number; feedback: string }[];
  recommendation: string[];
  injuryRiskScore: number;
  injuryRiskAreas: string[];
  keypointsDetected: number;
  createdAt: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  coachId: string;
  coachName: string;
  category: string;
  isPremium: boolean;
  duration: string;
  thumbnail: string;
  createdAt: string;
  videoUrl?: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  avgScore: number;
  totalSwings: number;
  handicap: number;
  trend: 'up' | 'down' | 'stable';
}

export interface Subscription {
  id: string;
  userId: string;
  type: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  paymentStatus: PaymentStatus;
  amount: number;
}

export interface CoachFeedback {
  id: string;
  videoId: string;
  coachId: string;
  coachName: string;
  feedback: string;
  rating: number;
  createdAt: string;
}

export interface ProgressMetric {
  week: string;
  avgScore: number;
  swingsAnalyzed: number;
  injuryRisk: number;
  improvement: number;
}

export interface Schedule {
  id: string;
  coachId: string;
  date: string;
  time: string;
  playerId?: string;
  playerName?: string;
  type: 'available' | 'booked';
}

// ---- MOCK DATA ----

export const mockPlayers: Player[] = [
  { id: 'p1', name: 'Jordan Mitchell', email: 'jordan@golf.com', role: 'player', subscriptionStatus: 'premium', handicap: 12, totalVideos: 24, avgScore: 78, createdAt: '2024-01-15' },
  { id: 'p2', name: 'Sarah Chen', email: 'sarah@golf.com', role: 'player', subscriptionStatus: 'premium', handicap: 8, totalVideos: 42, avgScore: 85, createdAt: '2023-11-20' },
  { id: 'p3', name: 'Marcus Rodriguez', email: 'marcus@golf.com', role: 'player', subscriptionStatus: 'free', handicap: 18, totalVideos: 10, avgScore: 65, createdAt: '2024-03-01' },
  { id: 'p4', name: 'Emily Park', email: 'emily@golf.com', role: 'player', subscriptionStatus: 'premium', handicap: 5, totalVideos: 56, avgScore: 91, createdAt: '2023-08-10' },
  { id: 'p5', name: 'David Kim', email: 'david@golf.com', role: 'player', subscriptionStatus: 'free', handicap: 22, totalVideos: 6, avgScore: 58, createdAt: '2024-05-15' },
  { id: 'p6', name: 'Lisa Thompson', email: 'lisa@golf.com', role: 'player', subscriptionStatus: 'premium', handicap: 10, totalVideos: 30, avgScore: 82, createdAt: '2024-02-01' },
  { id: 'p7', name: 'Alex Rivera', email: 'alex@golf.com', role: 'player', subscriptionStatus: 'free', handicap: 15, totalVideos: 14, avgScore: 72, createdAt: '2024-04-12' },
  { id: 'p8', name: 'Nicole Wang', email: 'nicole@golf.com', role: 'player', subscriptionStatus: 'expired', handicap: 20, totalVideos: 8, avgScore: 62, createdAt: '2024-01-30' },
];

export const mockCoaches: Coach[] = [
  { id: 'c1', name: 'James Harrison', email: 'james@golf.com', role: 'coach', subscriptionStatus: 'premium', certification: 'PGA Class A', rating: 4.9, specialty: 'Swing Mechanics', assignedPlayers: ['p1', 'p2', 'p4'], createdAt: '2023-06-01' },
  { id: 'c2', name: 'Maria Santos', email: 'maria@golf.com', role: 'coach', subscriptionStatus: 'premium', certification: 'LPGA Certified', rating: 4.7, specialty: 'Short Game', assignedPlayers: ['p3', 'p6'], createdAt: '2023-09-15' },
  { id: 'c3', name: 'Robert Chang', email: 'robert@golf.com', role: 'coach', subscriptionStatus: 'premium', certification: 'TPI Certified', rating: 4.8, specialty: 'Fitness & Biomechanics', assignedPlayers: ['p5', 'p7', 'p8'], createdAt: '2023-04-20' },
];

export const mockAdmin: User = {
  id: 'a1', name: 'Admin User', email: 'admin@golfai.com', role: 'admin', subscriptionStatus: 'premium', createdAt: '2023-01-01',
};

export const mockVideos: SwingVideo[] = [
  { id: 'v1', playerId: 'p1', uploadDate: '2024-06-01', status: 'analyzed', duration: 8, thumbnail: '', title: 'Driver Swing - Practice' },
  { id: 'v2', playerId: 'p1', uploadDate: '2024-06-05', status: 'analyzed', duration: 6, thumbnail: '', title: '7 Iron Approach' },
  { id: 'v3', playerId: 'p1', uploadDate: '2024-06-10', status: 'processing', duration: 10, thumbnail: '', title: 'Pitching Wedge' },
  { id: 'v4', playerId: 'p2', uploadDate: '2024-06-02', status: 'analyzed', duration: 7, thumbnail: '', title: 'Tournament Drive' },
  { id: 'v5', playerId: 'p4', uploadDate: '2024-06-08', status: 'analyzed', duration: 5, thumbnail: '', title: 'Putting Practice' },
];

export const mockAnalysis: AnalysisResult[] = [
  {
    id: 'a1', videoId: 'v1', swingScore: 82, createdAt: '2024-06-01',
    swingPhases: [
      { phase: 'address', score: 88, feedback: 'Good stance alignment. Slightly narrow base.' },
      { phase: 'backswing', score: 79, feedback: 'Club goes slightly past parallel. Maintain wrist angle.' },
      { phase: 'downswing', score: 85, feedback: 'Good hip rotation initiation. Maintain lag longer.' },
      { phase: 'impact', score: 78, feedback: 'Slight open clubface at impact. Work on square contact.' },
      { phase: 'follow-through', score: 80, feedback: 'Good extension. Complete the rotation fully.' },
    ],
    recommendation: [
      'Focus on maintaining wrist hinge through the downswing',
      'Practice alignment drills with alignment sticks',
      'Strengthen core rotation with medicine ball exercises',
      'Work on tempo with a metronome at 72 BPM',
    ],
    injuryRiskScore: 25, injuryRiskAreas: ['Lower back', 'Left wrist'], keypointsDetected: 33,
  },
  {
    id: 'a2', videoId: 'v2', swingScore: 76, createdAt: '2024-06-05',
    swingPhases: [
      { phase: 'address', score: 82, feedback: 'Good posture. Adjust ball position slightly forward.' },
      { phase: 'backswing', score: 74, feedback: 'Over-rotation in the backswing. Keep it compact.' },
      { phase: 'downswing', score: 78, feedback: 'Casting motion detected. Maintain lag.' },
      { phase: 'impact', score: 72, feedback: 'Hitting slightly fat. Adjust low point.' },
      { phase: 'follow-through', score: 70, feedback: 'Incomplete follow through. Commit to the shot.' },
    ],
    recommendation: [
      'Shorten backswing to improve consistency',
      'Practice half-swings to build proper lag',
      'Use impact tape to check contact point',
    ],
    injuryRiskScore: 35, injuryRiskAreas: ['Lower back', 'Right elbow'], keypointsDetected: 33,
  },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, playerId: 'p4', playerName: 'Emily Park', avgScore: 91, totalSwings: 56, handicap: 5, trend: 'up' },
  { rank: 2, playerId: 'p2', playerName: 'Sarah Chen', avgScore: 85, totalSwings: 42, handicap: 8, trend: 'stable' },
  { rank: 3, playerId: 'p6', playerName: 'Lisa Thompson', avgScore: 82, totalSwings: 30, handicap: 10, trend: 'up' },
  { rank: 4, playerId: 'p1', playerName: 'Jordan Mitchell', avgScore: 78, totalSwings: 24, handicap: 12, trend: 'up' },
  { rank: 5, playerId: 'p7', playerName: 'Alex Rivera', avgScore: 72, totalSwings: 14, handicap: 15, trend: 'down' },
  { rank: 6, playerId: 'p3', playerName: 'Marcus Rodriguez', avgScore: 65, totalSwings: 10, handicap: 18, trend: 'stable' },
  { rank: 7, playerId: 'p8', playerName: 'Nicole Wang', avgScore: 62, totalSwings: 8, handicap: 20, trend: 'down' },
  { rank: 8, playerId: 'p5', playerName: 'David Kim', avgScore: 58, totalSwings: 6, handicap: 22, trend: 'up' },
];

export const mockTutorials: Tutorial[] = [
  { id: 't1', title: 'Mastering the Driver', description: 'Learn to hit longer, straighter drives with proper setup and mechanics.', coachId: 'c1', coachName: 'James Harrison', category: 'Full Swing', isPremium: false, duration: '12 min', thumbnail: '', createdAt: '2024-05-01', videoUrl: 'https://www.youtube.com/watch?v=0h5oVfF3Krs' },
  { id: 't2', title: 'Short Game Secrets', description: 'Improve your chipping and pitching to save strokes around the green.', coachId: 'c2', coachName: 'Maria Santos', category: 'Short Game', isPremium: true, duration: '18 min', thumbnail: '', createdAt: '2024-05-10', videoUrl: 'https://www.youtube.com/watch?v=4C9B3Zf0a20' },
  { id: 't3', title: 'Putting Fundamentals', description: 'Master the basics of putting alignment, speed control, and green reading.', coachId: 'c2', coachName: 'Maria Santos', category: 'Putting', isPremium: false, duration: '10 min', thumbnail: '', createdAt: '2024-05-15', videoUrl: 'https://www.youtube.com/watch?v=kYJzXvQc1Cg' },
  { id: 't4', title: 'Flexibility for Golfers', description: 'Essential stretches and exercises to improve mobility and prevent injury.', coachId: 'c3', coachName: 'Robert Chang', category: 'Fitness', isPremium: true, duration: '22 min', thumbnail: '', createdAt: '2024-05-20', videoUrl: 'https://www.youtube.com/watch?v=N8qTjL460t8' },
  { id: 't5', title: 'Iron Play Mastery', description: 'Consistent iron shots with proper ball striking and distance control.', coachId: 'c1', coachName: 'James Harrison', category: 'Full Swing', isPremium: false, duration: '15 min', thumbnail: '', createdAt: '2024-06-01', videoUrl: 'https://www.youtube.com/watch?v=842TfR2Pjhs' },
  { id: 't6', title: 'Mental Game Strategy', description: 'Course management, pre-shot routines, and mental toughness techniques.', coachId: 'c1', coachName: 'James Harrison', category: 'Mental Game', isPremium: true, duration: '20 min', thumbnail: '', createdAt: '2024-06-05', videoUrl: 'https://www.youtube.com/watch?v=680D1lK20qQ' },
];

export const mockProgress: ProgressMetric[] = [
  { week: 'Week 1', avgScore: 68, swingsAnalyzed: 3, injuryRisk: 40, improvement: 0 },
  { week: 'Week 2', avgScore: 71, swingsAnalyzed: 4, injuryRisk: 38, improvement: 4.4 },
  { week: 'Week 3', avgScore: 70, swingsAnalyzed: 3, injuryRisk: 35, improvement: -1.4 },
  { week: 'Week 4', avgScore: 74, swingsAnalyzed: 5, injuryRisk: 32, improvement: 5.7 },
  { week: 'Week 5', avgScore: 76, swingsAnalyzed: 4, injuryRisk: 30, improvement: 2.7 },
  { week: 'Week 6', avgScore: 78, swingsAnalyzed: 3, injuryRisk: 28, improvement: 2.6 },
  { week: 'Week 7', avgScore: 80, swingsAnalyzed: 4, injuryRisk: 25, improvement: 2.6 },
  { week: 'Week 8', avgScore: 82, swingsAnalyzed: 3, injuryRisk: 25, improvement: 2.5 },
];

export const mockSchedules: Schedule[] = [
  { id: 's1', coachId: 'c1', date: '2024-06-15', time: '09:00', playerId: 'p1', playerName: 'Jordan Mitchell', type: 'booked' },
  { id: 's2', coachId: 'c1', date: '2024-06-15', time: '10:30', type: 'available' },
  { id: 's3', coachId: 'c1', date: '2024-06-15', time: '14:00', playerId: 'p2', playerName: 'Sarah Chen', type: 'booked' },
  { id: 's4', coachId: 'c2', date: '2024-06-16', time: '11:00', type: 'available' },
  { id: 's5', coachId: 'c2', date: '2024-06-16', time: '13:00', playerId: 'p3', playerName: 'Marcus Rodriguez', type: 'booked' },
];

export const mockFeedback: CoachFeedback[] = [
  { id: 'f1', videoId: 'v1', coachId: 'c1', coachName: 'James Harrison', feedback: 'Great improvement on your hip rotation. Focus on keeping your left arm straight through the backswing. I recommend practicing with alignment sticks.', rating: 4, createdAt: '2024-06-02' },
  { id: 'f2', videoId: 'v2', coachId: 'c1', coachName: 'James Harrison', feedback: 'The casting motion is still present. Try the towel drill to improve your lag. Your tempo is getting better though.', rating: 3, createdAt: '2024-06-06' },
];
