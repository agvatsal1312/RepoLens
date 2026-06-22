import { useState, FormEvent, useEffect } from 'react';
import { ViewState } from '../types';
import { Loader2, ArrowRight, Zap, Code2, Network, X, Link2, BrainCircuit, Compass, BookOpen, LayoutDashboard, FolderTree, GitBranch, MessageSquare, HelpCircle, Github, Mail, Lock, EyeOff, Eye } from 'lucide-react';
import { LogoSVG } from './LogoSVG';

interface AuthViewProps {
  onLogin: () => void;
}

export default function AuthView({ onLogin }: AuthViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { token } = event.data;
        if (token) {
          if (rememberMe) {
            localStorage.setItem('token', token);
          } else {
            sessionStorage.setItem('token', token);
          }
          onLogin();
        }
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token' && event.newValue) {
        onLogin();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [onLogin, rememberMe]);

  const handleGithubLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        throw new Error('Failed to start GitHub authentication');
      }
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        setError('Please allow popups for this site to connect your account.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'GitHub login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { name, email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let data: any = {};
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('Failed to parse response JSON', e);
      }

      if (!response.ok) {
        if (Array.isArray(data.error)) {
          throw new Error(data.error[0]?.message || 'Validation error');
        }
        throw new Error(data.error || 'Authentication failed');
      }

      // Store token based on remember me preferenc
      if (rememberMe) {
        localStorage.setItem('token', data.token);
      } else {
        sessionStorage.setItem('token', data.token);
      }
      onLogin();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-primary/20 overflow-y-auto">
      {/* Geometric background accents */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-multiply" 
        style={{
          background: 'radial-gradient(circle at 15% 50%, rgba(206, 185, 175, 0.4) 0%, transparent 50%), radial-gradient(circle at 85% 30%, rgba(220, 205, 195, 0.4) 0%, transparent 50%)'
        }}>
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-bg-primary/80 backdrop-blur-md border-b border-border-base z-40 flex items-center justify-between px-6 md:px-12">
         <button 
           onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
           className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left cursor-pointer"
           aria-label="Scroll to top"
         >
           <LogoSVG className="w-12 h-12 text-primary" />
           <span className="font-headline-sm font-bold tracking-tight text-2xl text-primary">RepoLens</span>
         </button>
         <div className="flex items-center gap-4 md:gap-6">
           <button 
             onClick={() => { setIsLogin(true); setShowModal(true); }} 
             className="font-label-md text-text-secondary hover:text-text-primary transition-colors hidden md:block"
           >
             Sign In
           </button>
           <button 
             onClick={() => { setIsLogin(false); setShowModal(true); }} 
             className="px-5 py-2.5 bg-primary text-on-primary font-label-md rounded-full hover:bg-primary-hover active:scale-95 transition-all shadow-sm"
           >
             Get Started
           </button>
         </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 pt-32 pb-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-border-base bg-surface-card text-text-secondary tracking-wide font-label-sm mb-10 shadow-sm fade-in-up">
          <Zap size={14} className="text-primary" />
          <span className="uppercase tracking-widest text-[10px]">Analyze. Explore. Understand.</span>
        </div>
        
        <h1 className="text-7xl md:text-[96px] lg:text-[112px] font-headline-lg font-black tracking-[-0.03em] text-text-primary max-w-6xl leading-[1.05] mb-8 fade-in-up" style={{ animationDelay: '100ms' }}>
          Understand Any GitHub Repository in Minutes
        </h1>
        
        <p className="text-lg md:text-xl font-body-md text-text-secondary max-w-3xl mb-12 leading-relaxed fade-in-up" style={{ animationDelay: '200ms' }}>
          Analyze architecture, explore files, visualize workflows, generate documentation, and prepare for interviews using AI.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 fade-in-up w-full sm:w-auto" style={{ animationDelay: '300ms' }}>
          <button 
            onClick={() => { setIsLogin(false); setShowModal(true); }} 
            className="w-full sm:w-auto px-8 py-4 bg-[#3E3228] text-[#F3ECE2] font-label-md font-medium rounded-xl hover:bg-[#2C231C] active:scale-95 transition-all flex items-center justify-center shadow-lg"
          >
            Analyze Repository
          </button>
          <button 
             onClick={() => { document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }} 
             className="w-full sm:w-auto px-8 py-4 bg-surface text-text-primary border border-border-base font-label-md font-medium rounded-xl hover:bg-surface-card active:scale-95 transition-all"
          >
            See How It Works
          </button>
        </div>
        
        {/* Architectural UI Mockup */}
        <div className="w-full max-w-5xl mt-24 relative rounded-2xl border border-border-base bg-surface-card shadow-2xl overflow-hidden aspect-[16/9] md:aspect-auto md:h-[600px] fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="absolute inset-x-0 top-0 h-14 bg-bg-sidebar border-b border-border-base flex items-center px-4 gap-2">
             <div className="flex gap-1.5">
               <div className="w-3 h-3 rounded-full bg-error/80"></div>
               <div className="w-3 h-3 rounded-full bg-status-warning/80"></div>
               <div className="w-3 h-3 rounded-full bg-status-success/80"></div>
             </div>
             <div className="mx-auto w-64 h-6 bg-surface border border-border-base rounded-md"></div>
          </div>
          <div className="flex h-full pt-14">
            <div className="w-64 border-r border-border-base/50 bg-bg-sidebar p-4 hidden md:block">
              <div className="h-6 w-32 bg-border-base/80 rounded mb-8 mt-2"></div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className={`h-8 w-full rounded flex items-center px-3 gap-3 ${i === 2 ? 'bg-primary/10' : ''}`}>
                  <div className={`w-4 h-4 rounded-sm ${i === 2 ? 'bg-primary/40' : 'bg-border-base'}`}></div>
                  <div className={`h-2.5 rounded ${i === 2 ? 'bg-primary/40 w-24' : 'bg-border-base w-20'}`}></div>
                </div>)}
              </div>
            </div>
            <div className="flex-1 p-8 bg-surface-card relative overflow-hidden flex flex-col">
               <div className="flex justify-between items-center mb-8">
                 <div className="h-8 w-48 bg-border-base/80 rounded"></div>
                 <div className="h-8 w-24 bg-primary/10 rounded-full"></div>
               </div>
               <div className="grid grid-cols-3 gap-6 mb-8">
                 {[1,2,3].map(i => <div key={i} className="h-32 bg-surface border border-border-base rounded-xl p-4 flex flex-col justify-end">
                    <div className="h-3 w-16 bg-border-base/50 rounded mb-2"></div>
                    <div className="h-5 w-24 bg-border-base/80 rounded"></div>
                 </div>)}
               </div>
               <div className="flex-1 w-full bg-surface border border-border-base rounded-xl border-dashed flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4 opacity-40">
                    <Network size={48} className="text-text-muted" />
                    <div className="h-4 w-32 bg-border-base rounded"></div>
                  </div>
               </div>
               
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>
          </div>
        </div>

        <div className="mt-32 max-w-6xl mx-auto w-full text-center fade-in-up" style={{ animationDelay: '500ms' }}>
           <h2 className="text-6xl md:text-8xl lg:text-[96px] font-headline-lg font-bold tracking-[-0.02em] text-text-primary mb-6">Intelligent Engineering Workspace</h2>
           <p className="text-text-secondary font-body-md max-w-2xl mx-auto mb-16">
             Transform raw code into meaningful knowledge through our curated AI analysis pipeline.
           </p>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
              <div className="bg-surface-card border border-border-base rounded-2xl p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#3E3228] text-white flex items-center justify-center font-label-sm">1</span>
                    <span className="font-label-sm font-bold tracking-widest uppercase text-[#2C231C]">Initialize</span>
                 </div>
                 <Link2 size={28} className="text-[#3E3228] mb-6" />
                 <h3 className="font-headline-sm font-bold text-[#2C231C] mb-3">Paste URL</h3>
                 <p className="font-body-sm text-[#4E342E] leading-relaxed">
                   Simply paste the GitHub repository URL. Private or public, we handle the handshake.
                 </p>
              </div>
              
              <div className="bg-surface-card border border-border-base rounded-2xl p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#3E3228] text-white flex items-center justify-center font-label-sm">2</span>
                    <span className="font-label-sm font-bold tracking-widest uppercase text-[#2C231C]">Process</span>
                 </div>
                 <BrainCircuit size={28} className="text-[#3E3228] mb-6" />
                 <h3 className="font-headline-sm font-bold text-[#2C231C] mb-3">AI Understands</h3>
                 <p className="font-body-sm text-[#4E342E] leading-relaxed">
                   RepoLens maps symbols, dependencies, and logic patterns across the entire codebase.
                 </p>
              </div>
              
              <div className="bg-surface-card border border-border-base rounded-2xl p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#3E3228] text-white flex items-center justify-center font-label-sm">3</span>
                    <span className="font-label-sm font-bold tracking-widest uppercase text-[#2C231C]">Discover</span>
                 </div>
                 <Compass size={28} className="text-[#3E3228] mb-6" />
                 <h3 className="font-headline-sm font-bold text-[#2C231C] mb-3">Explore</h3>
                 <p className="font-body-sm text-[#4E342E] leading-relaxed">
                   Navigate through high-level architecture diagrams or drill down into specific logic flows.
                 </p>
              </div>
              
              <div className="bg-surface-card border border-border-base rounded-2xl p-8 shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                    <span className="w-8 h-8 rounded-full bg-[#3E3228] text-white flex items-center justify-center font-label-sm">4</span>
                    <span className="font-label-sm font-bold tracking-widest uppercase text-[#2C231C]">Output</span>
                 </div>
                 <BookOpen size={28} className="text-[#3E3228] mb-6" />
                 <h3 className="font-headline-sm font-bold text-[#2C231C] mb-3">Generate Docs</h3>
                 <p className="font-body-sm text-[#4E342E] leading-relaxed">
                   Export professional documentation or prepare for technical interviews with auto-generated Q&A.
                 </p>
              </div>
           </div>
        </div>

        <div id="how-it-works" className="mt-32 max-w-6xl mx-auto w-full text-center">
          <div className="mb-16">
            <h2 className="text-6xl md:text-8xl lg:text-[96px] font-headline-lg font-bold tracking-[-0.02em] text-text-primary mb-6">Sophisticated Tools for the Modern Engineer</h2>
            <p className="text-text-secondary font-body-md max-w-2xl mx-auto">
              Stop reading thousands of lines of code manually. Let RepoLens provide the cognitive map you need to start contributing on day one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <LayoutDashboard className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">Workspace Overview</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">A bird's eye view of the project's health, language distribution, and core module hierarchy.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <Network className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">Architecture Maps</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">Automatically generated dependency graphs and system architecture visualizations that update in real-time.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <MessageSquare className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">Contextual Chat</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">Chat with the code. Ask about specific functions, potential bugs, or historical design decisions.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <FolderTree className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">File Intelligence</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">Deep analysis of individual files, highlighting critical paths and suggesting structural improvements.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <GitBranch className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">Flow Visualization</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">Trace the path of a request or a data mutation across multiple files and services visually.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group">
               <HelpCircle className="text-[#5D4037] mb-6 group-hover:scale-105 transition-transform" size={32} />
               <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-3">Interview Prep</h3>
               <p className="font-body-md text-[#4E342E] leading-relaxed">RepoLens generates tailored questions and answers based on the specific repository's implementation.</p>
            </div>
            <div className="bg-surface border border-border-base rounded-2xl p-8 hover:shadow-md transition-shadow group col-span-1 md:col-span-2 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="max-w-md">
                 <BookOpen className="text-[#5D4037] mb-4 group-hover:scale-105 transition-transform" size={32} />
                 <h3 className="text-2xl font-bold font-headline-sm text-[#2C231C] mb-2">Auto-Documentation</h3>
                 <p className="font-body-md text-[#4E342E] leading-relaxed">Convert obscure code into elegant, searchable, and accurate technical documentation in one click.</p>
               </div>
            </div>
            <div className="bg-[#5D4037] border border-[#4E342E] rounded-2xl p-8 shadow-sm flex flex-col justify-center items-center text-center text-[#F3ECE2]">
               <h3 className="font-headline-md font-medium mb-6">Ready to lens into a project?</h3>
               <button 
                 onClick={() => { setIsLogin(false); setShowModal(true); }}
                 className="px-8 py-3.5 bg-[#F3ECE2] text-[#3E3228] font-label-md font-bold rounded-xl hover:bg-white active:scale-95 transition-all shadow-md"
               >
                 Get Started Free
               </button>
            </div>
          </div>
        </div>
      </main>

      <section className="bg-[#EBE2D5] w-full py-24 px-6 flex flex-col items-center text-center relative z-10 border-t border-border-base mt-12">
        <h2 className="text-6xl md:text-8xl lg:text-[96px] font-headline-lg font-bold tracking-[-0.02em] text-text-primary mb-8">Elevate Your Engineering Workflow</h2>
        <p className="text-text-secondary font-body-md max-w-2xl mb-12">
          Join thousands of lead developers and tech leads who use RepoLens to master complex codebases in record time.
        </p>
        
        <form 
          onSubmit={(e) => {
             e.preventDefault();
             const isValidGithubUrl = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(repoUrlInput);
             if (!isValidGithubUrl) return;

             if(repoUrlInput) {
               sessionStorage.setItem('pendingRepoUrl', repoUrlInput);
             }
             setIsLogin(false);
             setShowModal(true);
          }}
          className="w-full max-w-2xl flex flex-col sm:flex-row items-center gap-2 bg-surface p-2 rounded-2xl shadow-sm border border-border-base"
        >
          <div className="flex-1 flex items-center px-4 py-2 text-text-primary gap-3 w-full">
             <Link2 className="text-text-muted shrink-0" size={20} />
             <input 
               type="url"
               value={repoUrlInput}
               onChange={e => setRepoUrlInput(e.target.value)}
               placeholder="https://github.com/facebook/react"
               className="bg-transparent border-none outline-none w-full font-body-md focus:ring-0 placeholder:text-text-muted/60"
             />
          </div>
          <button 
             type="submit" 
             disabled={!/^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(repoUrlInput)}
             className="w-full sm:w-auto px-8 py-3.5 bg-[#3E3228] text-[#F3ECE2] font-label-md font-medium rounded-xl hover:bg-[#2C231C] active:scale-95 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Start Now
          </button>
        </form>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-base py-12 text-center text-text-muted font-body-sm mt-12 bg-surface">
        <div className="flex items-center justify-center gap-2 mb-4">
          <LogoSVG className="w-6 h-6 grayscale opacity-50" />
          <span className="font-bold tracking-tight">RepoLens</span>
        </div>
        <p>© {new Date().getFullYear()} RepoLens. All rights reserved.</p>
      </footer>

      {/* Auth Fullscreen View */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex flex-col landscape:flex-row md:flex-row bg-[#F9F6F0] overflow-hidden">
          
          <div className="w-full landscape:w-[450px] md:w-[450px] lg:w-[500px] flex-shrink-0 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.04)] z-20 flex flex-col h-full relative overflow-hidden">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 md:hidden landscape:hidden text-text-muted hover:text-text-primary transition-colors bg-white hover:bg-gray-50 border border-border-base p-2.5 rounded-full z-50 shadow-sm"
              aria-label="Close modal"
            >
              <X size={22} />
            </button>

              <div className="flex-1 flex flex-col justify-center p-6 lg:p-10 max-w-[420px] mx-auto w-full">
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center gap-3">
                  <LogoSVG className="w-12 h-12 text-[#5D4037]" />
                  <h1 className="text-4xl font-headline-lg font-bold text-[#5D4037] tracking-tight">RepoLens</h1>
                </div>
                <p className="font-label-sm tracking-[0.2em] text-[#7A5A46] mt-2 uppercase text-[10px] font-semibold">Analyze • Explore • Understand</p>
              </div>

              <form 
                className="space-y-4"
                onSubmit={handleSubmit}
              >
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="block font-label-md text-text-secondary">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={!isLogin}
                      className="w-full bg-transparent border border-border-base rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-body-md"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-label-md text-text-secondary">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-text-muted" />
                    </div>
                    <input 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-transparent border border-border-base rounded-xl pl-11 pr-4 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-body-md font-medium"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                   <label className="block font-label-md text-text-secondary">Password</label>
                   <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-text-muted" />
                    </div>
                    <input 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Enter your password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-transparent border border-border-base rounded-xl pl-11 pr-11 py-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-body-md font-medium placeholder:text-text-muted/40"
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <Eye className="h-5 w-5 text-text-muted hover:text-text-secondary transition-colors" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-text-muted hover:text-text-secondary transition-colors" />
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-status-error/10 border border-status-error/20 rounded-xl text-status-error text-sm font-medium flex items-start gap-2">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between py-1 mt-1">
                  <div className="flex items-center gap-2">
                    <input 
                      id="remember" 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border-base text-[#5D4037] focus:ring-[#5D4037]/50 accent-[#5D4037]"
                    />
                    <label htmlFor="remember" className="font-label-sm text-text-secondary cursor-pointer">Remember me</label>
                  </div>
                  {isLogin && <button type="button" className="font-label-sm font-medium text-[#5D4037] hover:underline">Forgot password?</button>}
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#5D4037] text-white py-3 mt-3 rounded-xl flex items-center justify-center gap-2 font-label-md font-medium transition-all hover:bg-[#4E342E] active:scale-[0.98] disabled:opacity-70 shadow-sm"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
              </form>

              <div className="mt-6 flex items-center gap-4">
                <div className="flex-1 border-t border-border-base"></div>
                <div className="font-label-sm text-text-muted">or continue with</div>
                <div className="flex-1 border-t border-border-base"></div>
              </div>

              <button 
                type="button"
                onClick={handleGithubLogin}
                disabled={isLoading}
                className="w-full mt-4 bg-white border border-border-base py-3 rounded-xl flex items-center justify-center gap-3 font-label-md font-medium text-[#2C231C] hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>

              <div className="mt-8 text-center font-label-md text-text-secondary">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button" 
                  className="text-[#5D4037] hover:underline font-bold ml-1"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </div>
          </div>

          {/* Right side Visual */}
          <div className="hidden landscape:flex md:flex flex-1 bg-[#F9F6F0] p-8 lg:p-12 flex-col justify-center relative overflow-hidden h-full">
             <button 
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 md:top-8 md:right-8 text-[#5D4037]/50 hover:text-[#5D4037] transition-colors p-2 z-50"
                aria-label="Close auth view"
              >
                <X size={28} />
              </button>

              <div className="max-w-2xl mx-auto z-10 w-full xl:pl-8 transform scale-[1.15] landscape:scale-[1.0] md:scale-[1.15] lg:scale-[1.35] xl:scale-[1.55] origin-center">
                <h2 className="text-5xl font-headline-lg font-bold text-[#4E342E] leading-[1.1] mb-6">
                  Understand Any Repository<br/>in Minutes, Not Days.
                </h2>
                <p className="text-xl font-body-md text-[#5D4037] max-w-lg mb-12">
                   Analyze architecture, explore workflows, generate documentation, and chat with your codebase using AI.
                </p>

                {/* Simulated Workflow Diagram UI */}
                <div className="relative h-[400px] w-full flex flex-col items-center">
                  {/* Lines (SVG) */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ top: '60px' }}>
                    {/* Node 1 */}
                    <path d="M 280 40 L 120 140" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <circle cx="120" cy="140" r="3" fill="#CDA487" />
                    
                    {/* Node 2 */}
                    <path d="M 300 60 L 260 120" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <circle cx="260" cy="120" r="3" fill="#CDA487" />

                    {/* Node 3 */}
                    <path d="M 340 60 L 380 120" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <circle cx="380" cy="120" r="3" fill="#CDA487" />

                    {/* Node 4 */}
                    <path d="M 360 40 L 520 100" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <circle cx="520" cy="100" r="3" fill="#CDA487" />
                    
                    {/* Bottom paths to AI assistant */}
                    <path d="M 120 200 L 120 240 L 320 240 L 320 260" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                    <circle cx="320" cy="260" r="3" fill="#CDA487" />

                    <path d="M 520 200 L 520 240 L 320 240" stroke="#CDA487" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
                  </svg>
                  
                  {/* Decorative faint icons in background */}
                  <Code2 className="absolute top-[10%] left-[5%] text-[#E8DCCB] w-32 h-32 opacity-50 -z-10" />
                  <div className="absolute top-[30%] right-[-10%] text-[#E8DCCB] font-mono text-[200px] leading-none opacity-40 font-bold -z-10">&lt;/&gt;</div>

                  {/* Main Github Node */}
                  <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-5 w-[280px] z-10 flex items-center gap-4 relative">
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white shrink-0">
                      <Github size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#2C231C] mb-1">GitHub Repository</div>
                      <div className="font-mono text-xs text-[#5D4037]">agvatsal1312/Chat_App</div>
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#F3ECE2] text-[#5D4037] text-[10px] font-bold rounded-full border border-[#E8DCCB]">
                        <div className="w-1.5 h-1.5 bg-[#CDA487] rounded-full"></div>
                        Analyzed
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full justify-between mt-12 px-0 z-10 gap-3">
                     {/* Architecture Node */}
                     <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-4 w-1/4 flex flex-col relative top-5">
                       <div className="flex items-center gap-1.5 mb-3">
                         <Network size={14} className="text-[#5D4037]" />
                         <span className="font-bold text-[10px] text-[#2C231C] whitespace-nowrap">Architecture Overview</span>
                       </div>
                       <div className="text-[9px] font-medium text-[#5D4037] mb-3">42 Modules<br/>138 Components</div>
                       <div className="flex items-end gap-1 h-12 w-full mt-auto">
                         <div className="flex-1 bg-[#E8DCCB] rounded-sm" style={{ height: '30%' }}></div>
                         <div className="flex-1 bg-[#CDA487] opacity-60 rounded-sm" style={{ height: '60%' }}></div>
                         <div className="flex-1 bg-[#CDA487] rounded-sm" style={{ height: '80%' }}></div>
                         <div className="flex-1 bg-[#E8DCCB] rounded-sm" style={{ height: '40%' }}></div>
                         <div className="flex-1 bg-[#CDA487] opacity-80 rounded-sm" style={{ height: '70%' }}></div>
                       </div>
                     </div>

                     {/* Workflow Node */}
                     <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-4 w-1/4 flex flex-col relative -top-2">
                       <div className="flex items-center gap-1.5 mb-3">
                         <GitBranch size={14} className="text-[#5D4037]" />
                         <span className="font-bold text-[10px] text-[#2C231C] whitespace-nowrap">Workflow Discovery</span>
                       </div>
                       <div className="flex flex-col gap-2 mt-1">
                         <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                           <span className="text-[9px] text-[#5D4037] font-medium">Auth Flow</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                           <span className="text-[9px] text-[#5D4037] font-medium">Message Flow</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                           <span className="text-[9px] text-[#5D4037] font-medium">Notification Flow</span>
                         </div>
                       </div>
                     </div>

                      {/* Ask Node */}
                     <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-4 w-1/4 flex flex-col relative top-2">
                       <div className="flex items-center gap-1.5 mb-2">
                         <MessageSquare size={14} className="text-[#5D4037]" />
                         <span className="font-bold text-[10px] text-[#2C231C] whitespace-nowrap">Ask RepoLens</span>
                       </div>
                       <div className="bg-[#F8F5F2] rounded-md p-2 text-[8px] text-[#5D4037] font-medium leading-relaxed mb-2 flex-grow">
                         How does JWT auth work in this repository?
                       </div>
                       <div className="text-[8px] text-text-muted flex items-center justify-between mt-auto">
                         RepoLens AI...
                         <Zap size={8} className="text-[#CDA487]" />
                       </div>
                     </div>

                     {/* Interview Node */}
                     <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-4 w-1/4 flex flex-col relative -top-4">
                       <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                         <BookOpen size={14} className="text-[#5D4037]" />
                         <span className="font-bold text-[10px] text-[#2C231C]">Interview Prep</span>
                       </div>
                       <div className="text-[9px] font-medium text-[#5D4037] mb-2 leading-tight">25 Questions Generated</div>
                       <div className="flex flex-col gap-1.5 mt-auto">
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-[#E8DCCB] flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                           <div className="h-1.5 bg-[#F3ECE2] rounded-full w-full"></div>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-[#E8DCCB] flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                           <div className="h-1.5 bg-[#F3ECE2] rounded-full w-4/5"></div>
                         </div>
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full bg-[#E8DCCB] flex items-center justify-center"><div className="w-1 h-1 bg-white rounded-full"></div></div>
                           <div className="h-1.5 bg-[#F3ECE2] rounded-full w-5/6"></div>
                         </div>
                       </div>
                     </div>
                  </div>

                  {/* Bottom AI Assistant Node */}
                  <div className="bg-white rounded-xl shadow-sm border border-[#E8DCCB] p-4 w-[280px] z-10 flex items-center gap-4 mt-8 relative left-[20px]">
                    <div className="w-10 h-10 bg-[#5D4037] rounded-full flex items-center justify-center text-[#F3ECE2] shrink-0">
                      <BrainCircuit size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#2C231C]">AI Assistant</div>
                      <div className="text-[10px] text-[#5D4037] mt-0.5 leading-tight">Your intelligent partner for code understanding.</div>
                    </div>
                    <Zap size={16} className="text-[#CDA487] absolute right-4 top-1/2 -translate-y-1/2 opacity-50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}
