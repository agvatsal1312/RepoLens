import { useState, useRef, useEffect } from 'react';
import { Send, FileCode, Bot, User, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

interface ChatViewProps {
  repoId: string | null;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
};

export default function ChatView({ repoId }: ChatViewProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!repoId) {
        setMessages([]);
        setPage(1);
        setHasMore(false);
        return;
    }
    
    let isMounted = true;
    const fetchHistory = async () => {
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/repositories/${repoId}/chat?limit=50&page=1`, {
                headers: {
                    'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (isMounted && data.messages) {
                    setMessages(data.messages);
                    setPage(1);
                    setHasMore(data.page < data.totalPages);
                }
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
        } finally {
            if (isMounted) setIsHistoryLoading(false);
        }
    };
    
    fetchHistory();
    return () => { isMounted = false; };
  }, [repoId]);

  const loadMoreHistory = async () => {
      if (!repoId || !hasMore || isHistoryLoading) return;
      
      setIsHistoryLoading(true);
      const nextPage = page + 1;
      try {
          const res = await fetch(`/api/repositories/${repoId}/chat?limit=50&page=${nextPage}`, {
              headers: {
                  'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
              }
          });
          if (res.ok) {
              const data = await res.json();
              if (data.messages) {
                  // Prepend older messages
                  setMessages(prev => [...data.messages, ...prev]);
                  setPage(nextPage);
                  setHasMore(data.page < data.totalPages);
              }
          }
      } catch (e) {
          console.error("Failed to load more history", e);
      } finally {
          setIsHistoryLoading(false);
      }
  };

  const handleSend = async () => {
    if (!query.trim() || !repoId || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);
    
    // We will append a placeholder assistant message and update it
    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', sources: [] }]);

    try {
      const response = await fetch(`/api/repositories/${repoId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(localStorage.getItem('token') || sessionStorage.getItem('token'))}`
        },
        body: JSON.stringify({ query: userMessage.content })
      });

      if (!response.ok) {
        let errStr = 'Failed to get answer';
        try {
            const err = await response.json();
            errStr = err.error || errStr;
        } catch(e) {}
        setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, content: `Error: ${errStr}` } : msg));
        setIsLoading(false);
        return;
      }

      if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let done = false;

          let accumulatedContent = '';
          let sources: string[] = [];
          let buffer = '';

          while (!done) {
              const { value, done: doneReading } = await reader.read();
              done = doneReading;
              if (value) {
                  const chunkStr = decoder.decode(value, { stream: true });
                  buffer += chunkStr;
                  
                  const lines = buffer.split('\n');
                  // Keep the last partial line in the buffer
                  buffer = lines.pop() || '';
                  
                  for (const line of lines) {
                      if (line.startsWith('data: ')) {
                          const dataStr = line.substring(6);
                          if (!dataStr) continue;
                          
                          try {
                              const data = JSON.parse(dataStr);
                              
                              if (data.type === 'sources') {
                                  sources = data.sources || [];
                                  setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, sources } : msg));
                              } else if (data.type === 'content') {
                                  accumulatedContent += data.text || '';
                                  setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, content: accumulatedContent } : msg));
                              } else if (data.type === 'error') {
                                  setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, content: accumulatedContent + `\n\nError: ${data.error}` } : msg));
                              }
                          } catch (e) {
                              console.error("Error parsing SSE chunk", e, "Raw:", dataStr);
                          }
                      }
                  }
              }
          }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, content: 'Connection error.' } : msg));
    } finally {
      setIsLoading(false);
    }
  };

  if (!repoId) {
    return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-text-muted">
            No repository selected.
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden px-4 md:px-8">
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col pt-4 pb-4 overflow-hidden">
        {isHistoryLoading && messages.length === 0 ? (
            <div className="flex-1 flex justify-center items-center">
               <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        ) : messages.length === 0 ? (
            <section className="mb-8 text-center shrink-0 my-auto">
              <h2 className="font-headline-lg font-bold text-text-primary mb-2">Repository Research Assistant</h2>
              <p className="font-body-md text-text-secondary max-w-2xl mx-auto">
                Ask complex questions about architecture, specific code flows, or module dependencies.
              </p>
            </section>
        ) : (
            <div className="flex-1 overflow-y-auto space-y-6 pb-20 pr-4 styled-scrollbar mb-4">
              {hasMore && (
                  <div className="flex justify-center pt-2 pb-4">
                      <button 
                          onClick={loadMoreHistory}
                          disabled={isHistoryLoading}
                          className="px-4 py-1.5 rounded-full bg-surface-card border border-border-base text-text-secondary text-xs uppercase tracking-wider font-semibold hover:text-text-primary transition-colors disabled:opacity-50"
                      >
                          {isHistoryLoading ? 'Loading...' : 'Load previous messages'}
                      </button>
                  </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-card border border-border-base text-text-primary'}`}>
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-on-primary' : 'bg-surface-card border border-border-base text-text-primary'}`}>
                      {msg.role === 'user' ? (
                          <div className="whitespace-pre-wrap font-body-md">{msg.content}</div>
                      ) : (
                          <div className="markdown-body prose prose-sm max-w-none dark:prose-invert">
                              <Markdown>{msg.content}</Markdown>
                          </div>
                      )}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.sources.map((src, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-3 py-1 bg-surface-card border border-border-base rounded-md text-xs text-text-secondary">
                            <FileCode size={12} />
                            <span className="truncate max-w-[200px]">{src}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                  <div className="flex gap-4 items-center">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-surface-card border border-border-base text-text-primary flex items-center justify-center">
                       <Bot size={20} />
                    </div>
                    <div className="flex items-center justify-center px-4 py-3 rounded-2xl bg-surface-card border border-border-base">
                      <Loader2 className="animate-spin text-primary" size={20} />
                    </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>
        )}

        <div className="relative shrink-0 border border-border-base rounded-2xl bg-surface-card shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
          <textarea 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            }}
            className="w-full bg-transparent py-4 pl-6 pr-16 font-body-lg text-text-primary focus:outline-none min-h-[80px] resize-none styled-scrollbar" 
            placeholder="Ask about the codebase..."
            disabled={isLoading}
          />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button 
                onClick={handleSend}
                disabled={!query.trim() || isLoading}
                className="bg-primary text-on-primary p-2.5 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
