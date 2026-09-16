import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { getScoreColor, getScoreLabel, getRiskColor, getRiskLabel } from '@/services/aiService';
import { YoloSwingPlayer } from '@/components/YoloSwingPlayer';
import { AiCoachAssistant } from '@/components/AiCoachAssistant';
import { ArrowLeft, AlertTriangle, CheckCircle, Target, Activity, MessageSquare, Loader2 } from 'lucide-react';
import { AnalysisResult } from '@/data/mockData';

const normalizeAnalysis = (raw: AnalysisResult | undefined): AnalysisResult | null => {
  if (!raw) return null;
  return {
    ...raw,
    swingPhases: Array.isArray(raw.swingPhases) ? raw.swingPhases : [],
    recommendation: Array.isArray(raw.recommendation) ? raw.recommendation : [],
    injuryRiskAreas: Array.isArray(raw.injuryRiskAreas) ? raw.injuryRiskAreas : [],
    swingScore: typeof raw.swingScore === 'number' ? raw.swingScore : 0,
    injuryRiskScore: typeof raw.injuryRiskScore === 'number' ? raw.injuryRiskScore : 0,
    keypointsDetected: typeof raw.keypointsDetected === 'number' ? raw.keypointsDetected : 33,
  };
};

const AnalysisResultPage: React.FC = () => {
  const { videoId } = useParams();
  const { analysis: allAnalysis, feedback: allFeedback, videos, reanalyzeVideo, syncVideoAnalysis, loading } = useData();
  const analysis = normalizeAnalysis(allAnalysis.find(a => a.videoId === videoId));
  const videoItem = videos.find(v => v.id === videoId);
  const feedback = allFeedback.filter(f => f.videoId === videoId);

  useEffect(() => {
    if (!videoId || analysis || videoItem?.status === 'failed') return;

    let cancelled = false;

    const pollAnalysis = async () => {
      if (cancelled) return;
      await syncVideoAnalysis(videoId);
    };

    pollAnalysis();
    const interval = window.setInterval(pollAnalysis, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [videoId, analysis, videoItem?.status, syncVideoAnalysis]);

  if (!analysis) {
    if (loading && !videoItem) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
          <p>Memuat data video...</p>
        </div>
      );
    }

    if (videoItem) {
      if (videoItem.status === 'failed') {
        return (
          <div className="golf-card max-w-3xl mx-auto text-center py-16 flex flex-col items-center gap-4">
            <AlertTriangle className="w-14 h-14 text-destructive" />
            <h1 className="font-display text-2xl font-bold">Analisis gagal</h1>
            <p className="text-muted-foreground max-w-md">
              {videoItem.analysisError ||
                'Analisis tidak dapat diselesaikan. Silakan coba lagi.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="golf-btn-primary"
                onClick={() => void reanalyzeVideo(videoItem.id)}
              >
                Coba Lagi
              </button>
              <Link to="/videos" className="golf-btn-secondary">
                Kembali ke My Videos
              </Link>
            </div>
          </div>
        );
      }

      const isProcessing =
        videoItem.status === 'processing' || videoItem.status === 'uploaded';

      return (
        <div className="space-y-6 max-w-5xl mx-auto">
          <Link
            to="/videos"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back to Videos
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold">Swing Analysis</h1>
            <p className="text-muted-foreground text-sm">
              {isProcessing
                ? 'Sedang memproses video...'
                : 'Menunggu hasil analisis...'}{' '}
              • {videoItem.uploadDate}
            </p>
          </div>
          <div className="golf-card text-center py-16 min-h-[360px] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-14 h-14 text-gold animate-spin" />
            <h2 className="font-display text-2xl font-bold">
              Sedang Menganalisis Ayunan...
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              AI sedang mendeteksi kerangka (skeleton) ayunan Anda. Hasil akan
              muncul otomatis di halaman ini.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Belum ada data analisis untuk video ini.</p>
        <Link to="/videos" className="golf-btn-primary inline-block">Kembali ke My Videos</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/videos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={16} /> Back to Videos
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold">Swing Analysis</h1>
        <p className="text-muted-foreground text-sm">AI-generated analysis report • {analysis.createdAt}</p>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="golf-card-glow text-center py-8">
        <p className="golf-label mb-2">Overall Swing Score</p>
        <p className={`font-display text-7xl font-bold ${getScoreColor(analysis.swingScore)}`}>{analysis.swingScore}</p>
        <p className="text-sm text-muted-foreground mt-1">{getScoreLabel(analysis.swingScore)}</p>
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="text-center">
            <p className="golf-label">Keypoints</p>
            <p className="font-display text-xl font-bold text-gold">{analysis.keypointsDetected}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="golf-label">Injury Risk</p>
            <p className={`font-display text-xl font-bold ${getRiskColor(analysis.injuryRiskScore)}`}>{analysis.injuryRiskScore}%</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="golf-label">Phases</p>
            <p className="font-display text-xl font-bold text-blue-400">{analysis.swingPhases.length}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <YoloSwingPlayer videoId={videoId || 'v1'} swingScore={analysis.swingScore} />
        </div>
        <div className="lg:col-span-2">
          <AiCoachAssistant analysis={analysis} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="golf-card">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><Activity size={18} className="text-gold" /> Swing Phases</h2>
          <div className="space-y-4">
            {analysis.swingPhases.map(phase => (
              <div key={phase.phase}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm capitalize font-medium">{phase.phase}</span>
                  <span className={`text-sm font-bold ${getScoreColor(phase.score)}`}>{phase.score}</span>
                </div>
                <div className="golf-progress-bar">
                  <div className="golf-progress-fill" style={{ width: `${phase.score}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{phase.feedback}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="golf-card">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={18} className="text-yellow-500" /> Injury Risk</h2>
            <div className="text-center mb-4">
              <p className={`font-display text-4xl font-bold ${getRiskColor(analysis.injuryRiskScore)}`}>{analysis.injuryRiskScore}%</p>
              <p className="text-sm text-muted-foreground">{getRiskLabel(analysis.injuryRiskScore)}</p>
            </div>
            <div className="space-y-2">
              <p className="golf-label">Risk Areas</p>
              {analysis.injuryRiskAreas.map(area => (
                <div key={area} className="flex items-center gap-2 text-sm">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="golf-card">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><Target size={18} className="text-gold" /> Recommendations</h2>
            <ul className="space-y-3">
              {analysis.recommendation.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {feedback.length > 0 && (
        <div className="golf-card">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-blue-400" /> Coach Feedback</h2>
          <div className="space-y-4">
            {feedback.map(f => (
              <div key={f.id} className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{f.coachName}</span>
                  <span className="text-xs text-muted-foreground">{f.createdAt}</span>
                </div>
                <p className="text-sm text-muted-foreground">{f.feedback}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisResultPage;
