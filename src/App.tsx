import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const BANNER_HEIGHT = 36;
const SIDE_GUTTER = 36;
const TOTAL_BANNER_HEIGHT = BANNER_HEIGHT * 2;
const TOTAL_SIDE_GUTTER = SIDE_GUTTER * 2;

// ---------------------------------------------------------------------------
// Media pool helpers
// ---------------------------------------------------------------------------

const pickValidMediaSet = (pool: any[]) => {
  if (pool.length < 10) return pool;

  let arr = [];
  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    arr = [...pool].sort(() => 0.5 - Math.random()).slice(0, 10);

    const ar1 = arr.slice(0, 3).reduce((sum: number, m: any) => sum + (m.width / m.height), 0);
    const ar2 = arr.slice(3, 7).reduce((sum: number, m: any) => sum + (m.width / m.height), 0);
    const ar3 = arr.slice(7, 10).reduce((sum: number, m: any) => sum + (m.width / m.height), 0);

    if (ar2 > ar1 && ar2 > ar3) return arr;
  }

  return arr;
};

const generatePicsumImages = () => {
  const dimensions = [
    { w: 800, h: 600 }, { w: 600, h: 800 }, { w: 1200, h: 600 },
    { w: 800, h: 800 }, { w: 1600, h: 900 }, { w: 900, h: 1600 },
    { w: 1000, h: 600 }, { w: 600, h: 1000 }, { w: 800, h: 400 },
    { w: 400, h: 800 }
  ];

  const images = Array.from({ length: 10 }).map(() => {
    const seed = Math.random().toString(36).substring(2, 9);
    const dim = dimensions[Math.floor(Math.random() * dimensions.length)];
    return {
      id: seed,
      type: 'image' as const,
      src: `https://picsum.photos/seed/${seed}/${dim.w}/${dim.h}`,
      title: `IMG_${seed.toUpperCase()}.JPG`,
      width: dim.w,
      height: dim.h,
    };
  });

  return pickValidMediaSet(images);
};

// ---------------------------------------------------------------------------
// Preload helpers
// ---------------------------------------------------------------------------

function preloadPhoto(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') await image.decode();
      } catch { /* ignore */ }
      resolve();
    };
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function preloadPoster(src: string | undefined): Promise<void> {
  if (!src) return Promise.resolve();
  return preloadPhoto(src);
}

// ---------------------------------------------------------------------------
// Media cards
// ---------------------------------------------------------------------------

function PhotoCard({ src, title, width, height }: { src: string; title: string; width: number; height: number }) {
  return (
    <div style={{ flex: width / height, minWidth: 0 }}>
      <img src={src} alt={title} className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
    </div>
  );
}

