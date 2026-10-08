'use client';

import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

type Clip = components['schemas']['Clip'];

export type { Clip };

export type UploadUrlResponse = {
  clipId: string;
  uploadUrl: string;
  expiresAt: string;
};

export type CompleteClipPayload = {
  clipId: string;
  durationSec: number;
};

export function useRequestClipUpload(assessmentId: string) {
  return useMutation({
    mutationFn: async ({ fileName, contentType, sizeBytes }: { fileName: string; contentType: string; sizeBytes: number }) => {
      return apiFetch<UploadUrlResponse>(
        `/assessments/${assessmentId}/clips/upload-url`,
        {
          method: 'POST',
          body: {
            fileName,
            contentType,
            sizeBytes,
          },
        },
      );
    },
  });
}

export function useCompleteClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clipId, durationSec }: CompleteClipPayload) => {
      return apiFetch<Clip>(`/clips/${clipId}/complete`, {
        method: 'POST',
        body: {
          durationSec,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
    },
  });
}

export function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error('UPLOAD_FAILED'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('UPLOAD_FAILED'));
    };

    xhr.onabort = () => {
      reject(new Error('UPLOAD_ABORTED'));
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
      }, false);
    }

    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

export async function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    video.onloadedmetadata = () => {
      cleanup();
      resolve(Math.ceil(video.duration));
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Cannot read video metadata'));
    };

    // Timeout in case metadata never loads
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video metadata timeout'));
    }, 5000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(Math.ceil(video.duration));
    };
  });
}

export function validateClipFile(file: File): 'type' | 'size' | null {
  const validTypes = ['video/mp4', 'video/quicktime'];
  if (!validTypes.includes(file.type)) {
    return 'type';
  }

  const maxSize = 524288000; // 500 MB
  if (file.size > maxSize) {
    return 'size';
  }

  return null;
}
