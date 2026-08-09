import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const BANNER_HEIGHT = 36;
const SIDE_GUTTER = 36;
const TOTAL_BANNER_HEIGHT = BANNER_HEIGHT * 2;
const TOTAL_SIDE_GUTTER = SIDE_GUTTER * 2;

const pickValidImageSet = (pool: any[]) => {
  if (pool.length < 10) return pool;
  
  let arr = [];
  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    // Shuffle the array
    arr = [...pool].sort(() => 0.5 - Math.random()).slice(0, 10);
    
    // Calculate aspect ratio sums for each row
    const ar1 = arr.slice(0, 3).reduce((sum, img) => sum + (img.width / img.height), 0);
    const ar2 = arr.slice(3, 7).reduce((sum, img) => sum + (img.width / img.height), 0);
    const ar3 = arr.slice(7, 10).reduce((sum, img) => sum + (img.width / img.height), 0);
    
    // Ensure the middle row (4 images) is strictly wider than the top and bottom rows
    if (ar2 > ar1 && ar2 > ar3) {
      return arr;
    }
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
  
  const images = Array.from({ length: 10 }).map((_, i) => {
    const seed = Math.random().toString(36).substring(2, 9);
    const dim = dimensions[Math.floor(Math.random() * dimensions.length)];
    return {
      id: seed,
      src: `https://picsum.photos/seed/${seed}/${dim.w}/${dim.h}`,
      title: `IMG_${seed.toUpperCase()}.JPG`,
      width: dim.w,
      height: dim.h
    };
  });

  return pickValidImageSet(images);
};

function ImageCard({ src, title, width, height }: { src: string, title: string, width: number, height: number }) {
  return (
    <div style={{ flex: width / height, minWidth: 0 }}>
      <img src={src} alt={title} className="w-full h-full object-cover block" referrerPolicy="no-referrer" />
    </div>
  )
}

type BoardLayout = {
  name: string;
  rowCounts: number[];
  equalRowWidths: boolean;
};

const boardLayouts = {
  panorama: {
    name: 'panorama',
    rowCounts: [10],
    equalRowWidths: false,
  },
  wide: {
    name: 'wide',
    rowCounts: [3, 4, 3],
    equalRowWidths: false,
  },
  balanced: {
    name: 'balanced',
    rowCounts: [3, 4, 3],
    equalRowWidths: true,
  },
  portrait: {
    name: 'portrait',
    rowCounts: [2, 3, 3, 2],
    equalRowWidths: false,
  },
  ribbon: {
    name: 'ribbon',
    rowCounts: [1, 2, 1, 2, 1, 2, 1],
    equalRowWidths: true,
  },
} satisfies Record<string, BoardLayout>;

const getBoardLayout = (ratio: number): BoardLayout => {
  if (ratio >= 2) return boardLayouts.panorama;
  if (ratio >= 1.5) return boardLayouts.wide;
  if (ratio >= 1) return boardLayouts.balanced;
  if (ratio >= 0.5) return boardLayouts.portrait;
  return boardLayouts.ribbon;
};

const splitRows = (images: any[], rowCounts: number[]) => {
  let cursor = 0;
  return rowCounts
    .map(count => {
      const row = images.slice(cursor, cursor + count);
      cursor += count;
      return row;
    })
    .filter(row => row.length > 0);
};

function preloadImage(src: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new window.Image();
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') {
          await image.decode();
        }
      } catch {
        // Some browsers can reject decode() for otherwise usable images.
      }
      resolve();
    };
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function Layout({ children, onRefresh, autoRefresh, setAutoRefresh, refreshCount }: { children: React.ReactNode, onRefresh: () => void, autoRefresh: 'Off' | number, setAutoRefresh: (val: 'Off' | number) => void, refreshCount: number }) {
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
          Dooky Detective
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
        {isHome ? (
          <Link 
            to="/about" 
            className="font-sans font-semibold text-sm leading-none tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Jefferson Williams
          </Link>
        ) : (
          <p className="m-0 leading-none text-gray-500 text-sm font-sans">
            Dooky Detective &copy; {new Date().getFullYear()}{' '}
            <a 
              href="https://jeffersonwm.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
            >
              Jefferson Williams
            </a>
            . All rights reserved.{' '}
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
        )}
      </footer>
    </div>
  );
}