function VideoCard({ src, poster, title, width, height }: { src: string; poster?: string; title: string; width: number; height: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Direct DOM properties needed for browser autoplay policy
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;

    // Start playback once
    video.play().catch(() => {
      // If browser blocks autoplay before user gesture, start on first click/touch
      const resume = () => {
        video.play().catch(() => {});
      };
      window.addEventListener('click', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
    });

    // Fallback loop listener in case browser native loop event is delayed
    const onEnded = () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    };
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('ended', onEnded);
    };
  }, [src]);

  return (
    <div style={{ flex: width / height, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover block"
        aria-label={title}
      />
    </div>
  );
}

function MediaCard({ item }: { item: any }) {
  if (item.type === 'video') {
    return <VideoCard src={item.src} poster={item.poster} title={item.title} width={item.width} height={item.height} />;
  }
  return <PhotoCard src={item.src} title={item.title} width={item.width} height={item.height} />;
}

// ---------------------------------------------------------------------------
// Board layout
// ---------------------------------------------------------------------------

type BoardLayout = { name: string; rowCounts: number[]; equalRowWidths: boolean };

const boardLayouts = {
  panorama: { name: 'panorama', rowCounts: [10], equalRowWidths: false },
  wide:     { name: 'wide',     rowCounts: [3, 4, 3], equalRowWidths: false },
  balanced: { name: 'balanced', rowCounts: [3, 4, 3], equalRowWidths: true },
  portrait: { name: 'portrait', rowCounts: [2, 3, 3, 2], equalRowWidths: false },
  ribbon:   { name: 'ribbon',   rowCounts: [1, 2, 1, 2, 1, 2, 1], equalRowWidths: true },
} satisfies Record<string, BoardLayout>;

const getBoardLayout = (ratio: number): BoardLayout => {
  if (ratio >= 2.28) return boardLayouts.panorama;
  if (ratio >= 1.5) return boardLayouts.wide;
  if (ratio >= 1) return boardLayouts.balanced;
  if (ratio >= 0.5) return boardLayouts.portrait;
  return boardLayouts.ribbon;
};

const splitRows = (items: any[], rowCounts: number[]) => {
  let cursor = 0;
  return rowCounts
    .map(count => {
      const row = items.slice(cursor, cursor + count);
      cursor += count;
      return row;
    })
    .filter(row => row.length > 0);
};

// ---------------------------------------------------------------------------
// Layout shell
// ---------------------------------------------------------------------------

function Layout({ children, onRefresh, autoRefresh, setAutoRefresh, refreshCount, loading }: {
  children: React.ReactNode;
  onRefresh: () => void;
  autoRefresh: 'Off' | number;
  setAutoRefresh: (val: 'Off' | number) => void;
  refreshCount: number;
  loading?: boolean;
}) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      onRefresh();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] font-sans text-gray-900 relative overflow-x-hidden">
      {/* Top Banner */}
      <header className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-start shrink-0 relative z-20">
        <Link
          to="/"
          onClick={handleLogoClick}
          className="font-sans font-semibold text-sm leading-none tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
        >
          Dooky Detective{isHome && loading ? ' - Loading' : ''}
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center overflow-x-hidden relative z-10 bg-[#eef0f2] px-[36px]">
        <div className="pointer-events-none absolute left-[36px] top-0 bottom-0 z-[5] border-l border-[#e5e5e5]" />
        <div className="pointer-events-none absolute right-[36px] top-0 bottom-0 z-[5] border-r border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-[5] border-t border-[#e5e5e5]" />
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 z-[5] border-b border-[#e5e5e5]" />
        {children}
      </main>

      {/* Bottom Banner */}
      <footer className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-3 text-xs text-gray-500 font-sans">
          {isHome && (
            <>
              <span className="font-semibold">Refresh:</span>
              {(['Off', 10, 30, 60, 120] as const).map(val => (
                <button
                  key={val}
                  onClick={() => setAutoRefresh(val)}
                  className={`hover:text-[#de8bf7] transition-colors duration-300 ${autoRefresh === val ? 'text-gray-900 font-bold' : ''}`}
                >
                  {val}
                </button>
              ))}
            </>
          )}
        </div>
        <p className="m-0 leading-none text-gray-500 text-sm font-sans">
          &copy; {new Date().getFullYear()}{' '}
          <a
            href="https://jeffersonwm.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Jefferson Williams
          </a>
          . All rights reserved.{` `}
          <a
            href="https://github.com/wmjefferson/dookydetective"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            GitHub
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home board
// ---------------------------------------------------------------------------

function Home({ media, onLoadingChange }: { media: any[]; onLoadingChange?: (loading: boolean) => void }) {
  const [boardReady, setBoardReady] = useState(false);
  // Initialize with actual dimensions immediately — avoids a layout-resize reflow that
  // can cause some browsers to reset the <video> element's playback state mid-stream.
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    let cancelled = false;
    setBoardReady(false);
    onLoadingChange?.(true);

    // Preload photos fully; for videos just preload the poster still
    const preloads = media.map(item =>
      item.type === 'video' ? preloadPoster(item.poster) : preloadPhoto(item.src)
    );

    Promise.allSettled(preloads).finally(() => {
      if (!cancelled) {
        requestAnimationFrame(() => {
          if (!cancelled) {
            setBoardReady(true);
            onLoadingChange?.(false);
          }
        });
      }
    });

    return () => { cancelled = true; };
  }, [media, onLoadingChange]);

  useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  if (media.length === 0) return null;

  const gap = 8;
  const viewportRatio = viewport.height > 0 ? viewport.width / viewport.height : 16 / 9;
  const layout = getBoardLayout(viewportRatio);
  const rows = splitRows(media, layout.rowCounts);

  const rowARs = rows.map(row => row.reduce((sum: number, m: any) => sum + (m.width / m.height), 0));
  const rowGapPixels = rows.map(row => (row.length - 1) * gap);
  const availableWidth = Math.max(320, viewport.width - TOTAL_SIDE_GUTTER);
  const availableHeight = Math.max(320, viewport.height - BANNER_HEIGHT - BANNER_HEIGHT - TOTAL_BANNER_HEIGHT);
  const maxBoardWidth = availableWidth * 0.9;
  const maxBoardHeight = availableHeight * 0.9;
  const totalVerticalGap = gap * (rows.length - 1);
  const minRowHeight = layout.name === 'ribbon' ? 48 : 72;

  const sharedRowHeight = (() => {
    if (layout.equalRowWidths) return 0;
    const heightBound = (maxBoardHeight - totalVerticalGap) / rows.length;
    const widthBound = Math.min(...rowARs.map((ar, i) => (maxBoardWidth - rowGapPixels[i]) / ar));
    return Math.max(minRowHeight, Math.floor(Math.min(heightBound, widthBound)));
  })();

  const equalBoardWidth = (() => {
    if (!layout.equalRowWidths) return 0;
    const inverseAspectSum = rowARs.reduce((sum, ar) => sum + (1 / ar), 0);
    const gapAspectOffset = rowGapPixels.reduce((sum, rowGap, i) => sum + (rowGap / rowARs[i]), 0);
    const heightBoundWidth = (maxBoardHeight - totalVerticalGap + gapAspectOffset) / inverseAspectSum;
    return Math.max(260, Math.floor(Math.min(maxBoardWidth, heightBoundWidth)));
  })();

  const rowHeights = rows.map((_, i) =>
    layout.equalRowWidths
      ? Math.max(minRowHeight, Math.floor((equalBoardWidth - rowGapPixels[i]) / rowARs[i]))
      : sharedRowHeight
  );
  const rowWidths = rows.map((_, i) =>
    layout.equalRowWidths
      ? equalBoardWidth
      : Math.floor(sharedRowHeight * rowARs[i] + rowGapPixels[i])
  );
  const boardWidth = Math.max(...rowWidths);
  const boardHeight = Math.floor(rowHeights.reduce((sum, h) => sum + h, 0) + totalVerticalGap);

  return (
    <div
      className="flex flex-col items-center gap-2 w-full transition-opacity duration-[250ms]"
      data-layout={layout.name}
      style={{
        width: `${boardWidth}px`,
        maxWidth: '90vw',
        maxHeight: '90%',
        minHeight: `${boardHeight}px`,
        opacity: boardReady ? 1 : 0,
      }}
    >
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex flex-row gap-2"
          style={{ width: `${rowWidths[i]}px`, height: `${rowHeights[i]}px` }}
        >
          {row.map((item: any) => (
            <React.Fragment key={item.id}>
              <MediaCard item={item} />
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
function AppContent() {
  const [media, setMedia] = useState<any[]>([]);
  const [serverPool, setServerPool] = useState<any[] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<'Off' | number>('Off');
  const [refreshCount, setRefreshCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try /api/media first; fall back to /api/images for older backends
    fetch(`${API_BASE}/api/media`)
      .then(res => {
        const ct = res.headers.get('content-type');
        if (res.ok && ct?.includes('application/json')) return res.json();
        throw new Error('media endpoint unavailable');
      })
      .catch(() =>
        fetch(`${API_BASE}/api/images`).then(res => {
          const ct = res.headers.get('content-type');
          if (res.ok && ct?.includes('application/json')) return res.json();
          throw new Error('images endpoint unavailable');
        })
      )
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setServerPool(data);
          setMedia(pickValidMediaSet(data));
        } else {
          setServerPool([]);
          setMedia(generatePicsumImages());
        }
      })
      .catch(() => {
        setServerPool([]);
        setMedia(generatePicsumImages());
      });
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    if (serverPool && serverPool.length > 0) {
      setMedia(pickValidMediaSet(serverPool));
    } else {
      setMedia(generatePicsumImages());
    }
    setRefreshCount(c => c + 1);
  }, [serverPool]);

  useEffect(() => {
    if (autoRefresh === 'Off') return;
    const intervalId = setInterval(handleRefresh, (autoRefresh as number) * 1000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, handleRefresh]);

  return (
    <Layout
      onRefresh={handleRefresh}
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      refreshCount={refreshCount}
      loading={loading}
    >
      <Routes>
        <Route path="*" element={<Home media={media} onLoadingChange={setLoading} />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
