import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
    });

    if (ref.current) {
      ref.current.innerHTML = '';
      mermaid.render(`mermaid-${Math.random().toString(36).substring(7)}`, chart).then((result) => {
        if (ref.current) {
           ref.current.innerHTML = result.svg;
        }
      }).catch((e: any) => {
        console.error('Mermaid render error', e);
        if (ref.current) {
          ref.current.innerHTML = `<div class="p-4 bg-red-50 text-red-600 text-sm overflow-auto rounded-md whitespace-pre-wrap font-mono">Failed to render diagram.\nThe syntax produced by the AI might be invalid.\n\n${e?.message || e}</div>`;
        }
      });
    }
  }, [chart]);

  return <div ref={ref} className="mermaid" />;
};
