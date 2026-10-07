'use client';

import { useState, useRef, useEffect } from 'react';

export type Clip = {
  id: string;
  status: string;
  viewUrl?: string | null;
  durationSec?: number | null;
};

export type ClipPlayerProps = {
  clips: Clip[];
  onRefreshNeeded?: () => void;
  onTimeUpdate?: (sec: number) => void;
};

export function ClipPlayer({ clips, onRefreshNeeded, onTimeUpdate }: ClipPlayerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [refreshCalled, setRefreshCalled] = useState<Set<string>>(new Set());
  const [savedTimes, setSavedTimes] = useState<Map<string, number>>(new Map());
  const [lastReportedSec, setLastReportedSec] = useState(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clip = clips[selectedIdx];
  const isReady = clip?.status === 'ready' && clip?.viewUrl;

  const handleError = () => {
    if (!onRefreshNeeded) return;
    const key = `${clip.id}-${clip.viewUrl}`;
    if (!refreshCalled.has(key)) {
      setRefreshCalled((s) => new Set(s).add(key));
      if (videoRef.current) {
        setSavedTimes((m) => new Map(m).set(clip.id, videoRef.current!.currentTime));
      }
      onRefreshNeeded();
    }
  };

  useEffect(() => {
    if (!videoRef.current || !isReady) return;
    const saved = savedTimes.get(clip.id);
    if (saved !== undefined) {
      videoRef.current.currentTime = saved;
      setSavedTimes((m) => {
        const n = new Map(m);
        n.delete(clip.id);
        return n;
      });
    }
  }, [clip.viewUrl, clip.id, isReady, savedTimes]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const sec = Math.floor(video.currentTime);
      if (sec !== lastReportedSec) {
        setLastReportedSec(sec);
        onTimeUpdate?.(sec);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [lastReportedSec, onTimeUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (document.activeElement !== containerRef.current) return;

    if (e.key === ' ') {
      e.preventDefault();
      video.paused ? video.play() : video.pause();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      video.currentTime = Math.min(video.duration, video.currentTime + 5);
    }
  };

  return (
    <div data-testid="clip-player" ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="space-y-2">
      {clips.length > 1 && (
        <div data-testid="clip-tabs" className="flex gap-2">
          {clips.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={selectedIdx === i}
              data-testid={`clip-tab-${i}`}
              onClick={() => setSelectedIdx(i)}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
            >
              คลิป {i + 1}
            </button>
          ))}
        </div>
      )}

      {!isReady ? (
        <div className="space-y-2">
          <p role="status" data-testid="clip-not-ready" className="text-sm text-gray-600">
            คลิปยังไม่พร้อม
          </p>
          <button
            data-testid="clip-refresh"
            onClick={() => onRefreshNeeded?.()}
            className="px-3 py-1 rounded bg-blue-500 text-white text-sm"
          >
            รีเฟรช
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            data-testid="clip-video"
            controls
            playsInline
            preload="metadata"
            src={clip.viewUrl || undefined}
            onError={handleError}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.playbackRate = playbackRate;
              }
            }}
            className="w-full bg-black rounded"
          />

          <div className="flex flex-wrap gap-2">
            <button
              data-testid="clip-rewind"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                }
              }}
              className="px-3 py-1 rounded bg-gray-200 text-sm"
            >
              ย้อน 5 วิ
            </button>

            {[0.5, 1, 1.5].map((rate) => (
              <button
                key={rate}
                data-testid={`clip-speed-${rate}`}
                aria-pressed={playbackRate === rate}
                onClick={() => {
                  setPlaybackRate(rate);
                  if (videoRef.current) videoRef.current.playbackRate = rate;
                }}
                className={`px-3 py-1 rounded text-sm ${playbackRate === rate ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {refreshCalled.has(`${clip.id}-${clip.viewUrl}`) && (
            <div className="space-y-2">
              <p role="alert" data-testid="clip-error" className="text-sm text-red-600">
                เล่นคลิปไม่ได้
              </p>
              <button
                data-testid="clip-retry"
                onClick={() => onRefreshNeeded?.()}
                className="px-3 py-1 rounded bg-red-500 text-white text-sm"
              >
                ลองใหม่
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
