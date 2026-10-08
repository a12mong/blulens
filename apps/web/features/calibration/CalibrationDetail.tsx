'use client';

import { useState, useRef } from 'react';
import { GradePicker } from '@/components/ui/GradePicker';
import type { GradeKey } from '@/components/ui/GradeBand';
import { ClipPlayer } from '@/components/ui/ClipPlayer';
import { thaiError } from '@/lib/errors';
import { putFileWithProgress, readVideoDuration, validateClipFile } from '@/features/clips/uploadApi';
import {
  useCalibrationSet,
  useCompleteCalibrationClip,
  useDeleteCalibrationClip,
  useRequestCalibrationClip,
  useUpdateCalibrationClip,
  type CalibrationSetDetail,
} from './api';

interface CalibrationDetailProps {
  setId: string;
}

type UploadState = 'idle' | 'checking' | 'uploading' | 'finishing' | 'done' | 'error';

export function CalibrationDetail({ setId }: CalibrationDetailProps) {
  const { data: detail, isLoading, error, refetch } = useCalibrationSet(setId);
  const requestMutation = useRequestCalibrationClip(setId);
  const completeMutation = useCompleteCalibrationClip(setId);
  const updateMutation = useUpdateCalibrationClip(setId);
  const deleteMutation = useDeleteCalibrationClip(setId);

  const [addGrade, setAddGrade] = useState<GradeKey | null | undefined>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteConfirmClipId, setDeleteConfirmClipId] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const durationSecRef = useRef(0);

  if (isLoading) {
    return <div data-testid="calib-loading" role="status">กำลังโหลด...</div>;
  }

  if (error) {
    return (
      <div data-testid="calib-load-error" role="alert" className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-800">{thaiError(error)}</p>
        <button
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded min-h-[44px]"
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  if (!detail) {
    return <div>ไม่พบชุดนี้</div>;
  }

  const isAssigned = detail.assignedAt != null;

  async function handleAddClip(file: File) {
    if (!addGrade) return;

    setUploadError('');
    setUploadProgress(0);

    try {
      setUploadState('checking');

      const validationError = validateClipFile(file);
      if (validationError) {
        if (validationError === 'type') {
          setUploadError('ชนิดไฟล์ไม่รองรับ');
        } else if (validationError === 'size') {
          setUploadError('ไฟล์ใหญ่เกิน 500 MB');
        }
        setUploadState('error');
        return;
      }

      const duration = await readVideoDuration(file);
      if (duration > 300) {
        setUploadError('คลิปยาวเกิน 5 นาที');
        setUploadState('error');
        return;
      }
      durationSecRef.current = duration;

      setUploadState('uploading');
      const uploadResp = await requestMutation.mutateAsync({
        fileName: file.name,
        contentType: file.type || 'video/mp4',
        sizeBytes: file.size,
        referenceKey: addGrade,
      });

      abortControllerRef.current = new AbortController();
      await putFileWithProgress(
        uploadResp.uploadUrl,
        file,
        file.type || 'video/mp4',
        setUploadProgress,
        abortControllerRef.current.signal,
      );

      setUploadState('finishing');
      await completeMutation.mutateAsync({
        clipId: uploadResp.clipId,
        durationSec: durationSecRef.current,
      });

      setUploadState('done');
      setAddGrade(null);
    } catch (e) {
      if (e instanceof Error && e.message === 'UPLOAD_ABORTED') {
        setUploadState('idle');
      } else if (e instanceof Error && e.message === 'UPLOAD_FAILED') {
        setUploadError('อัปโหลดไม่สำเร็จ ลองใหม่');
        setUploadState('error');
      } else {
        setUploadError(thaiError(e, 'อัปโหลดไม่สำเร็จ ลองใหม่'));
        setUploadState('error');
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
    setUploadState('idle');
    setUploadProgress(0);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      void handleAddClip(file);
    }
    e.currentTarget.value = '';
  };

  function handleGradeChange(clipId: string, newGrade: GradeKey | null | undefined) {
    if (!newGrade) return;
    void updateMutation.mutateAsync({
      clipId,
      referenceKey: newGrade,
    });
  }

  function handleDeleteConfirm() {
    if (deleteConfirmClipId) {
      void deleteMutation.mutateAsync({
        clipId: deleteConfirmClipId,
      });
      setDeleteConfirmClipId('');
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{detail.name}</h2>
        <div className="flex gap-4 text-sm text-gray-600 mt-1">
          {detail.period && <span>{detail.period}</span>}
          <span data-testid="calib-state">
            {isAssigned ? 'มอบหมายแล้ว' : 'ฉบับร่าง'}
          </span>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div data-testid="calib-error" role="alert" className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
          {uploadError}
          {uploadState === 'error' && (
            <button
              onClick={() => {
                setUploadState('idle');
                setUploadError('');
              }}
              className="ml-2 text-red-600 underline"
            >
              ลองใหม่
            </button>
          )}
        </div>
      )}

      {/* Add Clip Form */}
      {!isAssigned && (
        <div data-testid="calib-add" className="p-4 border rounded bg-gray-50 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">เกรดอ้างอิง</span>
            <GradePicker
              value={addGrade}
              onChange={setAddGrade}
              disabled={uploadState !== 'idle' && uploadState !== 'done'}
            />
            {!addGrade && <p className="text-xs text-gray-500 mt-1">เลือกเกรดอ้างอิงก่อน</p>}
          </label>

          <label className="block">
            <input
              type="file"
              accept="video/mp4,.mp4,video/quicktime,.mov"
              onChange={handleFileChange}
              disabled={!addGrade || uploadState !== 'idle'}
              style={{ display: 'none' }}
              data-testid="calib-file-input"
            />
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.parentElement?.querySelector('input')?.click();
              }}
              disabled={!addGrade || uploadState !== 'idle'}
              className="px-4 py-2 bg-blue-600 text-white rounded min-h-[44px] disabled:opacity-50"
              data-testid="calib-pick"
            >
              เลือกวิดีโอ
            </button>
          </label>

          {uploadState === 'uploading' && (
            <div className="space-y-2">
              <progress
                data-testid="calib-progress"
                value={uploadProgress}
                max={100}
                className="w-full h-2"
              />
              <p className="text-sm text-gray-600">{uploadProgress}%</p>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-400 text-white rounded min-h-[44px]"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clips List */}
      {detail.clipDetails && detail.clipDetails.length > 0 ? (
        <div className="space-y-4">
          {detail.clipDetails.map((clip) => (
            <div key={clip.clipId} data-testid="calib-clip" className="p-4 border rounded">
              {/* Player */}
              {clip.viewUrl && clip.status === 'uploaded' && (
                <div className="mb-3">
                  <ClipPlayer
                    clips={[{
                      id: clip.clipId,
                      status: 'uploaded',
                      viewUrl: clip.viewUrl,
                      durationSec: clip.durationSec,
                    }]}
                    onRefreshNeeded={() => void refetch()}
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    {clip.status === 'pending_upload' && 'รออัปโหลด'}
                    {clip.status === 'uploaded' && 'พร้อมใช้'}
                    {clip.status === 'rejected' && 'ใช้ไม่ได้'}
                  </p>
                  {clip.durationSec && (
                    <p className="text-sm text-gray-600">{clip.durationSec} วินาที</p>
                  )}
                </div>

                {/* Grade Edit */}
                <div className="flex items-center gap-2">
                  {isAssigned ? (
                    <span className="text-sm">{clip.referenceKey}</span>
                  ) : (
                    <GradePicker
                      value={clip.referenceKey as GradeKey}
                      onChange={(newGrade) => handleGradeChange(clip.clipId, newGrade)}
                      data-testid="calib-ref-edit"
                    />
                  )}
                </div>

                {/* Delete Button */}
                {!isAssigned && (
                  <button
                    onClick={() => setDeleteConfirmClipId(clip.clipId)}
                    className="px-4 py-2 bg-red-600 text-white rounded min-h-[44px]"
                    data-testid="calib-clip-delete"
                  >
                    ลบคลิป
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded text-center text-gray-600">
          ยังไม่มีคลิปในชุด
        </div>
      )}

      {/* Reviewers Table */}
      {detail.reviewers && detail.reviewers.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">ผู้ประเมิน</h3>
          <table data-testid="calib-reviewers" className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">ชื่อ</th>
                <th className="text-left p-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {detail.reviewers.map((reviewer) => (
                <tr key={reviewer.reviewerId} className="border-b">
                  <td className="p-2">{reviewer.reviewerName}</td>
                  <td className="p-2">
                    {reviewer.submitted ? 'ส่งแล้ว' : 'รอส่ง'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmClipId ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-6 max-w-md w-full flex flex-col gap-4">
            <h2 className="text-lg font-semibold">ลบคลิป</h2>
            <p className="text-sm text-gray-600">คุณแน่ใจว่าต้องการลบคลิปนี้ใช่ไหม</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmClipId('')}
                disabled={deleteMutation.isPending}
                className="min-h-[44px] px-4 py-2 text-sm rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'กำลังลบ…' : 'ลบ'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
