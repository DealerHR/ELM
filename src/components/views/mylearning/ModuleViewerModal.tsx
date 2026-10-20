import { useState, useEffect } from 'react';
import {
  X, FileText, Video, Link2, ExternalLink, CheckCircle2,
  RefreshCw, AlertCircle, BookOpen,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface CourseModule {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  duration_minutes: number;
  content_url: string | null;
  content_file_path: string | null;
  content_file_name: string | null;
}

interface ModuleViewerModalProps {
  module: CourseModule;
  onClose: () => void;
  onMarkDone: () => void;
  saving: boolean;
  readOnly?: boolean;
}

const CONTENT_LABELS: Record<string, string> = {
  document: 'Document',
  video: 'Video',
  presentation: 'Presentation',
  external_link: 'Link',
  assignment: 'Assignment',
};

export default function ModuleViewerModal({ module, onClose, onMarkDone, saving, readOnly }: ModuleViewerModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  useEffect(() => {
    if (!module.content_file_path) return;
    setLoadingFile(true);
    supabase.storage
      .from('course-content')
      .createSignedUrl(module.content_file_path, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          setUrlError('Could not load file. Please try again.');
        } else {
          setFileUrl(data.signedUrl);
        }
        setLoadingFile(false);
      });
  }, [module.content_file_path]);

  const handleOpenPdf = async () => {
    if (!module.content_file_path) return;
    setOpeningPdf(true);
    try {
      const { data, error } = await supabase.storage
        .from('course-content')
        .createSignedUrl(module.content_file_path, 300);
      if (!error && data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } finally {
      setOpeningPdf(false);
    }
  };

  const hasFile = Boolean(module.content_file_path);
  const hasLink = Boolean(module.content_url);
  const isVideo = module.content_type === 'video';
  const isPdf = module.content_file_name?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              {isVideo ? <Video className="w-4 h-4 text-blue-700" /> : hasLink ? <Link2 className="w-4 h-4 text-blue-700" /> : <FileText className="w-4 h-4 text-blue-700" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate">{module.title}</h2>
              <p className="text-xs text-gray-400">{CONTENT_LABELS[module.content_type] || module.content_type} &middot; {module.duration_minutes} min</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {module.description && (
            <div className="px-5 py-3 border-b border-gray-50">
              <p className="text-sm text-gray-600">{module.description}</p>
            </div>
          )}

          {loadingFile && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}

          {urlError && (
            <div className="flex items-center gap-2 m-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{urlError}
            </div>
          )}

          {!loadingFile && !urlError && hasFile && fileUrl && (
            <>
              {isVideo ? (
                <div className="p-4">
                  <video
                    src={fileUrl}
                    controls
                    className="w-full rounded-xl bg-black max-h-[50vh]"
                  />
                </div>
              ) : isPdf ? (
                isMobile ? (
                  <div className="p-6 flex flex-col items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-red-50 border-2 border-red-100 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-800">{module.content_file_name}</p>
                      <p className="text-xs text-gray-400 mt-1">PDF Document &middot; Tap below to view</p>
                    </div>
                    <button
                      onClick={handleOpenPdf}
                      disabled={openingPdf}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-950 text-white text-sm font-bold rounded-xl hover:bg-blue-900 active:scale-95 transition disabled:opacity-60"
                    >
                      {openingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                      {openingPdf ? 'Opening...' : 'Open PDF'}
                    </button>
                    <p className="text-[11px] text-gray-400 text-center">Opens in your device's PDF viewer</p>
                  </div>
                ) : (
                  <div className="p-4">
                    <iframe
                      src={fileUrl!}
                      title={module.title}
                      className="w-full rounded-xl border border-gray-200"
                      style={{ height: '55vh' }}
                    />
                    <a
                      href={fileUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />Open in new tab
                    </a>
                  </div>
                )
              ) : (
                <div className="p-5 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-7 h-7 text-blue-700" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-800">{module.content_file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Click below to open the file</p>
                  </div>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
                  >
                    <ExternalLink className="w-4 h-4" />Open File
                  </a>
                </div>
              )}
            </>
          )}

          {!loadingFile && !hasFile && hasLink && (
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Link2 className="w-7 h-7 text-blue-700" />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400">External resource</p>
                <p className="text-sm font-medium text-gray-700 mt-1 break-all">{module.content_url}</p>
              </div>
              <a
                href={module.content_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-950 text-white text-sm font-semibold rounded-xl hover:bg-blue-900 transition"
              >
                <ExternalLink className="w-4 h-4" />Open Link
              </a>
            </div>
          )}

          {!loadingFile && !hasFile && !hasLink && (
            <div className="p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No content attached</p>
              <p className="text-xs text-gray-400">This module has no file or link. Mark it as done once you have completed the activity.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          {readOnly ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />Already completed
              </div>
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                Close
              </button>
            </div>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition">
                Close
              </button>
              <button
                onClick={onMarkDone}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark as Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
