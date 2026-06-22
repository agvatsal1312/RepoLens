import { useState, useEffect } from 'react';
import { Sparkles, FileText, Info, Copy, Download, Loader2, BookOpen, List } from 'lucide-react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeSlug from 'rehype-slug';

interface DocsViewProps {
  repoId: string | null;
}

const extractToc = (markdown: string) => {
  const toc: { id: string, text: string, level: number }[] = [];
  const lines = markdown.split('\n');
  const headingRegex = /^(#{1,4})\s+(.+)$/;
  lines.forEach(line => {
    const match = line.match(headingRegex);
    if (match) {
      const level = match[1].length;
      let text = match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Extract text from links if any
      text = text.replace(/[*_~`]/g, ''); // Extract markdown formatting
      // simplify text to make slug
      const slug = text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)+/g, '');
      toc.push({ id: slug, text, level });
    }
  });
  return toc;
};

export default function DocsView({ repoId }: DocsViewProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGenerated, setIsGenerated] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [repoLatestHash, setRepoLatestHash] = useState<string | null>(null);

  const handleDownload = () => {
    if (!activeDoc) return;
    const uri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(activeDoc.content);
    const link = document.createElement('a');
    link.href = uri;
    link.download = activeDoc.title || 'document.md';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        const res = await fetch(`/api/repositories/${repoId}/documentation?check=true`, {
          headers: {
            'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
          }
        });
        if (res.ok) {
          const rawData = await res.json();
          if (isMounted && Array.isArray(rawData) && rawData.length > 0 && rawData[0].commitHash) {
             setVersions(rawData);
             const latestVer = rawData[rawData.length - 1];
             setActiveVersion(latestVer.commitHash);
             setDocuments(latestVer.data);
             setActiveDoc(latestVer.data[0]);
             setIsGenerated(true);
          } else if (isMounted && Array.isArray(rawData) && rawData.length > 0) {
             if (!rawData[0].commitHash) {
                setDocuments(rawData);
                setActiveDoc(rawData[0]);
                setIsGenerated(true);
             }
          } else if (isMounted) {
            setDocuments([]);
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

    return () => { isMounted = false; };
  }, [repoId]);

  const fetchDocs = async () => {
    if (!repoId || isLoading || isInitializing) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/repositories/${repoId}/documentation`, {
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // Re-fetch to get versions
        const checkRes = await fetch(`/api/repositories/${repoId}/documentation?check=true`, {
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
             setDocuments(latestVer.data);
             if (latestVer.data.length > 0) setActiveDoc(latestVer.data[0]);
             setIsGenerated(true);
          } else {
             setDocuments(data);
             if (data.length > 0) setActiveDoc(data[0]);
             setIsGenerated(true);
          }
        } else {
          setDocuments(data);
          if (data.length > 0) setActiveDoc(data[0]);
          setIsGenerated(true);
        }
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.error || 'Failed to generate documentation. Please try again later.');
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
        setDocuments(ver.data);
        if (ver.data.length > 0) {
           setActiveDoc(ver.data[0]);
        }
        setIsGenerated(true);
     }
  };

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
    <div className="w-full h-full flex flex-col px-8 pt-2 pb-6 bg-bg-primary overflow-hidden">
      {isViewingOldVersion && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-3 shrink-0">
          <Info size={18} className="text-yellow-600" />
          <p className="text-sm">
            You are viewing documentation generated for an older version of this repository. 
            The repository has been synced to a newer commit.
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4 shrink-0 max-w-7xl mx-auto w-full">
        <div>
          <nav className="flex items-center gap-2 text-text-muted font-label-sm mb-2 uppercase tracking-widest">
            <BookOpen size={16} /> <span>DOCUMENTATION</span>
          </nav>
          <h2 className="font-headline-lg font-bold text-text-primary">Auto-Documentation</h2>
          <p className="font-body-md text-text-secondary mt-2 max-w-2xl">
            Intelligent technical artifacts generated from your codebase architecture.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button 
            onClick={fetchDocs}
            disabled={!canGenerate}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary font-bold text-on-primary rounded-lg font-label-md hover:bg-primary-hover shadow transition-colors disabled:opacity-50"
          >
            {isLoading || isInitializing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} 
            {!canGenerate && isGenerated && !isViewingOldVersion ? 'Documentation Generated' : 'Generate New'}
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

      {isInitializing && documents.length === 0 && (
          <div className="w-full py-20 flex flex-col items-center justify-center text-text-muted shrink-0 max-w-7xl mx-auto">
              <Loader2 size={32} className="animate-spin mb-4 text-primary" />
              <p>Checking existing documentation...</p>
          </div>
      )}

      {isLoading && !isInitializing && documents.length === 0 && (
          <div className="w-full py-20 flex flex-col items-center justify-center text-text-muted shrink-0 max-w-7xl mx-auto">
              <Loader2 size={32} className="animate-spin mb-4 text-primary" />
              <p>Analyzing repository codebase and generating comprehensive documentation...</p>
          </div>
      )}

      {documents.length > 0 && activeDoc && (
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 shrink-0 max-w-7xl mx-auto w-full">
          <div className="flex bg-surface border border-border-base p-1 rounded-xl max-w-full overflow-x-auto styled-scrollbar shadow-sm">
            {documents.map((doc, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveDoc(doc)}
                className={`px-6 py-2 shrink-0 rounded-lg font-label-md transition-colors whitespace-nowrap outline-none ${
                  activeDoc.title === doc.title 
                    ? 'bg-surface-card border border-[#CDA487] text-text-primary shadow-sm font-semibold' 
                    : 'text-text-muted hover:text-text-primary font-medium border border-transparent'
                }`}
              >
                {doc.title}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-start lg:justify-end shrink-0">
            <button 
              onClick={() => navigator.clipboard.writeText(activeDoc.content)}
              className="flex items-center gap-2 px-4 py-2 border border-border-base rounded-lg text-text-secondary font-label-sm hover:bg-bg-sidebar transition-colors shadow-sm bg-surface"
            >
              <Copy size={16} /> Copy
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 border border-border-base rounded-lg text-text-secondary font-label-sm hover:bg-bg-sidebar transition-colors shadow-sm bg-surface"
            >
              <Download size={16} /> Download
            </button>
          </div>
        </div>
      )}

      {documents.length > 0 && activeDoc && (
        <div className="flex-1 min-h-0 flex gap-6 relative max-w-7xl mx-auto w-full pb-4">
          <div className="flex-1 w-full xl:w-3/4 bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm bg-white flex flex-col h-full ring-1 ring-black/5 relative">
            <div className="bg-surface-card border-b border-border-base px-6 py-3 shrink-0 flex items-center gap-2 text-text-secondary font-label-md bg-[#FDFBF7]">
              <FileText size={16} /> {activeDoc.title}
            </div>
            <div className="p-8 md:p-12 bg-white flex-1 overflow-y-auto styled-scrollbar relative">
              <div className="markdown-body prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-strong:text-text-primary prose-ul:text-text-secondary text-text-secondary">
                <Markdown
                  rehypePlugins={[rehypeSlug]}
                  components={{
                    code({node, inline, className, children, ...props}: any) {
                      const match = /language-(\w+)/.exec(className || '')
                      return !inline && match ? (
                        <SyntaxHighlighter
                          {...props}
                          children={String(children).replace(/\n$/, '')}
                          style={vscDarkPlus}
                          language={match[1]}
                          PreTag="div"
                          className="rounded-lg !my-4 !bg-[#1E1E1E] border border-[#3E3228] syntax-highlighter shadow-sm"
                        />
                      ) : (
                        <code {...props} className={`${className} bg-gray-100 rounded px-1.5 py-0.5 text-gray-800 border border-gray-200`}>
                          {children}
                        </code>
                      )
                    }
                  }}
                >
                  {activeDoc.content}
                </Markdown>
              </div>
            </div>
          </div>

          <aside className="hidden xl:block w-1/4 h-full overflow-y-auto styled-scrollbar rounded-xl">
            {extractToc(activeDoc.content).length > 0 && (
              <div className="bg-surface-card border border-border-base rounded-2xl p-6 shadow-sm sticky top-0 bg-[#FDFBF7] ring-1 ring-black/5">
                <h4 className="font-label-md font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <List size={18}/> Contents
                </h4>
                <div className="space-y-2.5">
                  {extractToc(activeDoc.content).map((item, idx) => (
                    <a 
                      key={idx}
                      href={`#${item.id}`}
                      className={`block font-label-sm truncate hover:text-primary transition-colors ${
                        item.level === 1 ? 'text-text-primary font-bold mt-4 first:mt-0 pb-1 border-b border-border-base/50' :
                        item.level === 2 ? 'text-text-secondary pl-2 font-medium' :
                        'text-text-muted pl-5 text-[11px]'
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
