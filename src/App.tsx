import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
  const [pos, setPos] = useState({ left: -15, top: 50 });
  const [titleReady, setTitleReady] = useState(false);

  const randomizePos = useCallback(() => {
    setPos({
      left: Math.random() * -30,
      top: Math.random() * 100
    });
  }, []);

  useEffect(() => {
    randomizePos();
  }, [randomizePos, refreshCount]);

  useEffect(() => {
    let cancelled = false;
    setTitleReady(false);

    requestAnimationFrame(() => {
      if (!cancelled) {
        setTitleReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refreshCount]);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (isHome) {
      e.preventDefault();
      onRefresh();
      randomizePos();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#eef0f2] font-sans text-gray-900 relative overflow-x-hidden">
      {/* Overlay Title */}
      <Link 
        to="/" 
        onClick={handleLogoClick} 
        className="fixed w-[130vw] text-left text-white font-balsamiq font-normal z-50 text-[18vw] leading-none whitespace-nowrap -translate-y-1/2 transition-opacity duration-[250ms]"
        style={{ 
          left: `${pos.left}vw`,
          top: `${pos.top}vh`,
          letterSpacing: '-0.08em',
          wordSpacing: '0.08em',
          opacity: titleReady ? 1 : 0
        }}
      >
        dooky detective
      </Link>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center py-8 overflow-x-hidden relative z-10">
        {children}
      </main>

      {/* Bottom Banner */}
      <footer className="h-[64px] px-6 bg-[#eef0f2] flex flex-col items-start justify-center shrink-0 relative z-20 gap-1">
        {isHome && (
          <div className="flex items-center gap-3 text-xs text-gray-500 font-sans">
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
          </div>
        )}
        {isHome ? (
          <Link 
            to="/about" 
            className="font-sans font-semibold text-sm tracking-normal text-gray-900 hover:text-[#de8bf7] transition-colors duration-1000 hover:duration-150"
          >
            Jefferson Williams
          </Link>
        ) : (
          <p className="text-gray-500 text-sm font-sans">
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

  const row1 = images.slice(0, 3);
  const row2 = images.slice(3, 7);
  const row3 = images.slice(7, 10);

  const rows = [row1, row2, row3];
  const gap = 8; // 8px gap

  const rowARs = rows.map(row => row.reduce((sum, img) => sum + (img.width / img.height), 0));
  const rowGapPixels = rows.map(row => (row.length - 1) * gap);
  const footerHeight = 64;
  const mainVerticalPadding = 64;
  const availableHeight = Math.max(320, viewport.height - footerHeight - mainVerticalPadding);
  const boardBound = Math.max(280, Math.floor(Math.min(viewport.width || 0, availableHeight) * 0.9));
  const heightLimit = (boardBound - gap * (rows.length - 1)) / rows.length;
  const widthLimit = Math.min(
    ...rowARs.map((rowAR, index) => ((boardBound - rowGapPixels[index]) / rowAR))
  );
  const sharedRowHeight = Math.max(72, Math.floor(Math.min(heightLimit, widthLimit)));
  const boardWidth = Math.max(
    ...rowARs.map((rowAR, index) => Math.floor(sharedRowHeight * rowAR + rowGapPixels[index]))
  );

  return (
    <div
      className="flex flex-col items-center gap-2 w-full transition-opacity duration-[250ms]"
      style={{ width: `${boardWidth}px`, maxWidth: '90vw', opacity: boardReady ? 1 : 0 }}
    >
      {rows.map((row, i) => {
        const rowWidth = Math.floor(sharedRowHeight * rowARs[i] + rowGapPixels[i]);
        
        return (
          <div 
            key={i} 
            className="flex flex-row gap-2"
            style={{ width: `${rowWidth}px`, height: `${sharedRowHeight}px` }}
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
