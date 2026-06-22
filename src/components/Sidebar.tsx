import { LogoSVG } from './LogoSVG';
import { 
  LayoutDashboard, 
  Network, 
  MessageSquare, 
  FolderOpen, 
  GitFork, 
  Settings,
  HelpCircle,
  FileText,
  GraduationCap
} from 'lucide-react';
import { ViewState, User } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  width: number;
  user?: User | null;
}

export default function Sidebar({ currentView, onViewChange, width, user }: SidebarProps) {
  const isCollapsed = width <= 90;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || '?';
  };

  const sections = [
    {
      title: 'Understand',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'architecture', label: 'Architecture', icon: Network },
        { id: 'files', label: 'Files', icon: FolderOpen },
        { id: 'flows', label: 'Flows', icon: GitFork },
      ]
    },
    {
      title: 'Explore',
      items: [
        { id: 'chat', label: 'Repository Chat', icon: MessageSquare },
      ]
    },
    {
      title: 'Prepare',
      items: [
        { id: 'interview', label: 'Interview Prep', icon: GraduationCap },
        { id: 'docs', label: 'Documentation', icon: FileText },
      ]
    }
  ] as const;

  return (
    <aside 
      className="fixed left-0 top-0 h-full bg-bg-sidebar border-r border-border-base flex flex-col py-4 px-4 z-50 overflow-hidden"
      style={{ width: `${width}px` }}
    >
      <div className={`mb-4 cursor-pointer group flex flex-col ${isCollapsed ? 'items-center px-0' : 'px-2'}`} onClick={() => onViewChange('dashboard')}>
        {isCollapsed ? (
          <LogoSVG className="w-10 h-10 mb-1" />
        ) : (
          <div className="flex items-center gap-3">
            <LogoSVG className="w-12 h-12 shrink-0" />
            <div className="flex flex-col">
              <h1 className="font-headline-lg text-primary font-bold group-hover:text-primary-hover transition-colors leading-none tracking-tight text-[32px] mt-1 -ml-1">
                RepoLens
              </h1>
              <p className="font-label-md text-text-muted mt-1.5 uppercase tracking-widest text-[9px] font-bold -ml-1">Analyze • Explore • Understand</p>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto overflow-x-hidden p-1 -m-1">
        {sections.map((section, idx) => (
          <div key={idx} className={isCollapsed ? 'flex flex-col items-center' : ''}>
            {!isCollapsed && (
              <h3 className="px-3 mb-1 font-label-md text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <div className={`space-y-0.5 ${isCollapsed ? 'w-full px-1' : ''}`}>
              {section.items.map((item) => {
                const isActive = currentView === item.id;
                const Icon = item.icon;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id as ViewState)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 transition-all duration-150 ease-linear font-label-md ${
                      isCollapsed ? 'w-10 h-10 justify-center rounded-lg mx-auto' : 'w-full px-3 py-1.5 rounded-lg'
                    } ${
                      isActive
                        ? isCollapsed ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-state-hover text-primary border-l-4 border-primary rounded-l-none'
                        : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'
                    }`}
                  >
                    <Icon size={isCollapsed ? 20 : 18} className={`shrink-0 ${isActive ? 'text-primary' : 'text-text-muted'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mt-2 border-t border-border-base pt-2 ${isCollapsed ? 'flex flex-col items-center space-y-1' : 'space-y-1'}`}>
        <button 
          onClick={() => onViewChange('settings')}
          title={isCollapsed ? "Settings" : undefined}
          className={`flex items-center transition-colors font-label-md ${
            isCollapsed ? 'w-10 h-10 justify-center rounded-lg' : 'w-full gap-3 px-3 py-2 rounded-lg'
          } ${currentView === 'settings' ? 'text-primary bg-state-hover' : 'text-text-muted hover:text-text-primary hover:bg-state-hover'}`}
        >
          <Settings size={isCollapsed ? 20 : 18} />
          {!isCollapsed && <span>Settings</span>}
        </button>
        <button 
          title={isCollapsed ? "Help" : undefined}
          className={`flex items-center text-text-muted hover:text-text-primary hover:bg-state-hover transition-colors font-label-md ${
            isCollapsed ? 'w-10 h-10 justify-center rounded-lg' : 'w-full gap-3 px-3 py-2 rounded-lg'
          }`}
        >
          <HelpCircle size={isCollapsed ? 20 : 18} />
          {!isCollapsed && <span>Help</span>}
        </button>
        
        {user && (
          <div className={`mt-2 flex items-center ${isCollapsed ? 'justify-center w-full px-0' : 'gap-3 px-3'}`}>
            <div className="w-8 h-8 rounded-full bg-secondary-container flex shrink-0 items-center justify-center text-on-secondary-container font-bold text-xs" title={user.name}>
              {getInitials(user.name)}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden text-left flex-1 min-w-0">
                <p className="font-label-md truncate text-text-primary">{user.name}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
