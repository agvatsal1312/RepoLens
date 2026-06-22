import { useState, useEffect } from 'react';
import { Zap, Brain, CheckSquare, Lightbulb, Bookmark, Loader2, Info } from 'lucide-react';

interface InterviewPrepViewProps {
  repoId: string | null;
}

export default function InterviewPrepView({ repoId }: InterviewPrepViewProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [isGenerated, setIsGenerated] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [repoLatestHash, setRepoLatestHash] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const checkExisting = async () => {
      if (!repoId) return;
      setIsInitializing(true);
      try {
        const rRes = await fetch(`/api/repositories/${repoId}`, {
          headers: {
            'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
          }
        });
        if (rRes.ok) {
           const rData = await rRes.json();
           if (isMounted) setRepoLatestHash(rData.latestCommitHash);
        }

        const res = await fetch(`/api/repositories/${repoId}/interview?check=true`, {
          headers: {
            'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
          }
        });
        if (res.ok) {
          const rawData = await res.json();
          // If rawData is an array of versions (due to check=true)
          if (isMounted && Array.isArray(rawData) && rawData.length > 0 && rawData[0].commitHash) {
             setVersions(rawData);
             const latestVer = rawData[rawData.length - 1];
             setActiveVersion(latestVer.commitHash);
             setQuestions(latestVer.data);
             setIsGenerated(true);
             extractCategories(latestVer.data);
          } else if (isMounted && Array.isArray(rawData) && rawData.length > 0) {
             // Fallback for older non-versioned data or direct data return
             if (!rawData[0].commitHash) {
                setQuestions(rawData);
                setIsGenerated(true);
                extractCategories(rawData);
             }
          } else if (isMounted) {
             setQuestions([]);
             setIsGenerated(false);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    checkExisting();

    return () => { isMounted = false; }
  }, [repoId]);

  const extractCategories = (data: any[]) => {
      const catSet = new Set<string>();
      catSet.add('All');
      data.forEach((q: any) => {
          if (q.category) catSet.add(q.category);
      });
      setCategories(Array.from(catSet));
  };

  const handleFetch = async () => {
    if (!repoId || isLoading || isInitializing) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/interview`, {
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const checkRes = await fetch(`/api/repositories/${repoId}/interview?check=true`, {
          headers: {
            'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
          }
        });
        if (checkRes.ok) {
          const rawData = await checkRes.json();
          if (Array.isArray(rawData) && rawData.length > 0 && rawData[0].commitHash) {
             setVersions(rawData);
             const latestVer = rawData[rawData.length - 1];
             setActiveVersion(latestVer.commitHash);
             setQuestions(latestVer.data);
             setIsGenerated(true);
             extractCategories(latestVer.data);
          } else {
             setQuestions(data);
             setIsGenerated(true);
             extractCategories(data);
          }
        } else {
          setQuestions(data);
          setIsGenerated(true);
          extractCategories(data);
        }
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || 'Failed to generate questions. Please try again.');
      }
    } catch (e) {
      console.error(e);
      alert('An expected error occurred while communicating with the server.');
    } finally {
        setIsLoading(false);
    }
  };

  const selectVersion = (hash: string) => {
     setActiveVersion(hash);
     const ver = versions.find(v => v.commitHash === hash);
     if (ver) {
        setQuestions(ver.data);
        setIsGenerated(true);
        extractCategories(ver.data);
     }
  };

  const filteredQuestions = activeCategory === 'All' 
    ? questions 
    : questions.filter(q => q.category === activeCategory);

  if (!repoId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-text-muted">
        No repository selected.
      </div>
    );
  }

  const isViewingOldVersion = activeVersion && repoLatestHash && activeVersion !== repoLatestHash;
  const canGenerate = !isLoading && !isInitializing && repoLatestHash && !versions.some(v => v.commitHash === repoLatestHash);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in pt-8 h-full absolute inset-0 overflow-y-auto p-12 -mt-10">
      {isViewingOldVersion && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mt-8 mb-4 flex items-center gap-3 shrink-0">
          <Info size={18} className="text-yellow-600" />
          <p className="text-sm">
            You are viewing interview questions generated for an older version of this repository. 
            The repository has been synced to a newer commit.
          </p>
        </div>
      )}

      <div className="flex flex-col mt-4 md:mt-8 md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h2 className="font-headline-xl text-text-primary">Interview Preparation</h2>
          <p className="text-text-secondary max-w-2xl mt-2 font-body-md">
            Master your repository's technical details. RepoLens analyzes your codebase to generate context-aware questions and expert-level answers.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button 
              onClick={handleFetch}
              disabled={!canGenerate}
              className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-label-md ink-shadow hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isLoading || isInitializing ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />} 
            {!canGenerate && isGenerated && !isViewingOldVersion ? 'Questions Generated' : 'Generate New'}
          </button>
          
          {versions.length > 1 && (
             <div className="text-sm border border-border-base bg-surface-card rounded-md shadow-sm p-1 flex">
               <span className="px-2 py-1 text-text-muted font-medium">Version:</span>
               {versions.map(v => (
                 <button 
                    key={v.commitHash}
                    onClick={() => selectVersion(v.commitHash)}
                    className={`px-3 py-1 font-mono text-xs rounded transition-colors ${activeVersion === v.commitHash ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-sidebar'}`}
                 >
                    {v.commitHash ? v.commitHash.substring(0, 7) : 'Older'}
                 </button>
               ))}
             </div>
          )}
        </div>
      </div>

      {questions.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-10">
            {categories.map((cat) => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full font-label-sm border transition-colors ${
                      activeCategory === cat 
                        ? 'bg-primary text-white border-primary' 
                        : 'bg-bg-secondary text-text-secondary hover:bg-state-hover border-border-base'
                  }`}
                >
                  {cat}
                </button>
            ))}
          </div>
      )}

      {isInitializing && questions.length === 0 && (
          <div className="w-full py-20 flex flex-col items-center justify-center text-text-muted">
              <Loader2 size={32} className="animate-spin mb-4 text-primary" />
              <p>Checking existing questions...</p>
          </div>
      )}

      {isLoading && !isInitializing && questions.length === 0 && (
          <div className="w-full py-20 flex flex-col items-center justify-center text-text-muted">
              <Loader2 size={32} className="animate-spin mb-4 text-primary" />
              <p>Analyzing repository architecture and generating relevant questions...</p>
          </div>
      )}

      <div className="space-y-8 pb-12">
        {filteredQuestions.map((q, idx) => (
            <article key={idx} className="bg-surface-card border border-border-base rounded-xl p-8 ink-shadow hover:translate-y-[-2px] transition-transform">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full font-label-sm">{q.category}</span>
                <span className="text-text-muted font-label-sm">Difficulty: {q.difficulty || 'Medium'}</span>
              </div>
              
              <h3 className="font-headline-md text-text-primary mb-6 leading-tight">
                "{q.question}"
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <section>
                    <h4 className="font-label-md text-primary-container uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Brain size={18} /> Why Interviewers Ask This
                    </h4>
                    <p className="text-text-secondary font-body-md">
                      {q.whyAsk || "To gauge your understanding of the repository's fundamental principles and tradeoffs."}
                    </p>
                  </section>
                  <section>
                    <h4 className="font-label-md text-primary-container uppercase tracking-widest mb-2 flex items-center gap-2">
                      <CheckSquare size={18} /> Expected Talking Points
                    </h4>
                    <ul className="space-y-2 text-text-secondary font-body-md list-disc pl-5">
                      {q.talkingPoints?.map((pt: string, j: number) => (
                          <li key={j}>{pt}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="bg-bg-primary rounded-lg p-6 border border-border-base flex flex-col justify-between">
                  <section>
                    <h4 className="font-label-md text-primary-container uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Lightbulb size={18} /> Strong Answer Tips
                    </h4>
                    <p className="text-text-primary font-body-md italic border-l-2 border-primary-container pl-4">
                      "{q.strongAnswer || q.answer}"
                    </p>
                  </section>
                </div>
              </div>
            </article>
        ))}
      </div>
    </div>
  );
}
