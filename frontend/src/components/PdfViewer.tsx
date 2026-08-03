import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, AlertCircle, Download, Loader2 } from 'lucide-react';

interface PdfViewerProps {
  url: string;
  title?: string;
  onDownload?: () => void;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, title, onDownload }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF.js library script dynamically
  const loadPdfJsScript = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
        }
        resolve(window.pdfjsLib);
        return;
      }

      const sources = [
        { js: '/vendor/pdfjs/pdf.min.js', worker: '/vendor/pdfjs/pdf.worker.min.js' },
        { js: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' },
        { js: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js', worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js' },
      ];

      let attempts = 0;

      const tryNext = () => {
        if (attempts >= sources.length) {
          reject(new Error('Gagal memuat engine PDF viewer'));
          return;
        }

        const srcObj = sources[attempts++];
        const scriptId = 'pdfjs-script';
        const oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = srcObj.js;
        script.async = true;
        script.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = srcObj.worker;
            resolve(window.pdfjsLib);
          } else {
            tryNext();
          }
        };
        script.onerror = () => {
          tryNext();
        };
        document.head.appendChild(script);
      };

      tryNext();
    });
  };

  // Fetch PDF file and load document
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setPdfDoc(null);
    setPageNum(1);

    loadPdfJsScript()
      .then((pdfjs) => {
        if (!isMounted) return;
        const loadingTask = pdfjs.getDocument({
          url,
          withCredentials: true,
        });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (!isMounted || !pdf) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('PDF load error:', err);
        if (!isMounted) return;
        setError(err?.message || 'Gagal memuat dokumen PDF');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }
    };
  }, [url]);

  // Render current page onto canvas
  const renderPage = useCallback(
    async (pageNumber: number, targetScale: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      // Cancel previous render task if running
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {}
        renderTaskRef.current = null;
      }

      try {
        const page = await pdfDoc.getPage(pageNumber);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const viewportUnscaled = page.getViewport({ scale: 1.0 });

        // Fit to container width calculation
        let calculatedFitScale = 1.0;
        if (containerRef.current) {
          const containerWidth = Math.max(containerRef.current.clientWidth - 32, 280);
          calculatedFitScale = Math.min(containerWidth / viewportUnscaled.width, 1.5);
        }

        const effectiveScale = targetScale * calculatedFitScale;
        const viewport = page.getViewport({ scale: effectiveScale });

        // Cap pixel ratio to max 2.0 to avoid mobile GPU canvas memory exhaustion
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: ctx,
          transform: transform,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Canvas render error:', err);
        }
      }
    },
    [pdfDoc]
  );

  useEffect(() => {
    if (pdfDoc && pageNum > 0) {
      renderPage(pageNum, scale);
    }
  }, [pdfDoc, pageNum, scale, renderPage]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum((p) => p - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum((p) => p + 1);
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(s + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(s - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  return (
    <div className="flex flex-col w-full h-full bg-neutral-900 rounded-xl overflow-hidden shadow-2xl border border-white/10">
      {/* Control Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-neutral-800/90 border-b border-white/10 text-white text-sm">
        {/* Title */}
        <div className="truncate max-w-[180px] sm:max-w-xs font-medium text-xs sm:text-sm text-neutral-200">
          {title || 'Dokumen PDF'}
        </div>

        {/* Page Navigation Controls */}
        {!isLoading && !error && numPages > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 bg-neutral-950/60 px-2 py-1 rounded-lg border border-white/5">
            <button
              onClick={handlePrevPage}
              disabled={pageNum <= 1}
              className="p-1 rounded hover:bg-white dark:bg-slate-900/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs sm:text-sm font-mono px-1">
              {pageNum} / {numPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={pageNum >= numPages}
              className="p-1 rounded hover:bg-white dark:bg-slate-900/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Halaman Selanjutnya"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Zoom Controls */}
        {!isLoading && !error && (
          <div className="flex items-center gap-1 bg-neutral-950/60 px-2 py-1 rounded-lg border border-white/5">
            <button
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-white dark:bg-slate-900/10 transition-colors"
              title="Perkecil (-)"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-mono px-1 min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-white dark:bg-slate-900/10 transition-colors"
              title="Perbesar (+)"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 rounded hover:bg-white dark:bg-slate-900/10 transition-colors ml-1"
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        )}

        {/* Download Button if provided */}
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Unduh</span>
          </button>
        )}
      </div>

      {/* Main Canvas Viewport Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 bg-neutral-950 hide-scrollbar"
      >
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-white/70 py-12">
            <Loader2 className="animate-spin text-blue-500 dark:text-blue-400" size={36} />
            <p className="text-sm">Memuat PDF...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 text-center p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 max-w-md">
            <AlertCircle size={40} className="text-red-400" />
            <p className="text-sm font-medium">{error}</p>
            {onDownload && (
              <button
                onClick={onDownload}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download size={14} /> Unduh File PDF
              </button>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`shadow-2xl rounded bg-white dark:bg-slate-900 ${
            isLoading || error ? 'hidden' : 'block'
          }`}
        />
      </div>
    </div>
  );
};

