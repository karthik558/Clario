import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
  Copy,
  Check,
  Download,
  Headphones,
  FileText,
  Clock,
  ChevronDown,
  Layers
} from 'lucide-react';
import { AudioSummaryResponse, AudioSection } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { api } from '../../services/api';

interface AudioBriefingPlayerProps {
  data: AudioSummaryResponse;
  onRefresh?: () => void;
  className?: string;
}

export const AudioBriefingPlayer: React.FC<AudioBriefingPlayerProps> = ({
  data,
  onRefresh,
  className = ''
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef = useRef<any>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExportMenu]);

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      if (!selectedVoiceURI && available.length > 0) {
        const naturalVoice = available.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel') ||
              v.name.includes('Karen') ||
              v.name.includes('Google') ||
              v.name.includes('Premium'))
        );
        const fallbackEnglish = available.find((v) => v.lang.startsWith('en'));
        setSelectedVoiceURI(naturalVoice?.voiceURI || fallbackEnglish?.voiceURI || available[0].voiceURI);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle play/pause
  const speakSection = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (index >= data.sections.length) {
      setIsPlaying(false);
      setActiveSectionIndex(0);
      setProgressPercent(100);
      return;
    }

    const currentSection = data.sections[index];
    const textToSpeak = `${currentSection.title}. ${currentSection.text}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    if (selectedVoiceURI) {
      const selected = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (selected) utterance.voice = selected;
    }

    utterance.rate = playbackRate;
    utterance.volume = isMuted ? 0 : 1;

    utterance.onend = () => {
      if (index + 1 < data.sections.length) {
        setActiveSectionIndex(index + 1);
        speakSection(index + 1);
      } else {
        setIsPlaying(false);
        setActiveSectionIndex(0);
        setProgressPercent(100);
      }
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setActiveSectionIndex(index);
  };

  const handleTogglePlay = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      speakSection(activeSectionIndex);
    }
  };

  const handleSkip = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      const target = Math.max(0, activeSectionIndex - 1);
      setActiveSectionIndex(target);
      if (isPlaying) speakSection(target);
    } else {
      const target = Math.min(data.sections.length - 1, activeSectionIndex + 1);
      setActiveSectionIndex(target);
      if (isPlaying) speakSection(target);
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (isPlaying) {
      speakSection(activeSectionIndex);
    }
  };

  const handleReset = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setActiveSectionIndex(0);
    setProgressPercent(0);
    setElapsedSeconds(0);
  };

  // Timer to approximate elapsed seconds and scrub bar
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          const pct = Math.min(100, Math.round((next / Math.max(1, data.duration_seconds)) * 100));
          setProgressPercent(pct);
          return next;
        });
      }, 1000 / playbackRate);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    }
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, playbackRate, data.duration_seconds]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(data.full_audio_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    const textContent = `CLARIO EXECUTIVE AUDIO BRIEFING\nDate: ${data.generated_date}\nTotal Duration: ${data.duration_formatted}\nWord Count: ${data.word_count}\n\n${data.sections
      .map(
        (s, i) =>
          `[Chapter ${i + 1}: ${s.title} (${s.speaker})]\nEstimated Duration: ~${s.estimated_seconds}s\n${s.text}\n`
      )
      .join('\n')}\n---\nFull Audio Script:\n${data.full_audio_text}`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clario_Audio_Briefing_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportAudioFile = (format: 'mp3' | 'mp4') => {
    const downloadUrl = api.getAudioExportUrl(undefined, format);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Clario_Briefing_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
  };

  const formatSecs = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Card className={`p-5 bg-white border border-slate-200 shadow-subtle rounded-md space-y-4 ${className}`}>
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-slate-100 text-clario-navy shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                AI Audio Briefing
              </h3>
              <Badge variant="navy" size="sm">
                {data.duration_formatted}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-speaker intelligence briefing synthesized from {data.audited_documents.length} document(s) • {data.word_count} words
            </p>
          </div>
        </div>

        {/* Action Buttons: Export Audio & Copy Script */}
        <div className="flex items-center gap-2 relative">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyScript}
            className="flex items-center gap-1.5"
            title="Copy narrated briefing script"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Script</span>
              </>
            )}
          </Button>

          {/* Export Dropdown (MP3, MP4, TXT) */}
          <div className="relative" ref={exportMenuRef}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 shadow-xs"
              title="Export audio file or transcript"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audio</span>
              <ChevronDown className="w-3 h-3 ml-0.5 text-slate-300" />
            </Button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-md shadow-card z-30 py-1.5 animate-in fade-in-50 text-xs">
                <div className="px-3 py-1 font-semibold text-[10px] uppercase tracking-wider text-slate-400">
                  Audio & Video Formats
                </div>
                <button
                  type="button"
                  onClick={() => handleExportAudioFile('mp3')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="font-medium">MP3 Audio (.mp3)</span>
                  <Badge variant="navy" size="sm">Standard</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportAudioFile('mp4')}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700 transition-colors"
                >
                  <span className="font-medium">MP4 Video (.mp4)</span>
                  <Badge variant="gray" size="sm">Visual</Badge>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  type="button"
                  onClick={handleDownloadTranscript}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-600 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Download Transcript (.txt)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Dashboard Console Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Controls: Prev, Play/Pause, Next, Restart, Speed */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSkip('prev')}
              disabled={activeSectionIndex === 0}
              className="px-2"
              title="Previous chapter"
            >
              <Rewind className="w-3.5 h-3.5 text-slate-600" />
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleTogglePlay}
              className="flex items-center gap-1.5 px-3.5 shadow-xs"
              title={isPlaying ? 'Pause audio briefing' : 'Play audio briefing'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                  <span>Play Briefing</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSkip('next')}
              disabled={activeSectionIndex >= data.sections.length - 1}
              className="px-2"
              title="Next chapter"
            >
              <FastForward className="w-3.5 h-3.5 text-slate-600" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="px-2 text-slate-500"
              title="Restart from beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSpeedCycle}
              className="px-2.5 font-mono text-xs font-semibold text-slate-700"
              title="Change speech playback speed"
            >
              {playbackRate}x
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="px-2 text-slate-500"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Neutral Soundwave Activity Bars & Voice Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-1 h-5 px-2 py-1 bg-white border border-slate-200 rounded-md">
              {[40, 75, 30, 90, 60, 100, 45, 80, 50, 70].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-xs transition-all duration-300 ${
                    isPlaying ? 'bg-clario-navy' : 'bg-slate-200'
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(25, (h * (1 + (i % 3) * 0.2)) % 100)}%` : '25%'
                  }}
                />
              ))}
            </div>

            {voices.length > 0 && (
              <Select
                aria-label="Speech voice"
                value={selectedVoiceURI}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 max-w-[160px] truncate"
              >
                {voices.slice(0, 15).map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Progress Bar & Timing */}
        <div className="space-y-1 pt-1">
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-clario-navy h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-500">
            <span>{formatSecs(elapsedSeconds)}</span>
            <span>{data.duration_formatted}</span>
          </div>
        </div>
      </div>

      {/* Chapters Breakdown matching standard dashboard list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700">
            Briefing Chapters ({data.sections.length})
          </span>
          <span className="text-[11px] text-slate-400">Click any chapter to jump and listen</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {data.sections.map((section, idx) => {
            const isCurrent = activeSectionIndex === idx;
            const speakerBadgeVariant =
              section.speaker === 'Host'
                ? 'navy'
                : section.speaker === 'Executive Narrator'
                ? 'sage'
                : 'gold';

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSectionIndex(idx);
                  speakSection(idx);
                }}
                className={`p-3 rounded-md border text-left transition-all ${
                  isCurrent
                    ? 'border-slate-900 bg-slate-50/80 shadow-xs ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={speakerBadgeVariant} size="sm">
                      {section.speaker}
                    </Badge>
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">
                      {section.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    ~{section.estimated_seconds}s
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {section.text}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
