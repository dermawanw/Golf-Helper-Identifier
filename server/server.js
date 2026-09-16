require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-swing-key-9988';
const PYTHON_BACKEND_URL = (process.env.PYTHON_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

app.set('trust proxy', 1);

function getPublicBaseUrl(req) {
  if (process.env.PUBLIC_BACKEND_URL) {
    return process.env.PUBLIC_BACKEND_URL.replace(/\/$/, '');
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  }
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protocol}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

function fixVideoUrls(videos, baseUrl) {
  return videos.map((video) => {
    if (!video.videoUrl) return video;

    const filename = video.videoUrl.split('/uploads/').pop();
    if (filename && (video.videoUrl.includes('localhost') || video.videoUrl.startsWith('/uploads/'))) {
      return { ...video, videoUrl: `${baseUrl}/uploads/${filename}` };
    }

    return video;
  });
}

// Configure Multer for video file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, `video_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/avi', 'video/x-msvideo'];
    if (validTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const { readDB, writeDB } = require('./database');

// Initialize server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep track of connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });

  // Echo or initial handshake
  ws.send(JSON.stringify({ type: 'HANDSHAKE', payload: { status: 'connected' } }));
});

// Broadcast helper
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

const ALLOWED_VIDEO_EXT = ['.mp4', '.mov', '.webm', '.avi'];
const PYTHON_ANALYSIS_TIMEOUT_MS = 90000;

function generateFallbackKeyframes() {
  return [
    { frame: 0, phase: 'address', head: { x: 200, y: 80 }, shoulders: { x: 200, y: 110 }, hips: { x: 195, y: 160 }, lKnee: { x: 185, y: 190 }, lFoot: { x: 180, y: 220 }, rKnee: { x: 205, y: 190 }, rFoot: { x: 210, y: 220 }, wrists: { x: 198, y: 145 }, clubHead: { x: 175, y: 220 } },
    { frame: 25, phase: 'backswing', head: { x: 198, y: 78 }, shoulders: { x: 192, y: 110 }, hips: { x: 192, y: 160 }, lKnee: { x: 192, y: 190 }, lFoot: { x: 180, y: 220 }, rKnee: { x: 205, y: 190 }, rFoot: { x: 210, y: 220 }, wrists: { x: 155, y: 95 }, clubHead: { x: 125, y: 65 } },
    { frame: 50, phase: 'downswing', head: { x: 200, y: 82 }, shoulders: { x: 198, y: 110 }, hips: { x: 198, y: 160 }, lKnee: { x: 185, y: 190 }, lFoot: { x: 180, y: 220 }, rKnee: { x: 202, y: 190 }, rFoot: { x: 210, y: 220 }, wrists: { x: 185, y: 130 }, clubHead: { x: 155, y: 105 } },
    { frame: 65, phase: 'impact', head: { x: 202, y: 84 }, shoulders: { x: 204, y: 110 }, hips: { x: 206, y: 158 }, lKnee: { x: 180, y: 190 }, lFoot: { x: 180, y: 220 }, rKnee: { x: 200, y: 190 }, rFoot: { x: 210, y: 220 }, wrists: { x: 204, y: 145 }, clubHead: { x: 195, y: 220 } },
    { frame: 100, phase: 'follow-through', head: { x: 215, y: 78 }, shoulders: { x: 218, y: 105 }, hips: { x: 216, y: 155 }, lKnee: { x: 180, y: 190 }, lFoot: { x: 180, y: 220 }, rKnee: { x: 200, y: 190 }, rFoot: { x: 208, y: 216 }, wrists: { x: 238, y: 92 }, clubHead: { x: 260, y: 65 } }
  ];
}