function Home({ images }: { images: any[] }) {
  const [boardReady, setBoardReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    setBoardReady(false);

    Promise.all(images.map(image => preloadImage(image.src)))
      .catch(() => {
        // If one image has trouble loading, avoid hanging the whole board forever.
      })
      .finally(() => {
        if (!cancelled) {
          requestAnimationFrame(() => {
            if (!cancelled) {
              setBoardReady(true);
            }
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  if (images.length === 0) return null;

  const gap = 8; // 8px gap
  const viewportRatio = viewport.height > 0 ? viewport.width / viewport.height : 16 / 9;
  const layout = getBoardLayout(viewportRatio);
  const rows = splitRows(images, layout.rowCounts);

  const rowARs = rows.map(row => row.reduce((sum, img) => sum + (img.width / img.height), 0));
  const rowGapPixels = rows.map(row => (row.length - 1) * gap);
  const headerHeight = BANNER_HEIGHT;
  const footerHeight = BANNER_HEIGHT;
  const pagePaddingX = TOTAL_SIDE_GUTTER;
  const mainVerticalPadding = TOTAL_BANNER_HEIGHT;
  const availableWidth = Math.max(320, viewport.width - pagePaddingX);
  const availableHeight = Math.max(320, viewport.height - headerHeight - footerHeight - mainVerticalPadding);
  const maxBoardWidth = availableWidth * 0.9;
  const maxBoardHeight = availableHeight * 0.9;
  const totalVerticalGap = gap * (rows.length - 1);
  const minRowHeight = layout.name === 'ribbon' ? 48 : 72;

  const sharedRowHeight = (() => {
    if (layout.equalRowWidths) return 0;
    const heightBound = (maxBoardHeight - totalVerticalGap) / rows.length;
    const widthBound = Math.min(
      ...rowARs.map((rowAR, index) => (maxBoardWidth - rowGapPixels[index]) / rowAR)
    );
    return Math.max(minRowHeight, Math.floor(Math.min(heightBound, widthBound)));
  })();

  const equalBoardWidth = (() => {
    if (!layout.equalRowWidths) return 0;
    const inverseAspectSum = rowARs.reduce((sum, rowAR) => sum + (1 / rowAR), 0);
    const gapAspectOffset = rowGapPixels.reduce((sum, rowGap, index) => sum + (rowGap / rowARs[index]), 0);
    const heightBoundWidth = (maxBoardHeight - totalVerticalGap + gapAspectOffset) / inverseAspectSum;
    return Math.max(260, Math.floor(Math.min(maxBoardWidth, heightBoundWidth)));
  })();

  const rowHeights = rows.map((_, index) => (
    layout.equalRowWidths
      ? Math.max(minRowHeight, Math.floor((equalBoardWidth - rowGapPixels[index]) / rowARs[index]))
      : sharedRowHeight
  ));
  const rowWidths = rows.map((_, index) => (
    layout.equalRowWidths
      ? equalBoardWidth
      : Math.floor(sharedRowHeight * rowARs[index] + rowGapPixels[index])
  ));
  const boardWidth = Math.max(...rowWidths);
  const boardHeight = Math.floor(rowHeights.reduce((sum, height) => sum + height, 0) + totalVerticalGap);

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
      {rows.map((row, i) => {
        return (
          <div 
            key={i} 
            className="flex flex-row gap-2"
            style={{ width: `${rowWidths[i]}px`, height: `${rowHeights[i]}px` }}
          >
            {row.map(img => (
              <React.Fragment key={img.id}>
                <ImageCard src={img.src} title={img.title} width={img.width} height={img.height} />
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function About() {
  return null;
}

function AppContent() {
  const [images, setImages] = useState<any[]>([]);
  const [serverPool, setServerPool] = useState<any[] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<'Off' | number>('Off');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/images`)
      .then(res => {
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          return res.json();
        }
        throw new Error('PHP script not available');
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setServerPool(data);
          setImages(pickValidImageSet(data));
        } else {
          setServerPool([]);
          setImages(generatePicsumImages());
        }
      })
      .catch(() => {
        // Fallback for local dev or if script is missing
        setServerPool([]);
        setImages(generatePicsumImages());
      });
  }, []);

  const handleRefresh = useCallback(() => {
    if (serverPool && serverPool.length > 0) {
      setImages(pickValidImageSet(serverPool));
    } else {
      setImages(generatePicsumImages());
    }
    setRefreshCount(c => c + 1);
  }, [serverPool]);

  useEffect(() => {
    if (autoRefresh === 'Off') return;
    const intervalId = setInterval(() => {
      handleRefresh();
    }, autoRefresh * 1000);
    return () => clearInterval(intervalId);
  }, [autoRefresh, handleRefresh]);

  return (
    <Layout onRefresh={handleRefresh} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} refreshCount={refreshCount}>
      <Routes>
        <Route path="/" element={<Home images={images} />} />
        <Route path="/about" element={<About />} />
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
