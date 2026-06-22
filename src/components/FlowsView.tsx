import { useState, useEffect } from 'react';
import { Network, Loader2, Plus, MessageSquare, AlertCircle } from 'lucide-react';
import { Mermaid } from './Mermaid';

interface FlowsViewProps {
  repoId: string | null;
}

export default function FlowsView({ repoId }: FlowsViewProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (repoId) {
       fetchFlows();
    }
  }, [repoId]);

  const fetchFlows = async () => {
    try {
      const res = await fetch(`/api/repositories/${repoId}/flows`, {
         headers: { 'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}` }
      });
      if (res.ok) {
         const data = await res.json();
         setFlows(data);
         if (data.length > 0 && !selectedFlowId) {
            setSelectedFlowId('NEW');
         } else if (data.length === 0) {
            setSelectedFlowId('NEW');
         }
      }
    } catch(e) {
      console.error(e);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleGenerate = async () => {
    if (!query.trim() || !repoId || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/flows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        const data = await res.json();
        
        if (data._isCached) {
           showToast(`Found an existing flow matching your intent: "${data.title}"`);
        } else {
           setFlows(prev => [data, ...prev]);
        }
        
        setSelectedFlowId(data._id);
        setQuery('');
      } else {
        const errData = await res.json().catch(() => null);
        showToast(errData?.error || 'Error generating flow.');
      }
    } catch (e) {
      console.error(e);
      showToast('Error generating flow.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        No repository selected.
      </div>
    );
  }

  const selectedFlow = selectedFlowId === 'NEW' ? null : flows.find(f => f._id === selectedFlowId);

  return (
    <div className="flex h-full w-full bg-bg-primary overflow-hidden relative">
      {toastMsg && (
         <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-50 bg-surface-card border border-border-base ink-shadow px-6 py-3 rounded-full flex items-center gap-2 animate-in slide-in-from-top-4">
            <AlertCircle className="text-secondary w-5 h-5" />
            <span className="font-body-md text-text-primary">{toastMsg}</span>
         </div>
      )}

      {/* Sidebar */}
      <section className="w-80 bg-bg-sidebar border-r border-border-base flex flex-col shrink-0 overflow-hidden">
         <div className="p-4 border-b border-border-base bg-surface shrink-0 flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-text-primary">Saved Flows</h3>
            {selectedFlowId !== 'NEW' && (
               <button 
                  onClick={() => setSelectedFlowId('NEW')}
                  className="p-1.5 rounded-md hover:bg-outline-variant/30 text-text-primary transition-colors"
                  title="New Flow Analysis"
               >
                  <Plus size={18} />
               </button>
            )}
         </div>

         <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
            {flows.map(f => (
               <button
                  key={f._id}
                  onClick={() => setSelectedFlowId(f._id)}
                  className={`w-full text-left px-3 py-3 rounded-lg flex flex-col gap-1 transition-colors ${selectedFlowId === f._id ? 'bg-surface-card border border-primary/20 shadow-sm' : 'hover:bg-surface border border-transparent'}`}
               >
                  <span className="font-label-md text-text-primary line-clamp-1 flex items-center gap-2">
                     <Network size={14} className="text-primary shrink-0" /> {f.title}
                  </span>
                  <span className="font-body-sm text-text-muted line-clamp-1 italic">"{f.query}"</span>
               </button>
            ))}
            {flows.length === 0 && (
               <div className="text-center py-8 text-text-muted font-body-sm italic">
                  No flows generated yet.
               </div>
            )}
         </div>
      </section>

      {/* Main Content Area */}
      <section className="flex-1 overflow-y-auto relative p-8">
         {(!selectedFlowId || selectedFlowId === 'NEW') ? (
           <div className="max-w-3xl mx-auto mt-16 animate-in fade-in">
             <div className="flex flex-col gap-2 mb-8 text-center">
               <h2 className="font-headline-lg text-text-primary">Repository Flows</h2>
               <p className="text-text-secondary font-body-md">Visualize complex logic and sequence of events across your codebase using AI-driven architectural mapping.</p>
             </div>

             <div className="bg-surface-card border border-border-base rounded-xl p-8 ink-shadow flex flex-col gap-6">
               <div className="space-y-4">
                 <label className="font-label-md text-text-primary flex items-center gap-2">
                   <MessageSquare className="w-4 h-4 text-secondary" /> Describe a workflow to map
                 </label>
                 <textarea 
                   rows={3}
                   value={query}
                   onChange={(e) => setQuery(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                     }
                   }}
                   placeholder="e.g. Authentication Flow, Payment Webhook Handling..."
                   className="w-full bg-surface border border-border-base rounded-xl px-4 py-4 font-body-md focus:outline-none focus:ring-2 focus:ring-primary-container/20 focus:border-primary-container resize-none"
                 />
               </div>
               <div className="flex justify-end">
                 <button 
                   disabled={isLoading || !query.trim()}
                   onClick={handleGenerate}
                   className="bg-text-primary text-surface px-8 py-3 rounded-lg font-label-md hover:bg-primary transition-colors h-[50px] disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                   {isLoading && <Loader2 size={16} className="animate-spin" />}
                   Generate Flow
                 </button>
               </div>
             </div>
           </div>
         ) : selectedFlow ? (
           <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in pb-16">
              <section className="flex flex-col gap-6">
                 <h3 className="font-headline-md flex items-center gap-2">
                    <Network className="text-primary w-6 h-6" /> {selectedFlow.title || 'Flow Analysis'}
                 </h3>

                 <div className="w-full min-h-[400px] bg-surface-card border border-border-base rounded-xl ink-shadow relative p-8 flex items-center justify-center overflow-auto" style={{ backgroundImage: 'radial-gradient(#DED4C7 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                    <div className="relative w-full max-w-full text-center font-body-lg overflow-auto">
                       <Mermaid chart={selectedFlow.mermaid} />
                    </div>
                 </div>
              </section>

              <section>
                <div className="bg-bg-secondary border border-border-base rounded-xl p-8 ink-shadow">
                   <h4 className="font-headline-md mb-6 border-b border-border-base pb-4">Explanation Card</h4>
                   <p className="text-text-primary font-body-md mb-6">{selectedFlow.summary}</p>
                   <div className="grid grid-cols-1 gap-y-6">
                      {selectedFlow.steps?.map((step: any, idx: number) => (
                        <div className="flex gap-4" key={idx}>
                           <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-label-md shrink-0">
                             {String(idx + 1).padStart(2, '0')}
                           </div>
                           <div>
                              <h5 className="font-bold font-body-md text-text-primary mb-1">{step.title}</h5>
                              <p className="text-text-secondary font-body-sm">{step.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </section>
           </div>
         ) : null}
      </section>
    </div>
  );
}
