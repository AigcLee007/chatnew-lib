import React, { useEffect, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import { ZoomIn, ZoomOut, Download, Code2, AlertCircle, Loader2, Edit2, Check, RotateCcw } from 'lucide-react';

interface Props {
  code: string;
}

// 初始化 Mermaid 配置
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
});

export const MermaidDiagram: React.FC<Props> = ({ code: initialCode }) => {
  // 生成一个稳定的唯一 ID
  const elementId = useMemo(() => `mermaid-${Math.random().toString(36).slice(2, 9)}`, []);
  
  // 内部维护代码状态，以便编辑
  const [code, setCode] = useState(initialCode);
  const [isEditing, setIsEditing] = useState(false);
  
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [scale, setScale] = useState(1);
  const [isRendering, setIsRendering] = useState(false);

  // 当外部传入的 code 改变时（例如重新生成），重置内部状态
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isMounted = true;

    const renderDiagram = async () => {
      if (!code) return;
      
      setIsRendering(true);
      try {
        const { svg } = await mermaid.render(elementId, code);
        
        if (isMounted) {
          setSvg(svg);
          setError(false);
        }
      } catch (err) {
        console.debug("Mermaid render skipped/failed", err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    // 防抖渲染
    timeoutId = setTimeout(renderDiagram, 500);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [code, elementId]);

  const handleDownload = () => {
     if (!svg) return;
     const blob = new Blob([svg], { type: 'image/svg+xml' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `chart-${Date.now()}.svg`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
  };

  // 错误或加载状态的回退视图
  if (error || !svg) {
    return (
      <div className="relative group rounded-xl overflow-hidden my-5 border border-border/60 bg-[#1e1e1e] shadow-lg shadow-black/5">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#252526] border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${error ? 'bg-red-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider select-none">
              {error ? 'SYNTAX ERROR' : 'RENDERING...'}
            </span>
          </div>
          {/* 允许在出错时直接编辑代码修复 */}
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className="text-zinc-400 hover:text-white transition-colors"
          >
             {isEditing ? <Check size={14} /> : <Edit2 size={14} />}
          </button>
        </div>
        
        {isEditing ? (
             <textarea 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-64 p-4 bg-[#1e1e1e] text-zinc-100 font-mono text-xs resize-y focus:outline-none"
                spellCheck={false}
             />
        ) : (
            <div className="overflow-x-auto custom-scrollbar">
               <pre className="p-4 text-[13px] font-mono leading-relaxed !bg-transparent !m-0 !border-0 text-zinc-100 opacity-70">
                  <code>{code}</code>
               </pre>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-5 border border-border/50 rounded-xl overflow-hidden bg-white/95 backdrop-blur-sm shadow-sm transition-all hover:shadow-md">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">思维导图</span>
            {isRendering && <Loader2 size={10} className="animate-spin text-muted-foreground" />}
         </div>
         <div className="flex items-center gap-1">
            {/* 编辑按钮 */}
            <button 
                onClick={() => setIsEditing(!isEditing)} 
                className={`p-1.5 rounded-md transition-colors ${isEditing ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 text-muted-foreground'}`}
                title={isEditing ? "完成编辑" : "编辑代码"}
            >
                {isEditing ? <Check size={14}/> : <Edit2 size={14}/>}
            </button>
            
            {!isEditing && (
                <>
                    <div className="w-px h-3 bg-border mx-1"></div>
                    <button onClick={() => setCode(initialCode)} className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground transition-colors" title="重置"><RotateCcw size={14}/></button>
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground transition-colors" title="缩小"><ZoomOut size={14}/></button>
                    <span className="text-[10px] w-8 text-center text-muted-foreground font-mono">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground transition-colors" title="放大"><ZoomIn size={14}/></button>
                    <div className="w-px h-3 bg-border mx-1"></div>
                    <button onClick={handleDownload} className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground transition-colors" title="下载 SVG"><Download size={14}/></button>
                </>
            )}
         </div>
      </div>

      {/* Content Area */}
      {isEditing ? (
          <textarea 
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-[400px] p-4 bg-zinc-50 text-zinc-800 font-mono text-sm resize-y focus:outline-none border-none"
            spellCheck={false}
            placeholder="在此输入 Mermaid 代码..."
          />
      ) : (
          <div className="p-4 overflow-auto flex justify-center min-h-[200px] cursor-grab active:cursor-grabbing bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-10">
            <div 
                dangerouslySetInnerHTML={{ __html: svg }} 
                style={{ 
                  transform: `scale(${scale})`, 
                  transformOrigin: 'top center', 
                  transition: 'transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)' 
                }}
            />
          </div>
      )}
    </div>
  );
};