import { useState, useEffect } from 'react';
import { Folder, CheckCircle, Loader2, Sparkles, Star, GitFork, Users, GitCommit, FileText, ArrowRight } from 'lucide-react';

import { ViewState } from '../types';

interface OverviewViewProps {
  repoId: string | null;
  onNavigate: (tab: ViewState) => void;
}

export default function OverviewView({ repoId, onNavigate }: OverviewViewProps) {
  const [repo, setRepo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanged, setHasChanged] = useState(false);
  const [hasUpdatedOnGitHub, setHasUpdatedOnGitHub] = useState(false);
  const [liveCommitsCount, setLiveCommitsCount] = useState<string | null>(null);
  const [liveStats, setLiveStats] = useState<any>({});

  useEffect(() => {
    if (!repoId) return;
    
    setIsLoading(true);
    let interval: ReturnType<typeof setInterval>;

    const fetchRepo = () => {
      fetch(`/api/repositories/${repoId}?ack=true`, {
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to fetch repo');
        return res.json();
      })
      .then(data => {
        setRepo(data);
        setIsLoading(false);
        if (data.hasUpdatedOnGitHub) {
           setHasUpdatedOnGitHub(true);
        }
        if (data.status === 'completed' || data.status === 'failed') {
          if (interval) clearInterval(interval);
          checkLiveCommits(data);
        } else {
          // Status is syncing, cloning, pending, parsing
          if (interval) clearInterval(interval);
          onNavigate('progress');
        }
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
        if (interval) clearInterval(interval);
      });
    };

    const checkLiveCommits = async (repoData: any) => {
      try {
        const ts = Date.now();
        const ghRes = await fetch(`https://api.github.com/repos/${repoData.owner}/${repoData.name}?t=${ts}`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store'
        });
        
        let newLiveStats: any = {};
        if (ghRes.ok) {
           const ghData = await ghRes.json();
           newLiveStats.stars = ghData.stargazers_count;
           newLiveStats.forks = ghData.forks_count;
           if (ghData.license && ghData.license.spdx_id) {
             newLiveStats.license = ghData.license.spdx_id;
           }
        }

        const commitsRes = await fetch(`https://api.github.com/repos/${repoData.owner}/${repoData.name}/commits?per_page=1&t=${ts}`, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-store'
        });
        if (commitsRes.ok) {
          const cLink = commitsRes.headers.get('link');
          let liveCommits = null;
          if (cLink) {
            const m = cLink.match(/[?&]page=(\d+)>; rel="last"/);
            if (m) liveCommits = m[1];
          } else {
            const cData = await commitsRes.json();
            liveCommits = cData.length.toString();
          }

          if (liveCommits) {
            setLiveCommitsCount(liveCommits);
            newLiveStats.commits = liveCommits;
            
            setLiveStats(newLiveStats);

            const storedCommits = repoData.stats?.commits;
            if (storedCommits && storedCommits !== 'Unknown' && storedCommits !== liveCommits) {
              setHasChanged(true);
            } else if (!storedCommits || storedCommits === 'Unknown' || storedCommits === '0') {
               // Update it locally just for UI if missing, but we can also offer analyze again
               // setHasChanged(true);
            }
          }
        }
      } catch (err) {
        console.error('Failed to check live stats:', err);
      }
    };

    fetchRepo();
    interval = setInterval(fetchRepo, 30000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [repoId]);

  const handleAnalyzeAgain = async () => {
    try {
      await fetch(`/api/repositories/${repoId}/reanalyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        }
      });
      setHasChanged(false);
      onNavigate('progress');
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading && !repo) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!repo || repo.error || !repo.owner) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-text-secondary font-body-md">
        Failed to load repository data or no repository selected.
      </div>
    );
  }

  if (repo && repo.status !== 'completed' && repo.status !== 'failed') {
     return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
           <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
           <p className="font-label-md text-text-secondary">Analysis in progress. Navigating...</p>
        </div>
     );
  }

  const stats = repo?.stats || {};
  const folderSummary = repo?.folderSummary || [];
  const features = repo?.features || [];
  const techStack = repo?.techStack || {};

  // Use live stats dynamically if available
  const displayStars = liveStats.stars !== undefined ? liveStats.stars : (stats.stars ?? '0');
  const displayForks = liveStats.forks !== undefined ? liveStats.forks : (stats.forks ?? '0');
  const displayLicense = liveStats.license && liveStats.license !== 'Unknown' ? liveStats.license : (stats.license ?? 'Unknown');
  const displayCommits = liveStats.commits && liveStats.commits !== 'Unknown' ? liveStats.commits : (stats.commits ?? 'Unknown');
  const statContributors = stats.contributors ?? 'Unknown';

  const formatNum = (v: any) => {
    if (v === 'Unknown') return 'Unknown';
    const n = Number(v);
    return isNaN(n) ? v : n.toLocaleString();
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-12">
      <section>
        {hasUpdatedOnGitHub && (
          <div className="bg-status-success/10 border border-status-success rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-status-success/20 flex items-center justify-center text-status-success">
                <CheckCircle size={18} />
              </div>
              <div>
                <h4 className="font-label-md font-bold text-text-primary">Repository Synchronized</h4>
                <p className="text-text-secondary font-body-sm">
                  This repository was updated on GitHub since your last visit. We've automatically synchronized it, so you're now seeing the latest version.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setHasUpdatedOnGitHub(false)} className="text-text-muted hover:text-text-primary transition-colors p-2">
                ✕
              </button>
            </div>
          </div>
        )}

        {hasChanged && !hasUpdatedOnGitHub && (
          <div className="bg-surface-base border border-status-warning rounded-xl p-4 mb-6 shadow-sm flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-status-warning/10 flex items-center justify-center text-status-warning">
                <GitCommit size={18} />
              </div>
              <div>
                <h4 className="font-label-md font-bold text-text-primary">Repository has Updates</h4>
                <p className="text-text-secondary font-body-sm">
                  The repository on GitHub has changed since your last analysis. 
                  {liveCommitsCount && ` (Live Commits: ${liveCommitsCount})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleAnalyzeAgain}
                className="bg-primary hover:bg-primary-hover text-surface px-4 py-2 rounded-lg font-label-md transition-colors"
               >
                Analyze Again
              </button>
              <button onClick={() => setHasChanged(false)} className="text-text-muted hover:text-text-primary transition-colors p-2">
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Folder size={20} className="text-text-muted" />
              <span className="text-text-muted font-label-md tracking-wider">REPOSITORY</span>
            </div>
            <h2 className="font-headline-lg font-bold text-text-primary mb-2">{repo.owner}/{repo.name}</h2>
            <div className="flex items-center gap-4 text-text-secondary">
              <a href={repo.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors font-label-md">
                {repo.githubUrl.replace('https://', '')}
              </a>
              <span className="w-1.5 h-1.5 rounded-full bg-border-base"></span>
              <span className="font-label-md capitalize">Status: {repo.status}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
             <span className="px-4 py-1.5 bg-secondary-fixed text-on-secondary-fixed rounded-full font-label-sm flex items-center gap-1.5 border border-outline-variant">
               <span className={`w-2 h-2 rounded-full ${repo.status === 'completed' ? 'bg-status-success' : 'bg-primary animate-pulse'}`}></span> {repo.status === 'completed' ? 'Parsed' : 'Parsing'}
             </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        {/* Main Summary & Content Column */}
        <div className="col-span-12 md:col-span-8 space-y-8">
          
          {/* What This Project Does */}
          <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
            <h3 className="font-headline-md font-medium text-text-primary mb-4 flex items-center gap-2">
              <Sparkles className="text-secondary w-5 h-5" /> What This Project Does
            </h3>
            <p className="text-text-secondary font-body-md leading-relaxed whitespace-pre-wrap">
              {repo.summary || (
                <span className="italic">(AI Analysis not yet completed. This repository contains {repo.name} by {repo.owner}.)</span>
              )}
            </p>
            {repo.summary && (
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="flex items-center gap-3 bg-surface-base border border-outline-variant rounded-lg px-4 py-3">
                  <div className="bg-primary/5 p-2 rounded text-primary">
                    <Folder size={18} />
                  </div>
                  <div>
                    <div className="text-text-muted font-label-sm uppercase tracking-wider mb-0.5">TYPE</div>
                    <div className="font-label-md font-bold text-text-primary">Software Project</div>
                  </div>
                </div>
                {displayLicense && displayLicense !== 'Unknown' && (
                  <div className="flex items-center gap-3 bg-surface-base border border-outline-variant rounded-lg px-4 py-3">
                    <div className="bg-primary/5 p-2 rounded text-primary">
                      <FileText size={18} />
                    </div>
                    <div>
                      <div className="text-text-muted font-label-sm uppercase tracking-wider mb-0.5">LICENSE</div>
                      <div className="font-label-md font-bold text-text-primary">{displayLicense}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Features */}
          {features && features.length > 0 && (
            <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
              <h3 className="font-headline-md font-medium text-text-primary mb-6">Main Features</h3>
              <div className="space-y-5">
                {features.map((feature: any, idx: number) => {
                  const title = feature?.title || (typeof feature === 'string' ? feature : 'Feature');
                  const desc = feature?.description || '';
                  return (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full border border-status-success text-status-success flex items-center justify-center">
                        <CheckCircle size={14} />
                      </div>
                      <div>
                        <div className="font-label-md font-bold text-text-primary mb-1">{title}</div>
                        {desc && <div className="text-text-secondary font-body-sm leading-relaxed">{desc}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Technology Stack */}
          {techStack && Object.keys(techStack).length > 0 && techStack?.languages && (
            <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
              <h3 className="font-headline-md font-medium text-text-primary mb-6">Technology Stack</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(techStack).map(([key, value]) => {
                  if (!value || value === 'Unknown') return null;
                  return (
                    <div key={key} className="bg-surface-base border border-outline-variant rounded-lg px-4 py-3">
                      <div className="text-text-muted font-label-sm uppercase tracking-wider mb-1">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="text-text-primary font-label-md font-bold">{String(value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Folder Structure Summary */}
          <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-md font-medium text-text-primary">Folder Structure Summary</h3>
              <button 
                onClick={() => onNavigate('files')}
                className="text-primary hover:text-primary-hover font-label-sm flex items-center gap-1 transition-colors"
              >
                View Full Tree <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {folderSummary && folderSummary.length > 0 ? (
                folderSummary.map((folderItem: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 border-b border-border-base pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 w-1/3 min-w-[200px]">
                      <Folder size={16} className="text-primary opacity-80" />
                      <span className="font-mono text-sm text-text-primary">{folderItem.folder}/</span>
                    </div>
                    <div className="text-text-secondary font-body-sm flex-1 truncate">
                      {folderItem.description}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-text-secondary font-body-md italic py-4">
                  No folders found in this repository.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Cards Column */}
        <div className="col-span-12 md:col-span-4 space-y-8">
          {/* Repository Info */}
          <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
            <h3 className="font-headline-md font-medium text-text-primary mb-6">Repository Info</h3>
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-body-md flex items-center gap-2">Owner</span>
                <span className="font-mono text-sm font-bold text-text-primary bg-surface-base px-2 py-1 rounded border border-outline-variant">{repo.owner}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-body-md">Added</span>
                <span className="font-mono text-sm font-bold text-text-primary">{new Date(repo.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-body-md flex items-center gap-2"><FileText size={14} className="text-text-muted" /> License</span>
                <span className="font-mono text-sm font-bold text-text-primary">{displayLicense}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-body-md flex items-center gap-2"><GitCommit size={14} className="text-text-muted" /> Commits</span>
                <span className="font-mono text-sm font-bold text-text-primary">{displayCommits}</span>
              </div>
            </div>
          </div>

          {/* Repository Statistics */}
          <div className="bg-surface-card border border-border-base rounded-xl p-8 shadow-sm">
            <h3 className="font-headline-md font-medium text-text-primary mb-6">Repository Statistics</h3>
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Star className="text-[#B8860B] fill-[#B8860B]" size={18} />
                  <span className="text-text-secondary font-body-md">Stars</span>
                </div>
                <span className="text-2xl font-bold text-text-primary font-mono tracking-tight">{formatNum(displayStars)}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <GitFork className="text-text-muted" size={18} />
                  <span className="text-text-secondary font-body-md">Forks</span>
                </div>
                <span className="text-2xl font-bold text-text-primary font-mono tracking-tight">{formatNum(displayForks)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Users className="text-text-muted" size={18} />
                  <span className="text-text-secondary font-body-md">Contributors</span>
                </div>
                <span className="text-2xl font-bold text-text-primary font-mono tracking-tight">{formatNum(statContributors)}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
