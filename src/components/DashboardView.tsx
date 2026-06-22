import { useState, useEffect } from 'react';
import { Github, Clock, ArrowRight, Loader2, Trash2, X, AlertCircle } from 'lucide-react';
import { ViewState } from '../types';
import { LogoSVG } from './LogoSVG';

interface DashboardViewProps {
  onSelectRepo: (repoId: string, isComplete: boolean) => void;
  onNavigate: (view: ViewState) => void;
}

export default function DashboardView({ onSelectRepo, onNavigate }: DashboardViewProps) {
  const [githubUrl, setGithubUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [repoToDelete, setRepoToDelete] = useState<any>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchRepositories();
    
    // Check for pending repo analysis
    const pendingRepo = sessionStorage.getItem('pendingRepoUrl');
    if (pendingRepo) {
      setGithubUrl(pendingRepo);
      sessionStorage.removeItem('pendingRepoUrl');
      // We need to wait for state to update or just pass it directly to handleAnalyze
      // Let's create a variant of handleAnalyze that takes the URL
      handleAnalyzeUrl(pendingRepo);
    }
  }, []);

  const isValidGithubUrl = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(githubUrl);

  const handleAnalyzeUrl = async (urlToAnalyze: string) => {
    if (!urlToAnalyze.trim() || isAnalyzing) return;
    setErrorMsg('');
    setIsAnalyzing(true);
    setGithubUrl(urlToAnalyze);
    try {
      const response = await fetch('/api/repositories/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ githubUrl: urlToAnalyze })
      });
      
      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('Failed to parse response JSON', e);
      }
      
      if (response.ok) {
        setGithubUrl('');
        onSelectRepo(data.repository?._id || data._id, false);
      } else {
        setErrorMsg(data.error || 'Invalid URL or repository does not exist.');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Error connecting to server to analyze repository.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const response = await fetch('/api/repositories', {
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      });
      if (response.ok) {
        try {
          const data = await response.json();
          setRepositories(data);
        } catch(e) {
          console.error("Failed to parse repos", e);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleAnalyze = () => {
    if (isValidGithubUrl && !isAnalyzing) {
      handleAnalyzeUrl(githubUrl);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, repo: any) => {
    e.stopPropagation();
    setRepoToDelete(repo);
    setDeleteInput('');
  };

  const confirmDelete = async () => {
    if (!repoToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/repositories/${repoToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      });
      if (response.ok) {
        setRepoToDelete(null);
        fetchRepositories(); // Refresh list after deleting
      } else {
        const text = await response.text();
        let errData = {};
        try {
           errData = JSON.parse(text);
        } catch(e) {}
        const errorStr = (errData as any).error;
        const detailStr = (errData as any).details;
        let finalMsg = errorStr || '';
        if (detailStr) finalMsg += `\nDetails: ${detailStr}`;
        if (!finalMsg) finalMsg = `Failed to delete repository: HTTP ${response.status} ${text.substring(0,50)}`;
        alert(finalMsg);
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-[1600px] w-full mx-auto lg:mx-0 relative">
      {repoToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl p-6 max-w-md w-full border border-border-base relative">
            <button 
              onClick={() => setRepoToDelete(null)}
              className="absolute right-4 top-4 text-text-muted hover:text-text-primary"
            >
              <X size={20} />
            </button>
            <h3 className="font-headline-md font-bold text-text-primary mb-2">Delete Repository</h3>
            <p className="font-body-md text-text-secondary mb-4">
              This will permanently delete the analysis data for this repository.
              <br/><br/>
              Type <strong>{repoToDelete.owner}/{repoToDelete.name}</strong> to confirm.
            </p>
            <input 
              type="text" 
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={`${repoToDelete.owner}/${repoToDelete.name}`}
              className="w-full bg-surface-card border border-border-base rounded-lg px-4 py-3 font-body-md text-text-primary focus:outline-none focus:border-red-500 mb-6"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRepoToDelete(null)}
                className="px-4 py-2 font-label-md font-semibold text-text-secondary hover:text-text-primary transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={deleteInput !== `${repoToDelete.owner}/${repoToDelete.name}` || isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-label-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : 'Delete Repository'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area (Left Column) */}
      <div className="flex-1 flex flex-col gap-4 lg:gap-5">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#e8decb]/60 to-surface-card border border-border-base rounded-2xl p-5 lg:p-8 flex justify-between items-center shadow-sm">
          <div className="absolute top-[-80px] right-[50px] w-64 h-64 bg-[#4E342E]/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-[-50px] right-[-50px] w-48 h-48 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 max-w-xl">
            <h1 className="font-headline-lg text-2xl lg:text-3xl font-bold text-text-primary mb-2 lg:mb-3 tracking-tight">Welcome to RepoLens</h1>
            <p className="font-body-md text-text-secondary text-sm lg:text-base mb-4 lg:mb-5 leading-relaxed">
              Your AI-powered technical companion. Paste a GitHub URL to start exploring architecture, generating intelligent documentation, and chatting with codebases seamlessly.
            </p>
            <div className="flex flex-wrap gap-2">
               <div className="flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-text-secondary bg-surface/80 px-2.5 py-1 rounded-full border border-border-base shadow-sm">
                 <Github size={12} className="text-primary" /> Architecture
               </div>
               <div className="flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-text-secondary bg-surface/80 px-2.5 py-1 rounded-full border border-border-base shadow-sm">
                 <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Flows
               </div>
               <div className="flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-text-secondary bg-surface/80 px-2.5 py-1 rounded-full border border-border-base shadow-sm">
                 <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> Chat
               </div>
               <div className="flex items-center gap-1.5 text-[11px] lg:text-xs font-semibold text-text-secondary bg-surface/80 px-2.5 py-1 rounded-full border border-border-base shadow-sm">
                 <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Docs
               </div>
            </div>
          </div>
          
          <div className="relative z-10 hidden md:flex items-center justify-center p-4 lg:p-6 pr-8 lg:pr-12 opacity-90 transition-transform hover:scale-105 duration-500">
            <div className="absolute inset-0 bg-[#e8decb]/50 rounded-full scale-[1.5] -z-10 blur-[50px]"></div>
            <LogoSVG className="w-40 h-40 xl:w-56 xl:h-56 drop-shadow-2xl text-primary" />
          </div>
        </div>

        <div className="bg-surface-card border border-border-base rounded-2xl p-5 lg:p-6 shadow-sm">
          <h2 className="font-headline-md font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Github className="text-primary" />
            Analyze New Repository
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-col">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/organization/repository"
                className={`w-full bg-surface border border-border-base rounded-lg px-4 py-3 font-body-md text-text-primary focus:outline-none focus:ring-1 ${errorMsg ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'focus:border-primary focus:ring-primary'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAnalyze();
                  }
                }}
              />
              {errorMsg && (
                <div className="flex items-center gap-2 text-red-500 mt-2 font-body-sm">
                  <AlertCircle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || !isValidGithubUrl}
              className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md font-semibold hover:bg-primary-hover shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70 self-start w-full sm:w-auto min-w-[160px]"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : 'Start Analysis'}
              {!isAnalyzing && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Side Pane (Right Column) */}
      <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 flex flex-col h-full bg-surface-card border border-border-base rounded-2xl p-6 lg:p-8 shadow-sm min-h-[500px]">
        <h3 className="font-headline-sm font-semibold text-text-primary mb-6 flex items-center gap-2">
          <Clock size={18} className="text-text-muted" />
          Recent Repositories
        </h3>
        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {isLoadingRepos ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : repositories.length === 0 ? (
            <div className="text-sm text-text-muted bg-surface/50 p-6 rounded-lg border border-border-base text-center">
              No repositories analyzed yet.
            </div>
          ) : (
            repositories.map((repo, idx) => (
              <div 
                key={repo._id}
                className="w-full bg-surface border border-border-base rounded-xl p-4 hover:border-primary/50 transition-colors group flex flex-col gap-2 cursor-pointer relative"
                onClick={() => {
                   onSelectRepo(repo._id, repo.status === 'completed');
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="font-label-lg font-semibold text-primary group-hover:text-primary-hover transition-colors truncate pr-6">
                    {repo.owner}/{repo.name}
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(e, repo)}
                    className="absolute top-3 right-3 text-text-muted hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Repository"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="font-label-sm flex items-center gap-1.5">
                     <span className={`w-2 h-2 rounded-full ${repo.status === 'completed' ? 'bg-green-500' : repo.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`}></span>
                     <span className="text-text-muted capitalize">{repo.status}</span>
                  </div>
                  <div className="font-label-sm text-text-muted text-xs">
                    {new Date(repo.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
