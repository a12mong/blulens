'use client';

import React, { useRef, useState } from 'react';
import { thaiError } from '@/lib/errors';
import {
  useRequestClipUpload,
  useCompleteClip,
  putFileWithProgress,
  readVideoDuration,
  validateClipFile,
  type Clip,
} from './uploadApi';

interface ClipUploaderProps {
  assessmentId: string;
  onUploaded: (clip: Clip) => void;
  disabled?: boolean;
}

type State = 'idle' | 'checking' | 'uploading' | 'finishing' | 'done' | 'error';

export function ClipUploader({ assessmentId, onUploaded, disabled = false }: ClipUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<State>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadedClip, setUploadedClip] = useState<Clip | null>(null);
  const durationSecRef = useRef(0);

  const requestUpload = useRequestClipUpload(assessmentId);
  const completeClip = useCompleteClip();

  const resetForm = () => {
    setState('idle');
    setSelectedFile(null);
    setProgress(0);
    setErrorMsg('');
    durationSecRef.current = 0;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setState('checking');
    setErrorMsg('');

    // Validate file type and size
    const validationError = validateClipFile(file);
    if (validationError === 'type') {
      setState('error');
      setErrorMsg('ชนิดไฟล์ไม่รองรับ (ใช้ mp4 หรือ mov)');
      return;
    }
    if (validationError === 'size') {
      setState('error');
      setErrorMsg('ไฟล์ใหญ่เกิน 500MB');
      return;
    }

    // Read duration
    try {
      const duration = await readVideoDuration(file);
      if (duration > 300) {
        setState('error');
        setErrorMsg('คลิปยาวเกิน 5 นาที (ไม่เกิน 300 วินาที)');
        return;
      }
      durationSecRef.current = duration;
    } catch {
      setState('error');
      setErrorMsg('อ่านความยาวคลิปไม่ได้ ลองไฟล์อื่น');
      return;
    }

    // Request upload URL
    try {
      setState('uploading');
      setProgress(0);
      abortControllerRef.current = new AbortController();

      const uploadUrlData = await requestUpload.mutateAsync({
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      // PUT file to storage
      await putFileWithProgress(
        uploadUrlData.uploadUrl,
        file,
        file.type,
        (pct) => setProgress(pct),
        abortControllerRef.current.signal,
      );

      // Complete the clip
      setState('finishing');
      const completedClip = await completeClip.mutateAsync({
        clipId: uploadUrlData.clipId,
        durationSec: durationSecRef.current,
      });

      setState('done');
      setUploadedClip(completedClip);
      onUploaded(completedClip);
    } catch (err) {
      if (err instanceof Error && err.message === 'UPLOAD_ABORTED') {
        setState('idle');
        setSelectedFile(null);
        setProgress(0);
      } else {
        setState('error');
        if (err instanceof Error && err.message === 'UPLOAD_FAILED') {
          setErrorMsg('อัปโหลดไม่สำเร็จ ลองใหม่');
        } else {
          setErrorMsg(thaiError(err as any, 'ไม่สามารถอัปโหลดได้'));
        }
      }
    }
  };

  const handleRetry = async () => {
    if (!selectedFile) return;
    await handleFileChange({ target: { files: [selectedFile] } } as any);
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handlePickNew = () => {
    resetForm();
  };

  const isCheckingOrUploading = state === 'checking' || state === 'uploading' || state === 'finishing';

  return (
    <div className="space-y-4">
      {/* File input (hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        onChange={handleFileChange}
        disabled={disabled || isCheckingOrUploading}
        data-testid="clip-file"
        className="hidden"
      />

      {/* Pick button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isCheckingOrUploading || (state === 'done' ? false : state !== 'idle' && state !== 'error')}
        className="min-h-[44px] px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        data-testid="clip-pick"
      >
        เลือกวิดีโอ
      </button>

      {/* State messages and progress */}
      {state === 'idle' && !selectedFile && (
        <div data-testid="clip-state" className="text-sm text-muted-foreground">
          ยังไม่ได้เลือกคลิป
        </div>
      )}

      {state === 'checking' && (
        <div data-testid="clip-state" className="text-sm text-muted-foreground">
          กำลังตรวจไฟล์
        </div>
      )}

      {state === 'uploading' && (
        <div className="space-y-2">
          <div data-testid="clip-state" className="text-sm text-muted-foreground">
            กำลังอัปโหลด
          </div>
          <div className="flex items-center gap-3">
            <progress
              data-testid="clip-progress"
              value={progress}
              max={100}
              className="flex-1 h-2 rounded bg-muted"
            />
            <span className="text-sm font-medium min-w-[40px]">{progress}%</span>
          </div>
          <button
            onClick={handleCancel}
            data-testid="clip-cancel"
            className="text-sm text-destructive hover:underline"
          >
            ยกเลิก
          </button>
        </div>
      )}

      {state === 'finishing' && (
        <div data-testid="clip-state" className="text-sm text-muted-foreground">
          กำลังบันทึก
        </div>
      )}

      {state === 'done' && uploadedClip && (
        <div className="space-y-3">
          <div data-testid="clip-state" className="text-sm text-foreground">
            อัปโหลดแล้ว: {selectedFile?.name} ({durationSecRef.current} วินาที)
          </div>
          <button
            onClick={handlePickNew}
            className="text-sm text-primary hover:underline"
          >
            เลือกไฟล์ใหม่
          </button>
        </div>
      )}

      {state === 'error' && errorMsg && (
        <div className="space-y-3">
          <div
            data-testid="clip-error"
            role="alert"
            className="p-3 rounded-lg bg-destructive/10 border border-destructive"
          >
            <p className="text-sm text-destructive">{errorMsg}</p>
          </div>
          <button
            onClick={handleRetry}
            className="text-sm text-primary hover:underline"
          >
            ลองใหม่
          </button>
        </div>
      )}
    </div>
  );
}
