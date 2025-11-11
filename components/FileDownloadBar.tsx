'use client';

import { GeneratedFile } from '@/lib/types';
import { useState } from 'react';

interface FileDownloadBarProps {
  files: GeneratedFile[];
  enabled: boolean;
}

export function FileDownloadBar({ files, enabled }: FileDownloadBarProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!enabled || files.length === 0) return;

    setDownloading(true);

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ftc-code-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download files. Check console for details.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-between bg-surface border-t border-border px-6 py-3">
      <div className="text-sm text-textMuted">
        {files.length > 0 ? (
          <span>
            {files.length} file{files.length !== 1 ? 's' : ''} ready
          </span>
        ) : (
          <span>No files generated yet</span>
        )}
      </div>

      <button
        onClick={handleDownload}
        disabled={!enabled || files.length === 0 || downloading}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          enabled && files.length > 0 && !downloading
            ? 'bg-accent text-background hover:bg-accentHover'
            : 'bg-surface border border-border text-textMuted cursor-not-allowed'
        }`}
      >
        {downloading ? 'Downloading...' : 'Download All'}
      </button>
    </div>
  );
}
