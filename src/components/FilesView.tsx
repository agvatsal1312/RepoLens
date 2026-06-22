import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Folder, File as FileIcon, Sparkles, FileCode, Network, ShieldAlert, Loader2 } from 'lucide-react';

interface FilesViewProps {
  repoId: string | null;
}

type FileNode = {
  name: string;
  type: 'file' | 'folder';
  filePath?: string;
  fileId?: string;
  children?: FileNode[];
};

function buildFileTree(files: any[]): FileNode[] {
  const root: FileNode = { name: 'root', type: 'folder', children: [] };
  
  if (!Array.isArray(files)) return [];

  files.forEach(file => {
    if (!file || !file.filePath) return;
    const parts = file.filePath.split('/').filter(Boolean);
    let current = root;
    
    parts.forEach((part: string, i: number) => {
      const isFile = i === parts.length - 1;
      let existing = current.children!.find(c => c.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          type: isFile ? 'file' : 'folder',
          ...(isFile ? { fileId: file._id, filePath: file.filePath } : { children: [] })
        };
        current.children!.push(existing);
      }
      current = existing;
    });
  });
  
  // Sort: folders first, then alphabetically
  const sortTree = (node: FileNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    }
  };
  
  root.children!.forEach(sortTree);
  return root.children!;
}

const FileTreeNode = ({ 
  node, 
  level, 
  selectedFileId, 
  onSelect 
}: { 
  node: FileNode; 
  level: number; 
  selectedFileId: string | null; 
  onSelect: (id: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = node.fileId === selectedFileId;

  // Auto-open if selected descendant
  useEffect(() => {
     if (node.type === 'folder' && node.children && selectedFileId) {
        const hasSelectedChild = (n: FileNode): boolean => {
           if (n.fileId === selectedFileId) return true;
           if (n.children) return n.children.some(hasSelectedChild);
           return false;
        };
        if (hasSelectedChild(node)) {
           setIsOpen(true);
        }
     }
  }, [selectedFileId, node]);

  if (node.type === 'folder') {
    return (
      <div className="select-none">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-text-secondary hover:bg-state-hover hover:text-text-primary rounded-md"
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          {isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <Folder size={14} className="shrink-0 text-amber-500" />
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && node.children?.map((child, i) => (
          <FileTreeNode key={i} node={child} level={level + 1} selectedFileId={selectedFileId} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <div 
      onClick={() => node.fileId && onSelect(node.fileId)}
      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded-md ${isSelected ? 'bg-state-hover border-l-2 border-primary text-text-primary' : 'text-text-secondary hover:bg-state-hover hover:text-text-primary'}`}
      style={{ paddingLeft: `${level * 12 + 28}px` }}
    >
      <FileIcon size={14} className={`shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted'}`} />
      <span className="truncate">{node.name}</span>
    </div>
  );
};

export default function FilesView({ repoId }: FilesViewProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [fileDetails, setFileDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) return;
    setIsLoading(true);
    fetch(`/api/repositories/${repoId}/files?t=${Date.now()}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}` }
    })
    .then(res => {
       if (!res.ok) {
           return res.text().then(text => { throw new Error(`Status ${res.status}: ${text}`); });
       }
       return res.json();
    })
    .then(data => {
      if (Array.isArray(data)) {
        setFiles(data);
        setErrorMsg(null);
        if (data.length > 0) {
          setIsLoading(false);
        } else {
          setIsLoading(false);
          setErrorMsg("Repository has no files.");
        }
      } else {
        console.error('Expected array of files, got:', data);
        setFiles([]);
        setErrorMsg(`Invalid data format from API: ${JSON.stringify(data).substring(0, 50)}`);
        setIsLoading(false);
      }
    })
    .catch(err => {
        console.error("Fetch error:", err);
        setErrorMsg(err.message);
        setIsLoading(false);
    });
  }, [repoId]);

  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const handleFileSelect = (fileId: string) => {
    setIsLoading(true);
    fetch(`/api/repositories/${repoId}/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}` }
    })
    .then(async res => {
      if (!res.ok) throw new Error('Failed to fetch file');
      return res.json();
    })
    .then(data => {
      setSelectedFile(files.find(f => f._id === fileId));
      setFileDetails(data);
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  };

  if (!repoId) return null;

  return (
    <div className="flex w-full h-full bg-bg-primary">
      {/* File List */}
      <section className="w-80 bg-bg-sidebar border-r border-border-base flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-border-base flex justify-between items-center bg-surface shrink-0">
          <h3 className="font-label-md uppercase tracking-wider text-text-muted font-semibold">Repository Files</h3>
        </div>
        <div className="py-2 px-2 font-label-md space-y-0.5 overflow-y-auto flex-1">
          {errorMsg && (
             <div className="p-4 text-red-500 text-sm whitespace-pre-wrap break-words">{errorMsg}</div>
          )}
          {fileTree.map((node, i) => (
            <FileTreeNode 
              key={i} 
              node={node} 
              level={0} 
              selectedFileId={selectedFile?._id || null} 
              onSelect={handleFileSelect} 
            />
          ))}
        </div>
      </section>

      {/* Editor/Details */}
      <section className="flex-1 flex flex-col h-full overflow-hidden bg-surface relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-surface/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {!isLoading && !selectedFile && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-text-muted pb-20">
            <div className="flex flex-col items-center gap-4 text-border-strong">
              <FileIcon size={48} strokeWidth={1} />
              <p className="font-headline-sm text-text-secondary">Select any file</p>
            </div>
          </div>
        )}
        
        {selectedFile && fileDetails && (
          <>
            <div className="flex items-center justify-between px-8 py-4 border-b border-border-base bg-surface shrink-0">
              <div className="flex items-center gap-2 text-text-muted font-label-sm">
                <span className="text-text-primary font-medium">{selectedFile.filePath}</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-surface animate-in fade-in min-h-0">
               <div className="min-w-max p-8">
                 <pre className="text-sm font-mono text-text-secondary whitespace-pre relative">
                   {fileDetails.content}
                 </pre>
               </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
