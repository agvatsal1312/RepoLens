import { useState, useEffect } from 'react';
import { LogOut, Github, Clock, Layers } from 'lucide-react';

interface TopBarProps {
  onLogout: () => void;
  showRepoInfo?: boolean;
  repoId?: string | null;
}

export default function TopBar({ onLogout, showRepoInfo, repoId }: TopBarProps) {
  const [repo, setRepo] = useState<any>(null);

  useEffect(() => {
    if (!showRepoInfo || !repoId) return;
    fetch(`/api/repositories/${repoId}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}` }
    })
    .then(async res => {
      if (!res.ok) throw new Error('Failed to fetch repo');
      return res.json();
    })
    .then(data => setRepo(data))
    .catch(console.error);
  }, [repoId, showRepoInfo]);

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-border-base flex justify-between items-center w-full px-8 py-3 shrink-0 min-h-[64px]">
      <div className="flex items-center gap-4 flex-1">
        {showRepoInfo && repo && (
          <div className="flex flex-1 items-center justify-between w-full pr-8">
            <div className="flex items-center gap-6">
              <div>
                <h2 className="font-headline-sm font-semibold text-text-primary flex items-center gap-2">
                  {repo.owner}/{repo.name}
                </h2>
                <div className="flex items-center gap-4 mt-1 font-label-sm text-text-muted">
                  <a href={repo.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                    <Github size={12} />
                    {repo.githubUrl.replace('https://', '').replace('http://', '')}
                  </a>
                  <span className="flex items-center gap-1">
                    <Layers size={12} />
                    Repository
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-end mr-4">
              <span className="font-label-sm text-text-muted flex items-center gap-1">
                <Clock size={12} />
                Added
              </span>
              <span className="font-label-md text-text-secondary mt-0.5">
                {new Date(repo.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button onClick={onLogout} title="Log Out" className="p-2 text-text-secondary hover:bg-state-hover rounded-full transition-transform active:scale-90 flex items-center justify-center">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}
