import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minimize2, ExternalLink, FileText, Download, AlertCircle } from 'lucide-react';

/*
 * One viewer for everything a module or a repository file can be:
 * video file, YouTube link, PDF, Word / PowerPoint / Excel, image, other.
 *
 * - Fills the space it is given; on phones a video sits in a 16:9 box instead
 *   of being cropped to the screen height.
 * - "Full screen" uses the browser's fullscreen API on the viewer itself (not a
 *   new tab), and for video asks the phone to turn landscape while it lasts.
 * - PDFs render inline on desktop; phones cannot show a PDF in a frame, so they
 *   use Google's document viewer on the same signed link.
 * - Office files use Microsoft's online viewer. Its text is sharpest when the
 *   frame is big, so full screen is offered prominently on phones.
 */

export const OFFICE_EXTENSIONS = ['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

export type ContentKind = 'video' | 'youtube' | 'pdf' | 'office' | 'image' | 'other';

export function kindFor(fileName?: string | null, contentType?: string | null, url?: string | null): ContentKind {
  const ext = (fileName?.toLowerCase().match(/\.[a-z0-9]+$/) || [''])[0];
  if (contentType === 'video' && !fileName && url && getYouTubeEmbedUrl(url)) return 'youtube';
  if (!fileName && url && getYouTubeEmbedUrl(url)) return 'youtube';
  if (contentType === 'video' || VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (ext === '.pdf') return 'pdf';
  if (OFFICE_EXTENSIONS.includes(ext)) return 'office';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  return 'other';
}

export function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      let videoId: string | null = null;
      if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1).split('?')[0];
      else if (u.pathname.includes('/embed/')) videoId = u.pathname.split('/embed/')[1].split('?')[0];
      else if (u.pathname.includes('/shorts/')) videoId = u.pathname.split('/shorts/')[1].split('?')[0];
      else videoId = u.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
    }
  } catch { /* not a URL */ }
  return null;
}

export const isPhone = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

interface Props {
  kind: ContentKind;
  /** Signed or public URL of the file (not needed for YouTube). */
  url?: string | null;
  /** Original link for YouTube / external content. */
  link?: string | null;
  title: string;
  fileName?: string | null;
  onVideoEnded?: () => void;
  /** Dark chrome (course player) or light (repository modal). */
  dark?: boolean;
}

export default function ContentViewer({ kind, url, link, title, fileName, onVideoEnded, dark = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const phone = isPhone();

  useEffect(() => {
    const onChange = () => {
      const active = !!document.fullscreenElement;
      setFs(active);
      if (!active) { try { (screen.orientation as any)?.unlock?.(); } catch { /* unsupported */ } }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await (el.requestFullscreen?.() ?? (el as any).webkitRequestFullscreen?.());
      if (kind === 'video' || kind === 'youtube') {
        try { await (screen.orientation as any)?.lock?.('landscape'); } catch { /* phone may refuse; fine */ }
      }
    } catch { /* fullscreen not allowed here; the inline view still works */ }
  };

  const bar = (extra?: ReactNode) => (
    <div className={`flex-shrink-0 flex items-center gap-2 px-3 h-9 ${dark ? 'bg-gray-900 border-t border-gray-800 text-gray-400' : 'bg-gray-50 border-t border-gray-200 text-gray-600'}`}>
      <span className="text-xs truncate flex-1 min-w-0">{fileName || title}</span>
      {extra}
      <button onClick={toggleFullscreen} className={`inline-flex items-center gap-1 text-xs font-medium px-2 h-7 rounded-md ${dark ? 'hover:bg-gray-800 hover:text-white' : 'hover:bg-gray-200'}`}>
        {fs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}{fs ? 'Exit full screen' : 'Full screen'}
      </button>
    </div>
  );

  const frameCls = `flex-1 min-h-0 flex flex-col ${dark ? 'bg-black' : 'bg-gray-100'}`;

  if (kind === 'youtube' && link) {
    const embed = getYouTubeEmbedUrl(link);
    return (
      <div ref={wrapRef} className={`${frameCls} ${fs ? 'bg-black' : ''}`}>
        <div className={`flex-1 min-h-0 flex items-center justify-center ${fs ? '' : ''}`}>
          {/* Portrait phones: a 16:9 box so the sides are never cropped. Otherwise fill. */}
          <div className={fs || !phone ? 'w-full h-full' : 'w-full aspect-video'}>
            <iframe key={embed || ''} src={embed || ''} title={title} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen />
          </div>
        </div>
        {!fs && bar()}
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`${frameCls} items-center justify-center p-6`}>
        <div className="flex items-center gap-2 text-sm text-red-400"><AlertCircle className="w-5 h-5" /> Could not load this file.</div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div ref={wrapRef} className={frameCls}>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <div className={fs || !phone ? 'w-full h-full' : 'w-full aspect-video'}>
            <video key={url} src={url} controls playsInline onEnded={onVideoEnded} className="w-full h-full object-contain bg-black" />
          </div>
        </div>
        {!fs && bar()}
      </div>
    );
  }

  if (kind === 'pdf') {
    // Phones cannot show a PDF inside a frame; Google's viewer can, from the same link.
    const src = phone ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}` : url;
    return (
      <div ref={wrapRef} className={frameCls}>
        <iframe key={src} src={src} title={title} className="w-full flex-1 border-0 bg-white" />
        {!fs && bar(<a href={url} download className={`inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md ${dark ? 'hover:bg-gray-800 hover:text-white' : 'hover:bg-gray-200'}`}><Download className="w-3.5 h-3.5" /> Download</a>)}
      </div>
    );
  }

  if (kind === 'office') {
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}&wdStartOn=1`;
    return (
      <div ref={wrapRef} className={frameCls}>
        <iframe key={viewer} src={viewer} title={title} className="w-full flex-1 border-0 bg-white" allowFullScreen />
        {!fs && bar(phone ? <span className="text-xs hidden xs:inline">Sharper in full screen</span> : <a href={url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md ${dark ? 'hover:bg-gray-800 hover:text-white' : 'hover:bg-gray-200'}`}><ExternalLink className="w-3.5 h-3.5" /> Open</a>)}
      </div>
    );
  }

  if (kind === 'image') {
    return (
      <div ref={wrapRef} className={frameCls}>
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-2"><img src={url} alt={title} className="max-w-full max-h-full object-contain" /></div>
        {!fs && bar()}
      </div>
    );
  }

  return (
    <div className={`${frameCls} items-center justify-center gap-4 p-6`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dark ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}><FileText className={`w-7 h-7 ${dark ? 'text-gray-400' : 'text-gray-500'}`} /></div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{fileName || title}</p>
        <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>This file type cannot be shown here.</p>
      </div>
      <a href={url} download className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-300 transition"><Download className="w-4 h-4" /> Download</a>
    </div>
  );
}
