import { useState } from 'react';
import { AlertTriangle, Github } from 'lucide-react';
import { User } from '../types';

interface SettingsViewProps {
  user?: User | null;
}

export default function SettingsView({ user }: SettingsViewProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'delete account') return;
    
    setIsDeleting(true);
    setDeleteError('');
    try {
      const token = (localStorage.getItem('token') || sessionStorage.getItem('token'));
      const response = await fetch('/api/auth/profile', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete account');
      }
      
      // Clear token and redirect or reload
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = '/';
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pt-4 pb-8">
      <header className="mb-6">
        <h2 className="font-headline-lg text-text-primary tracking-tight">Workspace Settings</h2>
        <p className="text-text-secondary mt-1 font-body-md">Manage your account preferences, integrations, and workspace configuration.</p>
      </header>

      <div className="space-y-6">
        <section className="bg-surface-card border border-border-base rounded-xl p-6 ink-shadow">
          <div className="mb-4">
            <h3 className="font-headline-md text-text-primary">Profile Information</h3>
            <p className="text-text-muted text-body-sm mt-1">Your identity on RepoLens.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-label-md text-text-secondary block">Display Name</label>
              <input type="text" value={user?.name || 'Loading...'} readOnly disabled className="w-full bg-surface/50 border border-border-base rounded-lg px-4 py-2 font-body-md text-text-secondary opacity-70 cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <label className="font-label-md text-text-secondary block">Email Address</label>
              <input type="email" value={user?.email || 'Loading...'} readOnly disabled className="w-full bg-surface/50 border border-border-base rounded-lg px-4 py-2 font-body-md text-text-secondary opacity-70 cursor-not-allowed" />
            </div>
          </div>
        </section>

        <section className="border border-status-error/30 rounded-xl overflow-hidden ink-shadow bg-surface-card">
          <div className="bg-status-error/5 px-6 py-3 border-b border-status-error/10">
            <h3 className="font-label-md text-status-error flex items-center gap-2">Danger Zone</h3>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-md text-status-error">Delete Account</p>
                <p className="text-text-muted text-body-sm mt-1">Permanently remove your account and all associated data.</p>
              </div>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 bg-primary text-surface font-label-md rounded-lg transition-transform hover:opacity-90 active:scale-95"
              >
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-xl max-w-md w-full p-6 shadow-2xl border border-status-error/20">
            <div className="flex items-center gap-3 text-status-error mb-4">
              <AlertTriangle size={24} />
              <h3 className="font-headline-sm">Delete Account</h3>
            </div>
            
            <p className="text-text-primary font-body-md mb-2">
              This action <strong>cannot</strong> be undone. This will permanently delete your account, repositories, and all associated data.
            </p>
            
            <p className="text-text-secondary font-body-md mb-4 text-sm">
              Please type <strong>delete account</strong> to confirm.
            </p>
            
            <input 
              type="text" 
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              className="w-full bg-surface border border-border-base rounded-lg px-4 py-2.5 mb-4 font-body-md focus:outline-none focus:border-status-error focus:ring-1 focus:ring-status-error"
              placeholder="delete account"
            />
            
            {deleteError && (
              <p className="text-status-error text-sm mb-4">{deleteError}</p>
            )}
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteInput('');
                  setDeleteError('');
                }}
                className="px-4 py-2 bg-surface text-text-primary border border-border-base font-label-md rounded-lg hover:bg-state-hover"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'delete account' || isDeleting}
                className="px-4 py-2 bg-primary text-surface font-label-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
