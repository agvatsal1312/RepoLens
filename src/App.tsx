import { useState, useEffect } from 'react';
import { ViewState, User } from './types';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import AuthView from './components/AuthView';
import OverviewView from './components/OverviewView';
import ArchitectureView from './components/ArchitectureView';
import ChatView from './components/ChatView';
import FilesView from './components/FilesView';
import FlowsView from './components/FlowsView';
import InterviewPrepView from './components/InterviewPrepView';
import DocsView from './components/DocsView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';
import ProgressView from './components/ProgressView';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('auth');
  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const fetchProfile = async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else if (response.status === 401 || response.status === 403) {
        handleLogout();
      }
    } catch (error) {
      console.error('Failed to fetch profile', error);
    }
  };

  useEffect(() => {
    if (currentView !== 'auth') {
      fetchProfile();
    }
  }, [currentView]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSidebarDragging) return;
      let newWidth = e.clientX;
      if (newWidth < 120) newWidth = 72; // collapse
      else if (newWidth > 400) newWidth = 400; // max width
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => setIsSidebarDragging(false);

    if (isSidebarDragging) {
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
  }, [isSidebarDragging]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
      setCurrentView('dashboard');
      return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      setCurrentView('dashboard');
    }
  }, []);

  if (currentView === 'auth') {
    return <AuthView onLogin={() => setCurrentView('dashboard')} />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setCurrentRepoId(null);
    setCurrentView('auth');
  };

  const showRepoHeader = !['dashboard', 'progress', 'settings'].includes(currentView);

  return (
    <div className="bg-bg-primary text-text-primary min-h-screen flex font-body-md selection:bg-primary-fixed-dim overflow-hidden font-sans relative">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} width={sidebarWidth} user={user} />
      
      <div 
        className="fixed top-0 bottom-0 z-50 w-1 hover:w-1.5 hover:-ml-0.5 bg-border-base cursor-col-resize hover:bg-primary transition-all"
        style={{ left: `${sidebarWidth}px` }}
        onMouseDown={(e) => { e.preventDefault(); setIsSidebarDragging(true); }}
      />
      
      <div className={`flex-1 flex flex-col h-screen relative w-full ${['files', 'flows', 'docs', 'architecture', 'chat'].includes(currentView) ? 'overflow-hidden' : 'overflow-y-auto'}`} style={{ marginLeft: `${sidebarWidth}px` }}>

        <TopBar onLogout={handleLogout} showRepoInfo={showRepoHeader} repoId={currentRepoId} />
        
        <main className="flex-1 w-full relative min-h-0 flex flex-col">
          <div className="h-full w-full flex-1 flex flex-col">
            {currentView === 'dashboard' ? <div className="p-4 md:p-6 h-full w-full"><DashboardView onSelectRepo={(repoId, isComplete) => { setCurrentRepoId(repoId); setCurrentView(isComplete ? 'overview' : 'progress'); }} onNavigate={setCurrentView} /></div> : null}
            {currentView === 'progress' ? <div className="p-4 md:p-6 h-full w-full"><ProgressView repoId={currentRepoId} onComplete={() => setCurrentView('overview')} /></div> : null}
            <div className={`max-w-container-max mx-auto p-8 ${currentView === 'overview' ? 'block' : 'hidden'}`}>
                <OverviewView repoId={currentRepoId} onNavigate={setCurrentView} />
            </div>
            
            <div className={`h-full ${currentView === 'architecture' ? 'block' : 'hidden'}`}>
                <ArchitectureView repoId={currentRepoId} />
            </div>
            
            <div className={`w-full h-full ${currentView === 'chat' ? 'block' : 'hidden'}`}>
                <ChatView repoId={currentRepoId} />
            </div>
            
            <div className={`absolute inset-0 bg-bg-primary z-10 flex flex-col ${currentView === 'files' ? 'block' : 'hidden'}`}>
                <FilesView repoId={currentRepoId} />
            </div>
            
            <div className={`absolute inset-0 bg-bg-primary z-10 flex flex-col ${currentView === 'flows' ? 'block' : 'hidden'}`}>
                <FlowsView repoId={currentRepoId} />
            </div>
            
            <div className={`max-w-container-max mx-auto p-8 h-full ${currentView === 'interview' ? 'block' : 'hidden'}`}>
                <InterviewPrepView repoId={currentRepoId} />
            </div>
            
            <div className={`h-full flex flex-col ${currentView === 'docs' ? 'flex' : 'hidden'}`}>
                <DocsView repoId={currentRepoId} />
            </div>
            
            <div className={`max-w-container-max mx-auto p-8 ${currentView === 'settings' ? 'block' : 'hidden'}`}>
                <SettingsView user={user} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
