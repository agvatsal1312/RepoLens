import { useState, useEffect } from 'react';
import { ViewState } from '../types';
import { Terminal, CheckCircle2, GitPullRequest, Code, AlertTriangle, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProgressViewProps {
  repoId: string | null;
  onComplete: () => void;
}

const STEPS = [
  { id: 'pending', label: 'Initializing', icon: Terminal },
  { id: 'cloning', label: 'Cloning Repository', icon: GitPullRequest },
  { id: 'syncing', label: 'Synchronizing Latest Changes', icon: Database },
  { id: 'parsing', label: 'Parsing & Embedding Source Code', icon: Code },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
];

export default function ProgressView({ repoId, onComplete }: ProgressViewProps) {
  const [currentStatus, setCurrentStatus] = useState<string>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!repoId) return;

    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/repositories/${repoId}`, {
          headers: {
            'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
          }
        });
        if (response.ok) {
          try {
            const data = await response.json();
            setCurrentStatus(data.status);
            
            if (data.status === 'failed') {
              setErrorMessage(data.errorMessage || 'Unknown error occurred');
              clearInterval(intervalId);
            } else if (data.status === 'completed') {
              clearInterval(intervalId);
              setTimeout(() => {
                onComplete();
              }, 1000);
            }
          } catch(e) {
            console.error("Failed to parse", e);
          }
        } else if (response.status === 404 || response.status === 401 || response.status === 403) {
          clearInterval(intervalId);
          setErrorMessage('Repository not found or access denied');
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    };

    pollStatus();
    intervalId = setInterval(pollStatus, 2000);

    return () => clearInterval(intervalId);
  }, [repoId, onComplete]);

  if (!repoId) return null;

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStatus) !== -1 
    ? STEPS.findIndex(s => s.id === currentStatus) 
    : STEPS.length; // Assume completed/failed if not found

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] max-w-2xl mx-auto">
      <div className="bg-surface-card border border-border-base rounded-2xl p-10 w-full shadow-sm">
        <div className="text-center mb-10">
          <Terminal size={48} className="mx-auto text-primary mb-4 opacity-80" />
          <h2 className="font-headline-md font-bold text-text-primary">Analyzing Repository</h2>
          <p className="font-body-md text-text-muted mt-2">This usually takes a few minutes.</p>
        </div>

        {currentStatus === 'failed' ? (
          <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl flex items-start gap-4">
            <AlertTriangle className="text-status-error shrink-0" />
            <div>
              <h3 className="font-bold text-status-error mb-1">Analysis Failed</h3>
              <p className="text-sm text-status-error/80">{errorMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {STEPS.map((step, index) => {
              const isCompleted = index < currentStepIndex || currentStatus === 'completed';
              const isCurrent = index === currentStepIndex && currentStatus !== 'completed';
              const Icon = step.icon;
              
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-4 transition-opacity duration-500 ${
                    isCompleted || isCurrent ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className="relative">
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-primary"
                      >
                        <CheckCircle2 size={24} />
                      </motion.div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-border-base" />
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 flex-1">
                    <Icon size={18} className={isCurrent ? 'text-primary' : 'text-text-muted'} />
                    <span className={`font-label-md ${isCurrent ? 'text-text-primary font-semibold' : 'text-text-secondary'}`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
