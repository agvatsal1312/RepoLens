import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, Download, LayoutTemplate, Server, Loader2 } from 'lucide-react';
import { Mermaid } from './Mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface ArchitectureViewProps {
  repoId: string | null;
}

export default function ArchitectureView({ repoId }: ArchitectureViewProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!repoId) return;
    
    setIsLoading(true);
    fetch(`/api/repositories/${repoId}/architecture`, {
      headers: {
        'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
      }
    })
    .then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to generate architecture diagram');
      }
      return res.json();
    })
    .then(data => {
      setData(data);
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
      setIsLoading(false);
    });
  }, [repoId]);

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-text-muted">
        No repository selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full absolute inset-0 bg-bg-primary">
      {/* Context Header */}
      <div className="px-8 py-5 flex justify-between items-center border-b border-border-base bg-surface shadow-sm z-10 shrink-0">
        <div>
          <h2 className="font-headline-sm font-semibold text-text-primary">Architecture Diagram</h2>
          <p className="font-body-sm text-text-secondary mt-0.5">Interactive system architecture Map</p>
        </div>
        <div className="flex items-center gap-4 border border-border-base rounded-lg p-1 bg-surface-card">
          <button className="px-4 py-1.5 bg-primary text-on-primary rounded-md font-label-md transition-colors shadow-sm">
            High Level
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Canvas */}
        <div className="flex-1 bg-bg-primary relative overflow-hidden flex flex-col p-4 lg:p-8">
            {isLoading ? (
               <div className="flex items-center justify-center h-full">
                 <Loader2 className="animate-spin text-primary" size={32} />
               </div>
            ) : data?.mermaid ? (
               <div className="bg-surface-card border border-border-base rounded-xl shadow-sm flex-1 relative overflow-hidden flex items-center justify-center group h-full">
                 <TransformWrapper
                   initialScale={1}
                   minScale={0.1}
                   maxScale={8}
                   centerOnInit={true}
                   wheel={{ step: 0.1 }}
                 >
                   {({ zoomIn, zoomOut, resetTransform }) => (
                     <>
                       <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 bg-surface border border-border-base rounded-lg shadow-md p-1 opacity-80 hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => zoomIn()} 
                           className="p-2 hover:bg-bg-primary rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                           title="Zoom In"
                         >
                           <ZoomIn size={20} />
                         </button>
                         <button 
                           onClick={() => zoomOut()} 
                           className="p-2 hover:bg-bg-primary rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                           title="Zoom Out"
                         >
                           <ZoomOut size={20} />
                         </button>
                         <button 
                           onClick={() => resetTransform()} 
                           className="p-2 hover:bg-bg-primary rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                           title="Reset View"
                         >
                           <Maximize size={20} />
                         </button>
                       </div>
                       <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                         <div className="cursor-grab active:cursor-grabbing max-w-none max-h-none p-10 min-w-max min-h-max scale-100 transform-none">
                           <Mermaid chart={data.mermaid} />
                         </div>
                       </TransformComponent>
                     </>
                   )}
                 </TransformWrapper>
               </div>
            ) : (
               <div className="flex items-center justify-center h-full text-text-muted">
                 No architecture diagram available.
               </div>
            )}
        </div>

        {/* Resizer */}
        <div 
          className="w-1 bg-border-base cursor-col-resize hover:bg-primary transition-colors shrink-0 z-20"
          onMouseDown={() => setIsDragging(true)}
        />

        {/* Sidebar Insights */}
        <aside 
          className="h-full bg-surface border-l border-border-base overflow-y-auto shrink-0"
          style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '600px' }}
        >
          <div className="p-6 border-b border-border-base bg-surface-card sticky top-0 z-10">
            <h3 className="font-headline-sm font-semibold text-text-primary">Architecture Insights</h3>
            <p className="font-body-sm text-text-secondary mt-1">Detected component behaviors.</p>
          </div>
          <div className="p-6 space-y-8">
             {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
             ) : data?.insights?.map((insight: any, idx: number) => (
                <section key={idx}>
                  <h4 className="font-label-sm text-primary font-semibold uppercase tracking-widest mb-4 flex items-center">
                    <LayoutTemplate size={16} className="mr-2" /> {insight.layer}
                  </h4>
                  <div className="p-4 bg-surface-card rounded-xl border border-border-base mb-3 shadow-sm">
                    <p className="font-body-md font-medium text-text-primary">{insight.title}</p>
                    <p className="font-label-sm text-text-secondary mt-2">{insight.description}</p>
                  </div>
                </section>
             ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