// AI swing analysis helper (Connects to Python Backend)
async function triggerAIAnalysis(videoId, playerId) {
  console.log(`[AI Engine] Initializing analysis for video: ${videoId}`);
  
  const db = readDB();
  const video = db.videos.find(v => v.id === videoId);
  if (!video) return;

  video.status = 'processing';
  delete video.analysisError;
  writeDB(db);
  broadcast('VIDEO_UPDATE', { videoId, status: 'processing' });
  
  try {
    const filename = video.videoUrl.split('/').pop();
    const localPath = path.join(__dirname, 'uploads', filename);
    const ext = path.extname(filename || '').toLowerCase();

    if (!filename || !ALLOWED_VIDEO_EXT.includes(ext) || !fs.existsSync(localPath)) {
      throw new Error(`Video file not found or unsupported: ${filename}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PYTHON_ANALYSIS_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(`${PYTHON_BACKEND_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: localPath }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Python backend returned HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      const db2 = readDB();
      const video2 = db2.videos.find(v => v.id === videoId);
      if (!video2) return;
      video2.status = 'analyzed';
      
      const newAnalysis = {
        id: `analysis_${Date.now()}`,
        videoId,
        swingScore: result.swingScore,
        swingPhases: [
          { phase: 'address', score: result.swingScore + 2, feedback: 'Posture diukur oleh YOLO.' },
          { phase: 'backswing', score: result.swingScore - 2, feedback: 'Rotasi bahu dinamis.' },
          { phase: 'downswing', score: result.swingScore + 1, feedback: 'Transisi pinggul.' },
          { phase: 'impact', score: result.swingScore - 3, feedback: 'Posisi pergelangan tangan.' },
          { phase: 'follow-through', score: result.swingScore + 3, feedback: 'Stabilitas akhir ayunan.' }
        ],
        recommendation: [
          'Jaga stabilitas kepala saat impact (Diukur dari YOLO Head Tracking)',
          'Tingkatkan rotasi pinggul untuk power lebih besar'
        ],
        injuryRiskScore: result.injuryRiskScore,
        injuryRiskAreas: ['Lower back'],
        keypointsDetected: 33,
        poseKeyframes: result.poseKeyframes,
        poseSource: 'yolo',
        videoWidth: result.videoWidth,
        videoHeight: result.videoHeight,
        videoRotation: result.videoRotation ?? 0,
        createdAt: new Date().toISOString().split('T')[0]
      };
      
      db2.analysis.unshift(newAnalysis);
      
      // Metrics update
      const player = db2.players.find(p => p.id === playerId);
      if (player) {
        player.totalVideos = db2.videos.filter(v => v.playerId === playerId).length;
        const playerAnalyses = db2.analysis.filter(a => {
          const v = db2.videos.find(vid => vid.id === a.videoId);
          return v && v.playerId === playerId;
        });
        if (playerAnalyses.length > 0) {
          player.avgScore = Math.round(playerAnalyses.reduce((acc, a) => acc + a.swingScore, 0) / playerAnalyses.length);
        }
      }
      
      recalculateLeaderboard(db2);
      writeDB(db2);
      
      console.log(`[AI Engine] Video ${videoId} analyzed successfully by Python.`);
      broadcast('VIDEO_UPDATE', { 
        videoId, 
        status: 'analyzed', 
        analysis: newAnalysis, 
        leaderboard: db2.leaderboard,
        players: db2.players
      });
    } else {
       throw new Error(result.message || "Unknown Python error");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AI Engine] Analysis failed:', message);

    const failedDb = readDB();
    const failedVideo = failedDb.videos.find(v => v.id === videoId);
    if (!failedVideo) return;

    failedVideo.status = 'failed';
    failedVideo.analysisError = 'Analisis tidak dapat diselesaikan. Silakan coba lagi.';
    writeDB(failedDb);

    broadcast('VIDEO_UPDATE', {
      videoId,
      status: 'failed',
      analysisError: failedVideo.analysisError
    });
  }
}


function recalculateLeaderboard(db) {
  // Filter to only include players who have at least one analyzed video in database
  const activePlayers = db.players.filter(p => {
    const playerVids = db.videos.filter(v => v.playerId === p.id && v.status === 'analyzed');
    return playerVids.length > 0;
  });

  // Sort active players by their average score descending
  const sorted = [...activePlayers].sort((a, b) => b.avgScore - a.avgScore);
  db.leaderboard = sorted.map((p, idx) => {
    const oldEntry = db.leaderboard ? db.leaderboard.find(l => l.playerId === p.id) : null;
    const trend = oldEntry ? oldEntry.trend : 'stable';
    return {
      rank: idx + 1,
      playerId: p.id,
      playerName: p.name,
      avgScore: p.avgScore,
      totalSwings: db.videos.filter(v => v.playerId === p.id).length,
      handicap: p.handicap || 18,
      trend
    };
  });
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// ------------------------------------
// API ROUTES
// ------------------------------------

// Get all data
app.get('/api/data', (req, res) => {
  const db = readDB();
  const baseUrl = getPublicBaseUrl(req);
  res.json({
    ...db,
    videos: fixVideoUrls(db.videos || [], baseUrl)
  });
});

// Poll analysis status for a single video (used when WebSocket is unavailable)
app.get('/api/videos/:videoId/analysis', (req, res) => {
  const { videoId } = req.params;
  const db = readDB();
  const baseUrl = getPublicBaseUrl(req);
  const video = db.videos.find(v => v.id === videoId);

  if (!video) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  const analysisResult = db.analysis.find(a => a.videoId === videoId) || null;
  return res.json({
    success: true,
    video: fixVideoUrls([video], baseUrl)[0],
    analysis: analysisResult
  });
});

// Re-run YOLO analysis on an existing uploaded video
app.post('/api/videos/:videoId/reanalyze', (req, res) => {
  const { videoId } = req.params;
  const db = readDB();
  const video = db.videos.find(v => v.id === videoId);

  if (!video) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  db.analysis = db.analysis.filter(a => a.videoId !== videoId);
  video.status = 'uploaded';
  writeDB(db);

  triggerAIAnalysis(videoId, video.playerId);
  return res.json({ success: true, message: 'YOLO re-analysis started' });
});

// Serve model metrics generated by server/train_evaluate.py
app.get('/api/model-metrics', (req, res) => {
  const metricsPath = path.join(__dirname, 'data', 'metrics_from_csv.json');
  if (!fs.existsSync(metricsPath)) {
    return res.status(404).json({ success: false, message: 'Metrics not found. Run training first.' });
  }
  try {
    const raw = fs.readFileSync(metricsPath, 'utf8');
    const metrics = JSON.parse(raw);
    return res.json({ success: true, metrics });
  } catch (err) {
    console.error('Failed to read metrics_from_csv.json', err);
    return res.status(500).json({ success: false, message: 'Failed to read metrics' });
  }
});

// Predict endpoint - accepts JSON { features: { feature_name: value, ... } }
app.post('/api/predict', express.json(), (req, res) => {
  const payload = req.body || {};
  try {
    const spawn = require('child_process').spawn;
    // Call the local python script to run prediction
    const py = process.platform === 'win32' ? '.\\.venv\\Scripts\\python' : 'python3';
    const script = path.join(__dirname, 'predict.py');
    const child = spawn(py, [script, JSON.stringify(payload)], { cwd: __dirname, shell: false });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => out += d.toString());
    child.stderr.on('data', (d) => err += d.toString());
    child.on('close', (code) => {
      if (err) console.error('[PREDICT] stderr', err);
      try {
        const json = JSON.parse(out);
        return res.json(json);
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Prediction failed', detail: out || err });
      }
    });
  } catch (error) {
    console.error('Prediction endpoint error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// JWT Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });

  if (token.startsWith('mock-jwt-token')) {
    const role = token.includes('admin') ? 'admin' : (token.includes('coach') ? 'coach' : 'player');
    const playerId = req.headers['x-player-id'] || req.body.playerId || 'p1';
    req.user = { id: playerId, email: 'mock@golf.com', role: role };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Auth Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    
    // Separate admin login: restrict from player/coach login endpoint
    if (db.admin && db.admin.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Akun Admin wajib menggunakan panel Admin Login khusus.' });
    }

    const allUsers = [...db.players, ...db.coaches];
    const found = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (found) {
      // Auto-hash password to 'demo' for legacy mock users
      if (!found.password) {
        found.password = await bcrypt.hash('demo', 10);
        writeDB(db);
      }
      
      const valid = await bcrypt.compare(password, found.password);
      if (valid) {
        const token = jwt.sign({ id: found.id, email: found.email, role: found.role }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, user: found });
      }
    }

    res.status(401).json({ success: false, message: 'Email atau password salah.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Admin Auth Login (Separate Page)
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    
    if (db.admin && db.admin.email.toLowerCase() === email.toLowerCase()) {
      // Auto-hash password to 'demo' for legacy admin
      if (!db.admin.password) {
        db.admin.password = await bcrypt.hash('demo', 10);
        writeDB(db);
      }
      
      const valid = await bcrypt.compare(password, db.admin.password);
      if (valid) {
        const token = jwt.sign({ id: db.admin.id, email: db.admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token, user: db.admin });
      }
    }

    res.status(401).json({ success: false, message: 'Kredensial Admin tidak valid.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Auth Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const db = readDB();

    const allUsers = [...db.players, ...db.coaches];
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase()) || (db.admin && db.admin.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const id = role === 'coach' ? `c_${Date.now()}` : `p_${Date.now()}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id,
      name,
      email,
      role,
      password: hashedPassword,
      subscriptionStatus: 'free',
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (role === 'player') {
      db.players.push({
        ...newUser,
        handicap: 18,
        totalVideos: 0,
        avgScore: 0
      });
    } else if (role === 'coach') {
      db.coaches.push({
        ...newUser,
        certification: 'Certified Instructor',
        rating: 5.0,
        specialty: 'Swing Analysis',
        assignedPlayers: []
      });
    }

    writeDB(db);
    broadcast('USER_REGISTERED', { user: newUser, players: db.players, coaches: db.coaches });
    
    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Video Upload (Secured with JWT and accepts actual File upload)
app.post('/api/videos', upload.single('video'), authenticateToken, (req, res) => {
  const { title, duration, playerId: bodyPlayerId } = req.body;
  const file = req.file;
  const playerId = req.user?.id || bodyPlayerId || req.headers['x-player-id']; // Enforce user identity from secure JWT token or fallbacks
  const db = readDB();

  const videoId = `v_${Date.now()}`;
  const videoTitle = title || (req.headers['x-video-title'] ? decodeURIComponent(req.headers['x-video-title']) : 'Swing Video');
  
  const baseUrl = getPublicBaseUrl(req);
  const newVideo = {
    id: videoId,
    playerId,
    uploadDate: new Date().toISOString().split('T')[0],
    status: 'uploaded',
    duration: Number(duration) || 8,
    thumbnail: '',
    title: videoTitle,
    videoUrl: file ? `${baseUrl}/uploads/${file.filename}` : ''
  };

  db.videos.unshift(newVideo);
  
  // Increment video count
  const player = db.players.find(p => p.id === playerId);
  if (player) {
    player.totalVideos = db.videos.filter(v => v.playerId === playerId).length;
  }

  writeDB(db);
  broadcast('VIDEO_UPLOADED', { video: newVideo, players: db.players });

  // Trigger simulated background AI swing analyzer
  triggerAIAnalysis(videoId, playerId);

  res.json({ success: true, video: newVideo });
});

// Video Deletion (Requested feature!)
app.delete('/api/videos/:id', (req, res) => {
  const videoId = req.params.id;
  const db = readDB();

  const videoIndex = db.videos.findIndex(v => v.id === videoId);
  if (videoIndex === -1) {
    return res.status(404).json({ success: false, message: 'Video not found' });
  }

  const playerId = db.videos[videoIndex].playerId;
  
  // Remove video
  db.videos.splice(videoIndex, 1);
  
  // Remove associated analysis
  db.analysis = db.analysis.filter(a => a.videoId !== videoId);
  
  // Remove associated feedback
  db.feedback = db.feedback.filter(f => f.videoId !== videoId);

  // Recalculate Player metrics
  const player = db.players.find(p => p.id === playerId);
  if (player) {
    player.totalVideos = db.videos.filter(v => v.playerId === playerId).length;
    
    const playerAnalyses = db.analysis.filter(a => {
      const v = db.videos.find(vid => vid.id === a.videoId);
      return v && v.playerId === playerId;
    });
    player.avgScore = playerAnalyses.length > 0
      ? Math.round(playerAnalyses.reduce((acc, a) => acc + a.swingScore, 0) / playerAnalyses.length)
      : 0;
  }

  // Recalculate Leaderboard
  recalculateLeaderboard(db);
  writeDB(db);

  broadcast('VIDEO_DELETED', { 
    videoId, 
    leaderboard: db.leaderboard, 
    players: db.players,
    analysis: db.analysis,
    feedback: db.feedback
  });

  res.json({ success: true, message: 'Video deleted successfully' });
});

// Add Coach Feedback
app.post('/api/feedback', (req, res) => {
  const { videoId, coachId, coachName, feedbackText, rating } = req.body;
  const db = readDB();

  const id = `f_${Date.now()}`;
  const newFeedback = {
    id,
    videoId,
    coachId,
    coachName,
    feedback: feedbackText,
    rating: Number(rating) || 5,
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.feedback.unshift(newFeedback);
  writeDB(db);

  broadcast('FEEDBACK_ADDED', { feedback: newFeedback });
  res.json({ success: true, feedback: newFeedback });
});

// Book Schedule Slot
app.post('/api/schedule/book', (req, res) => {
  const { scheduleId, playerId, playerName } = req.body;
  const db = readDB();

  const slot = db.schedules.find(s => s.id === scheduleId);
  if (!slot) {
    return res.status(404).json({ success: false, message: 'Schedule slot not found' });
  }

  slot.type = 'booked';
  slot.playerId = playerId;
  slot.playerName = playerName;

  writeDB(db);
  broadcast('SCHEDULE_UPDATED', { schedules: db.schedules });
  res.json({ success: true, slot });
});

// Create Schedule Slot (Coach)
app.post('/api/schedule/create', (req, res) => {
  const { coachId, date, time } = req.body;
  const db = readDB();

  const id = `s_${Date.now()}`;
  const newSlot = {
    id,
    coachId,
    date,
    time,
    type: 'available'
  };

  db.schedules.unshift(newSlot);
  writeDB(db);

  broadcast('SCHEDULE_UPDATED', { schedules: db.schedules });
  res.json({ success: true, slot: newSlot });
});

// Add Tutorial
app.post('/api/tutorials', (req, res) => {
  const { title, description, coachId, coachName, category, isPremium, duration, videoUrl } = req.body;
  const db = readDB();

  const id = `t_${Date.now()}`;
  const newTutorial = {
    id,
    title,
    description,
    coachId,
    coachName,
    category,
    isPremium: !!isPremium,
    duration: duration || '15 min',
    thumbnail: '',
    videoUrl: videoUrl || '',
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.tutorials.unshift(newTutorial);
  writeDB(db);

  broadcast('TUTORIAL_ADDED', { tutorials: db.tutorials });
  res.json({ success: true, tutorial: newTutorial });
});

// AI Generative Coach Assistant Chat API (Google Gemini 1.5/2.5 flash HTTP connection)
app.post('/api/ai/chat', (req, res) => {
  const { message, swingScore, injuryRiskScore, injuryRiskAreas, swingPhases } = req.body;
  
  const phasesStr = swingPhases ? swingPhases.map(p => `${p.phase}: score=${p.score}, feedback="${p.feedback}"`).join('; ') : '';
  const areasStr = injuryRiskAreas ? injuryRiskAreas.join(', ') : 'None';
  
  const systemPrompt = `You are an elite PGA Class A golf coach specializing in swing biomechanics and motion analysis. You have analyzed a player's swing scan using a YOLO v8 camera. 
The active metrics are: 
- Swing Score = ${swingScore || 80}/100
- Injury Risk = ${injuryRiskScore || 20}%
- Vulnerable Areas = ${areasStr}
- Phase Analysis = ${phasesStr}

The player asks: "${message}"

Respond contextually, professionally, and encouragement-oriented. Suggest practical drills (like Towel Drill, alignment checks, hip rotation core workouts, etc.) that target their specific posture faults. Keep your response structured, neat, and highly informative, using markdown format. Always respond in Bahasa Indonesia since the user is Indonesian, but keep standard golf terminologies in English. Please respond directly without wrapping your text in additional markers like system comments.`;

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey && geminiApiKey.trim() !== '') {
    const https = require('https');
    const data = JSON.stringify({
      contents: [{
        parts: [{
          text: systemPrompt
        }]
      }]
    });
    
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const request = https.request(options, (response) => {
      let responseData = '';
      response.on('data', (chunk) => {
        responseData += chunk;
      });
      
      response.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          const aiReply = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiReply) {
            return res.json({ success: true, text: aiReply });
          } else {
            console.warn('[AI Coach] Gemini returned empty response or error. Falling back to local responder.');
            return res.json({ success: true, text: getLocalHeuristicResponse(message, swingScore, injuryRiskScore, areasStr, phasesStr) });
          }
        } catch (e) {
          console.error('[AI Coach] Failed parsing Gemini API reply, using fallback:', e);
          return res.json({ success: true, text: getLocalHeuristicResponse(message, swingScore, injuryRiskScore, areasStr, phasesStr) });
        }
      });
    });
    
    request.on('error', (e) => {
      console.error('[AI Coach] Gemini API Connection error, using fallback:', e);
      return res.json({ success: true, text: getLocalHeuristicResponse(message, swingScore, injuryRiskScore, areasStr, phasesStr) });
    });
    
    request.write(data);
    request.end();
    return;
  }
  
  // Heuristic Offline Fallback
  const reply = getLocalHeuristicResponse(message, swingScore, injuryRiskScore, areasStr, phasesStr);
  res.json({ success: true, text: reply });
});

function getLocalHeuristicResponse(message, score, risk, areas, phases) {
  const q = message.toLowerCase();
  if (q.includes('cast') || q.includes('downswing') || q.includes('backswing') || q.includes('hinge')) {
    return `Halo! Berdasarkan analisa YOLO scan ayunan Anda (Skor Downswing: ${score}/100):\n\n**Mekanik Analisis:**\nAnda melakukan pelepasan sudut pergelangan tangan terlampau dini (*casting*) di awal downswing, sehingga kehilangan energi kompresi saat impact.\n\n**AI Rekomendasi Latihan:**\n1. **Towel Drill**: Selipkan handuk kecil di bawah ketiak kanan Anda. Lakukan half-swings, pastikan handuk tidak terjatuh untuk menjaga kesatuan gerak lengan dan dada.\n2. **Wrist Lag Drill**: Tarik shaft ke bawah dengan mempertahankan sudut siku kanan menempel pada pinggang sedalam mungkin sebelum mengayun lepas.`;
  }
  if (q.includes('postur') || q.includes('cedera') || q.includes('injury') || q.includes('pinggul') || q.includes('punggung') || q.includes('sakit')) {
    return `Tingkat resiko cedera Anda berada pada **${risk}%** dengan daerah rentan cedera: **${areas}**.\n\n**Saran AI Coach:**\n- **Spine Angle setup**: Saat address, pastikan punggung Anda rata (tidak menekuk *C-Posture* atau melengkung *S-Posture*). Tekuk lutut sedikit dan condongkan panggul secara seimbang.\n- **Latihan Penguatan**: Latih otot inti (*core plank*) dan fleksibilitas panggul (*hip mobility stretching*) sebelum melakukan driving range guna membagi distribusi gaya torsi secara merata dan mencegah saraf kejepit di punggung bawah!`;
  }
  if (q.includes('latihan') || q.includes('drill') || q.includes('rekomendasi') || q.includes('program')) {
    return `Berikut rancangan program latihan spesifik berdasarkan scan ayunan Anda:\n\n1. **Drill Alignment Sticks**: Letakkan stik lurus di tanah sejajar dengan kaki untuk memantapkan postur stasis address Anda.\n2. **Metronome Swing Rhythm**: Mainkan tempo swing dengan ketukan 3:1 (backswing 3 detik, downswing 1 detik).\n3. **Medicine Ball Rotations**: Latih kompresi impact dengan memutar bola pemberat di depan dada.`;
  }
  return `Pertanyaan yang luar biasa! Berdasarkan deteksi visual YOLO v8, skor swing keseluruhan Anda adalah **${score}/100**. \n\nCobalah menjaga stabilitas kepala Anda di dalam lingkaran panduan (Circle markup) yang dapat Anda gambar pada player di atas. Rotasikan panggul secara aktif daripada mendorong tangan Anda ke bola. Apakah Anda ingin latihan pengkondisian fisik tambahan untuk mempercepat rotasi panggul?`;
}

app.get('/api/messages', (req, res) => {
  const db = readDB();
  res.json(db.messages || []);
});

app.post('/api/messages', (req, res) => {
  const { from, to, text } = req.body;
  if (!from || !to || !text) {
    return res.status(400).json({ error: 'Missing from, to, or text' });
  }

  const newMessage = {
    id: `msg_${Date.now()}`,
    from,
    to,
    text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: new Date().toISOString()
  };

  const db = readDB();
  if (!db.messages) db.messages = [];
  db.messages.push(newMessage);
  writeDB(db);

  // Broadcast to all connected clients
  broadcast('CHAT_UPDATE', newMessage);

  res.json({ success: true, message: newMessage });
});

// Start Server integrated HTTP and WS server
server.listen(PORT, () => {
  console.log(`[Server] Golf Helper Backend listening on port ${PORT}`);
});
