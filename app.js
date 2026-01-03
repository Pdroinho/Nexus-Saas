(function() {
    // --- 1. SETUP & GLOBAIS ---
    const { useState, useEffect, createContext, useContext, useRef } = window.React;
    const { Icon, Toast } = window.CoreKit;

    const getWpApiUrl = (endpoint) => {
        const base = SaasConfig.apiBase.replace('nexus/v1', 'wp/v2').replace(/\/$/, "");
        return `${base}/${endpoint}`;
    };

    const getCustomApiUrl = (endpoint) => {
        const base = SaasConfig.apiBase.replace(/\/$/, "");
        return `${base}/${endpoint}`;
    };
    const canAccessStudio = () => {
        try {
            const u = (typeof SaasConfig !== 'undefined' && SaasConfig.user) ? SaasConfig.user : {};
            const roles = Array.isArray(u.roles) ? u.roles : [];
            if (u.can_edit_posts === true) return true;
            // Fallback por role caso can_edit_posts não venha por cache/tema
            if (roles.includes('administrator') || roles.includes('editor') || roles.includes('author')) return true;
            return false;
        } catch (e) { return false; }
    };


    // --- FETCH HELPERS ---
    const apiFetch = async (endpoint, options = {}) => {
        const url = getCustomApiUrl(endpoint);
        const res = await fetch(url, {
            ...options,
            headers: {
                'X-WP-Nonce': SaasConfig.apiNonce,
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
        if (!res.ok) {
            const msg = (data && (data.message || (data.data && data.data.message))) ? (data.message || data.data.message) : 'Erro de API';
            throw new Error(msg);
        }
        return data;
    };


const apiUpload = async (endpoint, file) => {
    const url = getCustomApiUrl(endpoint);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'X-WP-Nonce': SaasConfig.apiNonce,
        },
        body: fd,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
    if (!res.ok || (data && data.success === false)) {
        const msg = (data && data.message) ? data.message : 'Erro ao enviar arquivo';
        throw new Error(msg);
    }
    return data;
};

    // --- 2. TEMA & CONTEXTO ---
    const ThemeContext = createContext();

    const ThemeProvider = ({ children }) => {
        const [isDark, setIsDark] = useState(false);
        useEffect(() => {
            const root = document.getElementById('saas-wrapper-inner');
            if (root) {
                isDark ? root.classList.add('dark') : root.classList.remove('dark');
            }
        }, [isDark]);

        return (
            <ThemeContext.Provider value={{ isDark, setIsDark }}>
                <div id="saas-wrapper-inner" className={`h-full w-full transition-colors duration-500 ease-out ${isDark ? 'dark' : ''}`}>
                    {children}
                </div>
            </ThemeContext.Provider>
        );
    };

    // --- 3. UI COMPONENTS ---

    const LayoutContainer = ({ children }) => (
        <div className="flex h-screen w-full bg-[#F8FAFC] dark:bg-[#0B0C10] font-sans antialiased text-slate-900 dark:text-zinc-100 overflow-hidden relative selection:bg-indigo-500 selection:text-white">
            <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-blob" />
            <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-fuchsia-500/5 dark:bg-violet-500/10 rounded-full blur-[120px] pointer-events-none animate-blob animation-delay-4000" />
            <div className="relative z-10 flex w-full h-full">
                {children}
            </div>
        </div>
    );

    const Card = ({ children, className = "", noHover = false, onClick, delay = 0 }) => (
        <div 
            onClick={onClick}
            style={{ animationDelay: `${delay}ms` }}
            className={`
            bg-white/80 dark:bg-[#15161A]/80 backdrop-blur-md
            border border-slate-200 dark:border-white/5 
            rounded-xl p-6 relative overflow-hidden transition-all duration-300 ease-out
            shadow-sm animate-slide-up opacity-0 fill-mode-forwards
            ${!noHover 
                ? 'hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/50 dark:hover:border-indigo-500/50 cursor-pointer group' 
                : ''}
            ${className}
        `}>
            {children}
        </div>
    );

    const Badge = ({ text, color = "default" }) => {
        const styles = {
            default: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border-slate-200 dark:border-white/10",
            brand: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border-indigo-100 dark:border-indigo-500/20",
            success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
        };
        return (
            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase border ${styles[color]} hover:scale-105 transition-transform duration-200 whitespace-nowrap`}>
                {text}
            </span>
        );
    };

    const IconButton = ({ icon, onClick, active, hasBadge, size = 20, className = "" }) => (
        <button 
            onClick={onClick}
            className={`
                relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 active:scale-95 shrink-0
                ${active 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-white hover:border-indigo-200 dark:hover:border-white/20'
                }
                ${className}
            `}
        >
            <Icon name={icon} size={size} strokeWidth={1.8} className={`transition-transform duration-300 ${!active && 'hover:rotate-12'}`} />
            {hasBadge && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#15161A] animate-pulse"></span>
            )}
        </button>
    );

    const ProgressBar = ({ percent }) => {
        const [width, setWidth] = useState(0);
        useEffect(() => {
            const timer = setTimeout(() => setWidth(percent), 100);
            return () => clearTimeout(timer);
        }, [percent]);

        return (
            <div className="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out"
                    style={{ width: `${width}%` }}
                ></div>
            </div>
        );
    };

    // --- 4. PLAYER COMPONENTS ---
    
    
const isLikelyVideoFile = (url) => {
    if (!url) return false;
    const u = String(url).toLowerCase().split('?')[0].split('#')[0];
    return u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.ogg') || u.endsWith('.m4v');
};

const parseYouTubeId = (url) => {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '') || null;
        if (u.hostname.includes('youtube.com')) {
            if (u.searchParams.get('v')) return u.searchParams.get('v');
            if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split('/')[0] || null;
            if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/shorts/')[1]?.split('/')[0] || null;
        }
    } catch (e) {}
    return null;
};

const NexusPlayer = ({ url, poster }) => {
    const videoRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);

    const ytId = parseYouTubeId(url || '');
    const isFile = isLikelyVideoFile(url || '');

    useEffect(() => {
        setReady(false);
        setPlaying(false);
        setCurrent(0);
        setDuration(0);
    }, [url]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;

        const onLoaded = () => {
            setReady(true);
            setDuration(el.duration || 0);
        };
        const onTime = () => setCurrent(el.currentTime || 0);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);

        el.addEventListener('loadedmetadata', onLoaded);
        el.addEventListener('timeupdate', onTime);
        el.addEventListener('play', onPlay);
        el.addEventListener('pause', onPause);

        return () => {
            el.removeEventListener('loadedmetadata', onLoaded);
            el.removeEventListener('timeupdate', onTime);
            el.removeEventListener('play', onPlay);
            el.removeEventListener('pause', onPause);
        };
    }, [url]);

    const fmt = (s) => {
        const n = Math.max(0, Math.floor(s || 0));
        const m = Math.floor(n / 60);
        const r = n % 60;
        return `${m}:${String(r).padStart(2, '0')}`;
    };

    const togglePlay = () => {
        const el = videoRef.current;
        if (!el) return;
        if (el.paused) el.play();
        else el.pause();
    };

    const seekTo = (val) => {
        const el = videoRef.current;
        if (!el) return;
        const t = Math.min(Math.max(0, val), duration || 0);
        el.currentTime = t;
        setCurrent(t);
    };

    const setVol = (v) => {
        const el = videoRef.current;
        const nv = Math.min(Math.max(0, v), 1);
        setVolume(nv);
        if (el) el.volume = nv;
        if (nv === 0) setMuted(true);
        else setMuted(false);
    };

    const toggleMute = () => {
        const el = videoRef.current;
        const next = !muted;
        setMuted(next);
        if (el) el.muted = next;
    };

    if (!url) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-zinc-900 text-slate-500">
                <div className="text-center">
                    <Icon name="VideoOff" size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Vídeo não disponível</p>
                </div>
            </div>
        );
    }

    // YouTube embed (no-cookie). Controls are from YouTube due to browser restrictions.
    if (ytId) {
        const src = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`;
        return <iframe src={src} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>;
    }

    // Direct file playback (custom controls)
    if (isFile) {
        return (
            <div className="absolute inset-0 bg-black">
                <video
                    ref={videoRef}
                    src={url}
                    poster={poster || undefined}
                    className="w-full h-full object-contain"
                    playsInline
                    controls={false}
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                    <div className="flex items-center gap-3">
                        <button onClick={togglePlay} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white transition-all active:scale-95">
                            <Icon name={playing ? "Pause" : "Play"} size={16} className={playing ? "" : "ml-0.5"} />
                        </button>

                        <div className="flex-1">
                            <input
                                type="range"
                                min={0}
                                max={duration || 0}
                                step={0.1}
                                value={current}
                                onChange={(e) => seekTo(parseFloat(e.target.value))}
                                className="w-full accent-white"
                            />
                            <div className="flex items-center justify-between text-[11px] text-white/80 font-semibold mt-1">
                                <span>{fmt(current)}</span>
                                <span>{fmt(duration)}</span>
                            </div>
                        </div>

                        <button onClick={toggleMute} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white transition-all active:scale-95">
                            <Icon name={muted || volume === 0 ? "VolumeX" : "Volume2"} size={16} />
                        </button>
                        <div className="w-24 hidden sm:block">
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={muted ? 0 : volume}
                                onChange={(e) => setVol(parseFloat(e.target.value))}
                                className="w-full accent-white"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Generic embed. May be blocked by X-Frame-Options.
    return (
        <div className="absolute inset-0 bg-black">
            <iframe
                src={url}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
            <div className="absolute left-3 top-3">
                <a href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-xs font-bold hover:bg-white/15 transition-colors">
                    Abrir em nova guia
                </a>
            </div>
        </div>
    );
};

const ContentRenderer = ({ lesson }) => {
    if (!lesson) return null;
    const { type, content } = lesson;

    if (type === 'video') {
        const videoUrl = content?.video_url;
        const poster = content?.cover_url;
        return <NexusPlayer url={videoUrl} poster={poster} />;
    }

    if (type === 'doc') {
        const pdfUrl = content?.pdf_url;
        if (!pdfUrl) {
            return (
                <div className="absolute inset-0 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-500">
                    <div className="text-center">
                        <Icon name="FileText" size={48} className="mx-auto mb-2 opacity-60" />
                        <p className="text-sm">Documento não disponível</p>
                    </div>
                </div>
            );
        }
        return (
            <iframe
                src={pdfUrl}
                className="w-full h-full border-0 bg-white"
                title="Documento"
            />
        );
    }

    if (type === 'code') {
        const code = content?.code || '';
        return (
            <div className="absolute inset-0 bg-[#0B0C10] p-6 overflow-auto custom-scrollbar">
                <pre className="text-xs leading-relaxed text-white/90 font-mono whitespace-pre-wrap">{code}</pre>
            </div>
        );
    }

    if (type === 'text') {
        const html = content?.html || '';
        return (
            <div className="absolute inset-0 bg-white dark:bg-[#0B0C10] p-8 overflow-auto custom-scrollbar">
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        );
    }

    if (type === 'live') {
        const url = content?.live_url;
        if (!url) return <div className="absolute inset-0 bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-500">Live não configurada</div>;
        return <iframe src={url} className="w-full h-full border-0" allowFullScreen></iframe>;
    }

    return <div className="absolute inset-0 bg-slate-50 dark:bg-[#15161A] p-10 flex items-center justify-center"><Icon name="Code" size={48} className="text-slate-300" /></div>;
};

    const LessonList = ({ modules, currentLessonId, onSelectLesson }) => {
        const [openModules, setOpenModules] = useState({});

        useEffect(() => {
            if(modules && modules.length > 0) {
                 const init = {};
                 modules.forEach(m => init[m.title] = true);
                 setOpenModules(prev => ({...prev, ...init}));
            }
        }, [modules]);

        const toggleModule = (title) => {
            setOpenModules(prev => ({ ...prev, [title]: !prev[title] }));
        };

        return (
            <div className="space-y-4">
                {modules.map((mod, i) => (
                    <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                        <button 
                            onClick={() => toggleModule(mod.title)}
                            className="w-full flex items-center justify-between p-3 text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                            <span>{mod.title}</span>
                            <Icon name="ChevronDown" size={16} className={`transition-transform duration-300 ${openModules[mod.title] ? 'rotate-180' : ''}`} />
                        </button>
                        
                        <div className={`space-y-1 overflow-hidden transition-all duration-500 ease-in-out ${openModules[mod.title] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            {mod.lessons.map(lesson => {
                                const active = lesson.id === currentLessonId;
                                const statusIcon = lesson.is_completed ? "CheckCircle2" : (lesson.type === 'doc' ? 'FileText' : 'Play');
                                const statusColor = lesson.is_completed ? "text-emerald-500" : (active ? "text-indigo-600 dark:text-white" : "text-slate-400");
                                
                                return (
                                    <div 
                                        key={lesson.id}
                                        onClick={() => onSelectLesson(lesson)}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border group/item
                                            ${active 
                                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 shadow-sm' 
                                                : 'bg-white dark:bg-white/5 border-transparent hover:bg-slate-50 dark:hover:bg-white/10'
                                            }
                                        `}
                                    >
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-indigo-600/10' : 'bg-slate-100 dark:bg-white/5 group-hover/item:bg-white/10'}`}>
                                            <Icon name={statusIcon} size={12} className={statusColor} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate max-w-[160px] ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-zinc-300'} ${lesson.is_completed && !active ? 'opacity-60 line-through decoration-slate-400' : ''}">
                                                {lesson.title}
                                            </p>
                                            <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <Icon name="Clock" size={10} /> {lesson.duration}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const PlayerView = ({ courseId, onBack }) => {
        const [structure, setStructure] = useState([]);
        const [loading, setLoading] = useState(true);
        const [currentLesson, setCurrentLesson] = useState(null);

        useEffect(() => {
            setLoading(true);
            fetch(getCustomApiUrl(`course/${courseId}`), {
                headers: { 'X-WP-Nonce': SaasConfig.apiNonce }
            })
            .then(res => res.json())
            .then(data => {
                setStructure(data);
                if (data.length > 0 && data[0].lessons.length > 0) {
                    setCurrentLesson(data[0].lessons[0]);
                }
                setLoading(false);
            })
            .catch(err => {
                setLoading(false);
                Toast({ message: 'Erro ao carregar curso', type: 'error' });
            });
        }, [courseId]);

        // Função de Toggle Blindada
        const toggleComplete = (e) => {
            if(e) e.preventDefault();
            if(!currentLesson) return;

            const newStatus = !currentLesson.is_completed;
            
            // 1. Atualização Otimista
            setCurrentLesson(prev => ({ ...prev, is_completed: newStatus }));
            setStructure(prev => prev.map(mod => ({
                ...mod,
                lessons: mod.lessons.map(l => l.id === currentLesson.id ? { ...l, is_completed: newStatus } : l)
            })));

            console.log('Enviando status para:', getCustomApiUrl(`lesson/${currentLesson.id}/complete`));

            // 2. Chama API
            fetch(getCustomApiUrl(`lesson/${currentLesson.id}/complete`), {
                method: 'POST',
                headers: { 
                    'X-WP-Nonce': SaasConfig.apiNonce,
                    'Content-Type': 'application/json' 
                }
            })
            .then(res => res.json())
            .then(data => {
                if(data.success) {
                    Toast({ message: data.is_completed ? 'Aula concluída!' : 'Marcada como pendente.', type: 'success' });
                } else {
                    console.error('API Error:', data);
                    Toast({ message: 'Erro ao salvar progresso.', type: 'error' });
                    // Reverte se der erro
                    setCurrentLesson(prev => ({ ...prev, is_completed: !newStatus }));
                }
            })
            .catch(err => {
                console.error('Fetch Error:', err);
                Toast({ message: 'Erro de conexão.', type: 'error' });
                setCurrentLesson(prev => ({ ...prev, is_completed: !newStatus }));
            });
        };

        if (loading) return (
            <div className="flex h-full w-full items-center justify-center flex-col gap-4 animate-fade-in">
                <Icon name="Loader2" size={40} className="animate-spin text-indigo-500" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Carregando Conteúdo...</p>
            </div>
        );

        return (
            <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden animate-fade-in bg-white dark:bg-[#0B0C10]">
                <div className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                    <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-white/90 dark:bg-[#0B0C10]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5">
                        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            <Icon name="ArrowLeft" size={18} /> Voltar
                        </button>
                        <div className="flex gap-2">
                            <IconButton icon="MessageSquare" />
                            <IconButton icon="Share2" />
                        </div>
                    </div>

                    <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full">
                        <div className="aspect-video w-full bg-black rounded-xl shadow-2xl overflow-hidden relative group mb-8 border border-slate-200 dark:border-white/10">
                            <ContentRenderer lesson={currentLesson} />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-10 border-b border-slate-200 dark:border-white/5">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <Badge text={currentLesson?.type === 'doc' ? 'Leitura' : 'Vídeo'} color="brand" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        {currentLesson?.duration}
                                    </span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                                    {currentLesson?.title}
                                </h1>
                                {currentLesson?.content?.html && (
                                    <div 
                                        className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-zinc-400"
                                        dangerouslySetInnerHTML={{ __html: currentLesson.content.html }}
                                    />
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-3 min-w-[200px]">
                                <button 
                                    type="button"
                                    onClick={toggleComplete}
                                    className={`
                                        w-full py-3 rounded-lg font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer
                                        ${currentLesson?.is_completed 
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
                                        }
                                    `}
                                >
                                    <Icon name={currentLesson?.is_completed ? "Check" : "CheckCircle"} size={18} /> 
                                    {currentLesson?.is_completed ? 'Concluída' : 'Marcar como Vista'}
                                </button>
                                <button className="w-full py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 rounded-lg font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Icon name="Download" size={18} /> Material de Apoio
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full lg:w-96 border-l border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-[#111216]/95 backdrop-blur-xl flex flex-col h-[40vh] lg:h-full shrink-0">
                    <div className="p-5 border-b border-slate-200 dark:border-white/5">
                        <h3 className="font-bold text-slate-900 dark:text-white">Conteúdo do Curso</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <LessonList 
                            modules={structure} 
                            currentLessonId={currentLesson?.id}
                            onSelectLesson={setCurrentLesson}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // --- 5. NAVEGAÇÃO E SHELL ---

    const NavItem = ({ icon, label, viewName, currentView, onClick }) => {
        const active = viewName === currentView;
        return (
            <button 
                onClick={() => onClick(viewName)}
                className={`
                    w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 mb-1 relative overflow-hidden active:scale-[0.98]
                    ${active 
                        ? "text-white dark:text-slate-900 shadow-md bg-slate-900 dark:bg-white" 
                        : "text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-white"
                    }
                `}
            >
                <Icon 
                    name={icon} 
                    size={18} 
                    strokeWidth={active ? 2.5 : 2}
                    className={`relative z-10 transition-transform duration-300 ${active ? "scale-105" : "group-hover:scale-110"}`} 
                />
                <span className={`text-sm font-semibold relative z-10`}>{label}</span>
            </button>
        );
    };

    const SidebarContent = ({ currentView, setView, onCloseMobile }) => {
        const handleNav = (view) => {
            setView(view);
            if (onCloseMobile) onCloseMobile();
        };

        return (
            <div className="flex flex-col h-full p-6 bg-white/80 dark:bg-[#111216]/80 backdrop-blur-xl border-r border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2.5 mb-10 px-2 animate-fade-in shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 hover:rotate-3 transition-transform duration-300">
                        <Icon name="Box" size={18} strokeWidth={3} />
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Nexus<span className="text-slate-400 dark:text-zinc-600">Kit</span>
                    </span>
                </div>

                <nav className="flex-1 space-y-6 animate-slide-right opacity-0 fill-mode-forwards overflow-y-auto custom-scrollbar pr-2" style={{ animationDelay: '100ms' }}>
                    <div>
                        <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-3">Geral</p>
                        <NavItem onClick={handleNav} currentView={currentView} viewName="dashboard" icon="Layout" label="Dashboard" />
                        <NavItem onClick={handleNav} currentView={currentView} viewName="courses" icon="BookOpen" label="Cursos" />
                        <NavItem onClick={handleNav} currentView={currentView} viewName="explore" icon="Compass" label="Explorar" />
                        {canAccessStudio() && (
                            <NavItem onClick={handleNav} currentView={currentView} viewName="studio" icon="Sliders" label="Studio" />
                        )}
                    </div>
                    
                    <div>
                        <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-zinc-600 uppercase tracking-widest mb-3">Social</p>
                        <NavItem onClick={handleNav} currentView={currentView} viewName="members" icon="Users" label="Membros" />
                        <NavItem onClick={handleNav} currentView={currentView} viewName="achievements" icon="Award" label="Conquistas" />
                    </div>
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-white/5 animate-slide-up opacity-0 fill-mode-forwards shrink-0" style={{ animationDelay: '300ms' }}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-500/50 transition-all group hover:shadow-md">
                         <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs group-hover:scale-110 transition-transform shrink-0">
                            DM
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{SaasConfig.user.name || 'Usuario'}</p>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-500">Membro</p>
                        </div>
                        <Icon name="Settings" size={14} className="text-slate-400 group-hover:text-indigo-600 group-hover:rotate-90 transition-all duration-500" />
                    </div>
                </div>
            </div>
        );
    };

    const Header = ({ onMenuClick, title }) => {
        const { isDark, setIsDark } = useContext(ThemeContext);
        
        return (
            <header className="sticky top-0 z-30 px-6 py-4 bg-[#F8FAFC]/80 dark:bg-[#0B0C10]/80 backdrop-blur-md flex justify-between items-center border-b border-slate-200/50 dark:border-white/5 transition-all shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors active:scale-95">
                        <Icon name="Menu" size={20} />
                    </button>
                    <div className="hidden sm:flex items-center gap-2 text-sm animate-fade-in">
                        <span className="text-slate-400 dark:text-zinc-600 font-medium">App</span>
                        <span className="text-slate-300 dark:text-zinc-700">/</span>
                        <span className="text-slate-800 dark:text-zinc-200 font-semibold capitalize">{title}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 animate-fade-in">
                    <div className="hidden md:flex items-center bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 w-64 lg:w-72 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm group">
                        <Icon name="Search" size={14} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Buscar..." 
                            className="w-full bg-transparent border-none text-xs ml-2 text-slate-700 dark:text-zinc-200 focus:outline-none placeholder:text-slate-400"
                        />
                        <span className="text-[10px] font-bold text-slate-400 border border-slate-100 dark:border-white/5 px-1.5 py-0.5 rounded">⌘K</span>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden sm:block"></div>

                    <IconButton 
                        icon={isDark ? "Sun" : "Moon"} 
                        onClick={() => setIsDark(!isDark)} 
                    />
                    <IconButton icon="Bell" hasBadge={true} />
                </div>
            </header>
        );
    };

    const DashboardView = ({ setView }) => {
        const stats = [
            { label: "Receita Mensal", value: "R$ 14.5k", trend: "+12%", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Membros Ativos", value: "842", trend: "+4%", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
            { label: "Taxa de Conclusão", value: "68%", trend: "-1%", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/10" },
            { label: "Novos Leads", value: "128", trend: "+8%", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
        ];

        return (
            <div className="space-y-8 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <Card key={i} noHover delay={i * 100} className="flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wide whitespace-nowrap">{stat.label}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stat.bg} ${stat.color}`}>{stat.trend}</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</h3>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="flex justify-between items-center animate-fade-in" style={{ animationDelay: '400ms' }}>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Em Progresso</h2>
                            <button onClick={() => setView('courses')} className="text-xs font-bold text-indigo-600 hover:underline whitespace-nowrap">Ver tudo</button>
                        </div>

                        <div 
                            className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-indigo-900/20 transition-all duration-500 animate-slide-up opacity-0 fill-mode-forwards"
                            style={{ animationDelay: '500ms' }}
                            onClick={() => setView('courses')}
                        >
                            <div className="absolute inset-0 bg-slate-900">
                                <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-[2000ms]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                            </div>
                            <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <Badge text="Módulo 3" color="brand" />
                                    <span className="text-xs font-medium text-white/80">Design System</span>
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-2 tracking-tight group-hover:translate-x-1 transition-transform duration-300">Construindo Interfaces Modernas</h3>
                                <p className="text-slate-300 text-sm mb-6 max-w-lg hidden sm:block">Aprenda a criar designs escaláveis e consistentes utilizando tokens.</p>
                                
                                <div className="flex flex-wrap items-center gap-5">
                                    <button className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 rounded-lg font-bold text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-lg active:scale-95 whitespace-nowrap">
                                        <Icon name="Play" size={16} className="fill-current" /> Continuar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Rankings & Metas</h2>
                        </div>
                        
                        <div 
                            className="p-6 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden animate-slide-up opacity-0 fill-mode-forwards"
                            style={{ animationDelay: '500ms' }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl animate-pulse"></div>
                            <Icon name="Target" size={24} className="mb-3 text-indigo-200" />
                            <h3 className="font-bold text-lg mb-1">Meta Semanal</h3>
                            <p className="text-xs text-indigo-100 mb-4 opacity-90">Você completou 3 de 5 aulas.</p>
                            <ProgressBar percent={60} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const CoursesView = ({ onSelectCourse }) => {
        const [courses, setCourses] = useState([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            fetch(getWpApiUrl('nexus_course?_embed'), {
                headers: { 'X-WP-Nonce': SaasConfig.apiNonce }
            })
            .then(res => res.json())
            .then(data => {
                setCourses(data);
                setLoading(false);
            })
            .catch(err => {
                setLoading(false);
                Toast({ message: 'Erro ao carregar cursos', type: 'error' });
            });
        }, []);

        return (
            <div className="pb-12">
                <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Biblioteca</h1>
                        <p className="text-slate-500 dark:text-zinc-400 text-sm max-w-2xl">
                            Explore nossa coleção completa de cursos e materiais exclusivos.
                        </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                         {['Todos', 'Design', 'Frontend', 'Backend'].map(tag => (
                            <button key={tag} className="px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-white/10 transition-colors active:scale-95 whitespace-nowrap">
                                {tag}
                            </button>
                         ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-40">
                         <Icon name="Loader2" size={32} className="animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {courses.length === 0 && (
                            <p className="col-span-full text-center text-slate-400 py-10">Nenhum curso encontrado.</p>
                        )}
                        {courses.map((course, index) => {
                            const imgUrl = course._embedded?.['wp:featuredmedia']?.[0]?.source_url 
                                || `https://picsum.photos/seed/${course.id}/600/400`;
                            
                            return (
                                <div 
                                    key={course.id} 
                                    onClick={() => onSelectCourse(course.id)} 
                                    style={{ animationDelay: `${index * 100}ms` }}
                                    className="group flex flex-col bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 hover:border-indigo-300/50 dark:hover:border-indigo-500/30 transition-all duration-300 cursor-pointer h-full animate-slide-up opacity-0 fill-mode-forwards"
                                >
                                    <div className="h-44 relative overflow-hidden bg-slate-100 dark:bg-zinc-800">
                                        <img src={imgUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-indigo-600 scale-50 group-hover:scale-100 transition-transform duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                                                <Icon name="Play" size={20} className="ml-0.5 fill-current" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Curso</p>
                                        <h3 
                                            className="text-base font-bold text-slate-900 dark:text-white mb-2 leading-snug group-hover:text-indigo-600 transition-colors break-words"
                                            dangerouslySetInnerHTML={{ __html: course.title.rendered }}
                                        />
                                        <div 
                                            className="text-sm text-slate-500 dark:text-zinc-500 line-clamp-2 mb-4"
                                            dangerouslySetInnerHTML={{ __html: course.excerpt.rendered }} 
                                        />
                                        <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500">
                                                <Icon name="Clock" size={14} /> --
                                            </div>
                                            <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                                                <Icon name="Star" size={12} className="fill-current" /> 5.0
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    // --- 6. STUDIO (CMS IN-APP) - VERSÃO PREMIUM ---

    // Sistema de Toast Customizado Alinhado ao Design
    const CustomToast = ({ message, type = 'info', duration = 4000 }) => {
        const [visible, setVisible] = useState(true);
        useEffect(() => {
            const timer = setTimeout(() => setVisible(false), duration);
            return () => clearTimeout(timer);
        }, [duration]);

        if (!visible) return null;

        const config = {
            success: { icon: 'CheckCircle', bg: 'bg-emerald-500', text: 'text-emerald-50', border: 'border-emerald-400' },
            error: { icon: 'XCircle', bg: 'bg-rose-500', text: 'text-rose-50', border: 'border-rose-400' },
            warning: { icon: 'AlertTriangle', bg: 'bg-amber-500', text: 'text-amber-50', border: 'border-amber-400' },
            info: { icon: 'Info', bg: 'bg-indigo-500', text: 'text-indigo-50', border: 'border-indigo-400' },
        };
        const cfg = config[type] || config.info;

        return (
            <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-xl ${cfg.bg} ${cfg.text} border-2 ${cfg.border} shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[500px] animate-slide-right`}>
                <Icon name={cfg.icon} size={20} className="flex-shrink-0" />
                <p className="text-sm font-semibold flex-1">{message}</p>
                <button onClick={() => setVisible(false)} className="flex-shrink-0 hover:opacity-70 transition-opacity">
                    <Icon name="X" size={16} />
                </button>
            </div>
        );
    };

    const showToast = (message, type = 'info') => {
        const container = document.getElementById('toast-container') || (() => {
            const div = document.createElement('div');
            div.id = 'toast-container';
            div.className = 'fixed top-4 right-4 z-[9999] space-y-2';
            document.body.appendChild(div);
            return div;
        })();
        const toastId = 'toast-' + Date.now();
        const toastDiv = document.createElement('div');
        toastDiv.id = toastId;
        container.appendChild(toastDiv);
        window.ReactDOM.render(<CustomToast message={message} type={type} />, toastDiv);
        setTimeout(() => {
            const el = document.getElementById(toastId);
            if (el) {
                window.ReactDOM.unmountComponentAtNode(el);
                el.remove();
            }
        }, 4000);
    };

    // Product Tour System
    const ProductTour = ({ steps, currentStep, onNext, onPrev, onClose, onSkip, showDontShowAgain = true }) => {
        const [dontShowAgain, setDontShowAgain] = useState(false);
        const [targetRect, setTargetRect] = useState(null);
        
        if (currentStep < 0 || currentStep >= steps.length) return null;
        
        const step = steps[currentStep];
        const isFirst = currentStep === 0;
        const isLast = currentStep === steps.length - 1;

        // Calcular posição do elemento alvo quando o step mudar
        useEffect(() => {
            if (step.target) {
                const element = document.querySelector(step.target);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    setTargetRect(rect);
                } else {
                    setTargetRect(null);
                }
            } else {
                setTargetRect(null);
            }
        }, [currentStep, step.target]);

        const handleNext = () => {
            if (isLast) {
                if (dontShowAgain) {
                    localStorage.setItem('studio-tour-completed', 'true');
                }
                onClose();
            } else {
                onNext();
            }
        };

        const handleSkip = () => {
            if (dontShowAgain) {
                localStorage.setItem('studio-tour-completed', 'true');
            }
            onSkip();
        };

        const createClipPath = () => {
            if (!targetRect) return 'none';
            
            // Adicionar padding ao redor do elemento destacado
            const padding = 8;
            const holeTop = targetRect.top - padding;
            const holeLeft = targetRect.left - padding;
            const holeRight = targetRect.right + padding;
            const holeBottom = targetRect.bottom + padding;
            
            // Criar o clip-path para fazer um "buraco" retangular
            // Este polígono desenha todo o overlay exceto a área do elemento
            return `polygon(
                0% 0%, 
                0% 100%, 
                ${holeLeft}px 100%, 
                ${holeLeft}px ${holeTop}px, 
                ${holeRight}px ${holeTop}px, 
                ${holeRight}px ${holeBottom}px, 
                ${holeLeft}px ${holeBottom}px, 
                ${holeLeft}px 100%, 
                100% 100%, 
                100% 0%
            )`;
        };
        
        // Função para posicionar o card do tour corretamente com smart positioning
        const getTourCardPosition = () => {
            if (!step.cardStyle && !targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
            
            // Se há um target com posição calculada, usar smart positioning
            if (targetRect) {
                const viewport = { w: window.innerWidth, h: window.innerHeight };
                const padding = 20;
                const cardWidth = 400;
                const cardHeight = 280;
                
                let pos = { position: 'fixed' };
                
                // Calcular melhor posição vertical
                if (targetRect.bottom + cardHeight + padding < viewport.h) {
                    // Tem espaço abaixo
                    pos.top = `${targetRect.bottom + padding}px`;
                } else if (targetRect.top - cardHeight - padding > 0) {
                    // Tem espaço acima
                    pos.top = 'auto';
                    pos.bottom = `${viewport.h - targetRect.top + padding}px`;
                } else {
                    // Centralizar verticalmente
                    pos.top = '50%';
                    pos.transform = 'translateY(-50%)';
                }
                
                // Calcular melhor posição horizontal
                if (targetRect.right + cardWidth + padding < viewport.w) {
                    // Tem espaço à direita
                    pos.left = `${targetRect.right + padding}px`;
                    pos.right = 'auto';
                } else if (targetRect.left - cardWidth - padding > 0) {
                    // Tem espaço à esquerda
                    pos.left = 'auto';
                    pos.right = `${viewport.w - targetRect.left + padding}px`;
                } else {
                    // Centralizar horizontalmente
                    pos.left = '50%';
                    pos.transform = pos.transform ? `${pos.transform} translateX(-50%)` : 'translateX(-50%)';
                }
                
                // Ajustar para telas menores
                if (viewport.w < 1024) {
                    pos.maxWidth = 'calc(100vw - 2rem)';
                    pos.left = '1rem';
                    pos.right = '1rem';
                } else {
                    pos.maxWidth = '90vw';
                }
                
                pos.zIndex = 10002;
                
                return pos;
            }
            
            // Fallback para cardStyle estático
            return step.cardStyle || {};
        };
        
        return (
            <div className="fixed inset-0 z-[10000] pointer-events-none">
                {/* Overlay escuro com buraco (spotlight) - clip-path para destacar o elemento em foco */}
                <div 
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto" 
                    style={{ clipPath: targetRect ? createClipPath() : 'none' }}
                    onClick={handleSkip}
                />
                
                {/* Borda de destaque no elemento (spotlight border) */}
                {targetRect && (
                    <div 
                        className="absolute border-4 border-indigo-500 rounded-xl pointer-events-none z-[10001] animate-pulse"
                        style={{
                            top: `${targetRect.top - 8}px`,
                            left: `${targetRect.left - 8}px`,
                            width: `${targetRect.width + 16}px`,
                            height: `${targetRect.height + 16}px`,
                        }}
                    />
                )}

                {/* Card de explicação - com smart positioning */}
                <div 
                    className="absolute bg-white dark:bg-[#15161A] rounded-2xl shadow-2xl border-2 border-indigo-500 p-6 max-w-md pointer-events-auto animate-slide-up z-[10002]"
                    style={getTourCardPosition()}
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                                <Icon name={step.icon || 'Info'} size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">{step.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">Passo {currentStep + 1} de {steps.length}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSkip}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <Icon name="X" size={16} className="text-slate-500" />
                        </button>
                    </div>
                    
                    <p className="text-sm text-slate-700 dark:text-zinc-300 mb-4 leading-relaxed">{step.description}</p>

                    <div className="flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={dontShowAgain}
                                onChange={(e) => setDontShowAgain(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Não mostrar novamente</span>
                        </label>
                        
                        <div className="flex items-center gap-2">
                            {!isFirst && (
                                <button
                                    onClick={onPrev}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                                >
                                    Anterior
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="px-6 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                            >
                                {isLast ? 'Finalizar' : 'Próximo'}
                                <Icon name={isLast ? 'Check' : 'ChevronRight'} size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Modal de Editor em Tela Cheia - Redesenhado
    const FullscreenEditor = ({ isOpen, onClose, children, title }) => {
        if (!isOpen) return null;
        
        return (
            <div className="fixed inset-0 z-[9998] bg-white dark:bg-[#0B0C10] animate-fade-in flex flex-col">
                {/* Header Sticky */}
                <div className="sticky top-0 z-10 bg-white dark:bg-[#15161A] border-b border-slate-200 dark:border-white/10 shadow-sm">
                    <div className="h-16 px-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <Icon name="X" size={18} />
                            </button>
                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10"></div>
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title || 'Editor'}</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Content Area */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto w-full p-6">
                        {children}
                    </div>
                </div>
            </div>
        );
    };

    // Componente de Tooltip Contextual com Smart Positioning
    const StudioTooltip = ({ children, text, position = 'top' }) => {
        const [show, setShow] = useState(false);
        const tooltipRef = useRef(null);
        
        // Função para calcular a posição do tooltip com detecção inteligente de viewport
        const getPositionClasses = () => {
            if (!show || !tooltipRef.current) return '';
            
            const el = tooltipRef.current.parentElement;
            if (!el) return 'bottom-full mb-2';
            
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const padding = 16;
            const tooltipWidth = 280;
            const tooltipHeight = 100; // Estimativa
            
            let pos = '';
            
            // Detectar melhor posição vertical com fallback inteligente
            if (position === 'top' && rect.top > tooltipHeight + padding) {
                pos = 'bottom-full mb-2';
            } else if (position === 'bottom' || rect.top < tooltipHeight + padding) {
                // Se não cabe acima, vai abaixo
                if (rect.bottom + tooltipHeight + padding < vh) {
                    pos = 'top-full mt-2';
                } else {
                    // Se não cabe nem acima nem abaixo, vai acima mesmo
                    pos = 'bottom-full mb-2';
                }
            } else {
                pos = 'bottom-full mb-2';
            }
            
            // Detectar melhor posição horizontal
            if (rect.left < tooltipWidth / 2 + padding) {
                pos += ' left-0';
            } else if (rect.right + tooltipWidth / 2 > vw - padding) {
                pos += ' right-0';
            } else {
                pos += ' left-1/2 -translate-x-1/2';
            }
            
            return pos;
        };
        
        return (
            <div 
                ref={tooltipRef} 
                className="relative inline-block" 
                onMouseEnter={() => setShow(true)} 
                onMouseLeave={() => setShow(false)}
            >
                {children}
                {show && (
                    <div className={`absolute z-[9999] px-3 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-zinc-800 rounded-lg shadow-xl max-w-xs break-words pointer-events-none animate-fade-in ${getPositionClasses()}`}>
                        {text}
                    </div>
                )}
            </div>
        );
    };

    // Badge de Status Melhorado
    const StatusBadge = ({ status, size = 'sm' }) => {
        const config = {
            publish: { label: 'Publicado', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30', icon: 'CheckCircle' },
            draft: { label: 'Rascunho', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30', icon: 'Edit' },
            pending: { label: 'Pendente', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30', icon: 'Clock' },
            private: { label: 'Privado', color: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/30', icon: 'Lock' },
        };
        const cfg = config[status] || config.draft;
        const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
        return (
            <span className={`inline-flex items-center gap-1 ${sizeClass} rounded-full font-bold border ${cfg.color}`}>
                <Icon name={cfg.icon} size={size === 'sm' ? 10 : 12} />
                {cfg.label}
            </span>
        );
    };

    // Card de Curso Melhorado
    const CourseCard = ({ course, isActive, onClick, onDelete, delay = 0 }) => {
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
        
        return (
            <Card
                delay={delay}
                className={`p-5 group transition-all duration-300 relative ${
                    isActive ? 'ring-2 ring-indigo-500/50 border-indigo-300 dark:border-indigo-500/50 shadow-lg shadow-indigo-500/10' : ''
                }`}
            >
                <div className="flex items-start gap-4" onClick={onClick}>
                    <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all duration-300 cursor-pointer ${
                        isActive ? 'border-indigo-300 dark:border-indigo-500/50 shadow-md' : 'border-slate-200 dark:border-white/10 group-hover:border-indigo-200 dark:group-hover:border-indigo-500/30'
                    }`}>
                        {course.cover_url ? (
                            <img src={course.cover_url} alt={course.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
                                <Icon name="BookOpen" size={24} className="text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 
                                className="text-sm font-bold text-slate-900 dark:text-white break-words max-w-[160px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer truncate" 
                                title={course.title || 'Sem título'}
                            >
                                {course.title || 'Sem título'}
                            </h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                {onDelete && (
                                    <StudioTooltip text="Excluir este curso">
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95"
                                        >
                                            <Icon name="Trash2" size={12} className="text-rose-600 dark:text-rose-400" />
                                        </button>
                                    </StudioTooltip>
                                )}
                                <Icon name="ChevronRight" size={16} className={`text-slate-300 dark:text-zinc-700 transition-transform ${isActive ? 'text-indigo-500' : ''}`} />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <StatusBadge status={course.status} size="sm" />
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                                {new Date(course.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Confirmação de exclusão */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/30 rounded-xl p-4 flex flex-col justify-center z-10">
                        <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 mb-3 text-center">Excluir este curso?</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all"
                            >
                                Excluir
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(false);
                                }}
                                className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        );
    };

    // Card de Módulo Melhorado com Drag & Drop Visual
    const ModuleCard = ({ module, items = [], onEdit, onCreateItem, onItemClick, onReorder, onDelete, onDeleteItem, isDefault = false }) => {
        const [isExpanded, setIsExpanded] = useState(true);
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
        
        // Diferenciação visual: módulo padrão "Geral" vs módulos customizados
        const isGeral = isDefault || module.name === 'Geral' || module.id === 0;
        const moduleGradient = isGeral 
            ? 'from-slate-400 to-slate-500' 
            : 'from-indigo-500 to-violet-600';
        const moduleBorder = isGeral
            ? 'border-slate-300 dark:border-slate-600'
            : 'border-indigo-300 dark:border-indigo-500/50';
        
        return (
            <div className={`border-2 ${moduleBorder} rounded-2xl overflow-hidden bg-white/80 dark:bg-[#15161A]/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg ${isGeral ? 'opacity-90' : ''}`}>
                <div className={`p-4 bg-gradient-to-r ${isGeral ? 'from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50' : 'from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10'}`}>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-3 flex-1 text-left group"
                        >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${moduleGradient} flex items-center justify-center shadow-md`}>
                                <Icon name={isGeral ? "Folder" : "Layers"} size={18} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors break-words max-w-[160px] line-clamp-2">
                                        {module.name}
                                    </h4>
                                    {isGeral && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            Padrão
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                    {items.length} {items.length === 1 ? 'conteúdo' : 'conteúdos'}
                                </p>
                            </div>
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95"
                            >
                                <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={14} className="text-slate-500" />
                            </button>
                            <StudioTooltip text="Adicionar novo conteúdo a este módulo">
                                <button
                                    onClick={onCreateItem}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                                >
                                    <Icon name="Plus" size={12} />
                                    Conteúdo
                                </button>
                            </StudioTooltip>
                            {!isGeral && onDelete && (
                                <StudioTooltip text="Excluir este módulo">
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95"
                                    >
                                        <Icon name="Trash2" size={14} className="text-rose-600 dark:text-rose-400" />
                                    </button>
                                </StudioTooltip>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Confirmação de exclusão */}
                {showDeleteConfirm && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border-t border-rose-200 dark:border-rose-500/30">
                        <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 mb-2">Tem certeza que deseja excluir este módulo?</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    onDelete();
                                    setShowDeleteConfirm(false);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all"
                            >
                                Excluir
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
                {isExpanded && (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {items.map((item, idx) => {
                            const typeIcons = {
                                video: { icon: 'Play', color: 'text-red-500', bg: 'bg-red-500/10' },
                                doc: { icon: 'FileText', color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                code: { icon: 'Code2', color: 'text-green-500', bg: 'bg-green-500/10' },
                                live: { icon: 'Radio', color: 'text-purple-500', bg: 'bg-purple-500/10' },
                                text: { icon: 'Text', color: 'text-amber-500', bg: 'bg-amber-500/10' },
                            };
                            const typeConfig = typeIcons[item.type] || typeIcons.video;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => onItemClick(item)}
                                    className="p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeConfig.bg}`}>
                                        <Icon name={typeConfig.icon} size={14} className={typeConfig.color} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {item.title}
                                        </p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <StatusBadge status={item.status} size="sm" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        <StudioTooltip text="Mover para cima">
                                            <button
                                                onClick={() => onReorder(item.id, idx - 1)}
                                                disabled={idx === 0}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Icon name="ChevronUp" size={12} />
                                            </button>
                                        </StudioTooltip>
                                        <StudioTooltip text="Mover para baixo">
                                            <button
                                                onClick={() => onReorder(item.id, idx + 1)}
                                                disabled={idx === items.length - 1}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Icon name="ChevronDown" size={12} />
                                            </button>
                                        </StudioTooltip>
                                        {onDeleteItem && (
                                            <StudioTooltip text="Excluir este conteúdo">
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Tem certeza que deseja excluir "${item.title}"?`)) {
                                                            onDeleteItem(item.id);
                                                        }
                                                    }}
                                                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white dark:bg-white/5 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95"
                                                >
                                                    <Icon name="Trash2" size={12} className="text-rose-600 dark:text-rose-400" />
                                                </button>
                                            </StudioTooltip>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {items.length === 0 && (
                            <div className="p-8 text-center">
                                <Icon name="Inbox" size={32} className="text-slate-300 dark:text-zinc-700 mx-auto mb-2" />
                                <p className="text-sm text-slate-400 dark:text-zinc-500 mb-3">Nenhum conteúdo ainda</p>
                                <button
                                    onClick={onCreateItem}
                                    className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95 flex items-center gap-2 mx-auto"
                                >
                                    <Icon name="Plus" size={12} />
                                    Criar primeiro conteúdo
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const StudioTabs = ({ tabs, active, onChange }) => (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-3 mb-5 overflow-x-auto scrollbar-hide">
            {tabs.map(t => {
                const isActive = t.key === active;
                return (
                    <button
                        key={t.key}
                        onClick={() => onChange(t.key)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 border relative
                            ${isActive
                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-500/20'
                                : 'bg-white dark:bg-white/5 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-md'
                            }`}
                    >
                        {t.label}
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
                        )}
                    </button>
                );
            })}
        </div>
    );

    
    const StudioStepNav = ({ tabs, active, onChange }) => {
        const hints = {
            content: 'Título, resumo e texto',
            media: 'Vídeo, PDF, live ou código',
            access: 'Grátis, pago e checkout',
            publish: 'Status e datas',
            extras: 'Metadados e detalhes',
        };
        return (
            <div className="mt-4 grid grid-cols-1 gap-2">
                {tabs.map((t, idx) => {
                    const isActive = t.key === active;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onChange(t.key)}
                            className={`w-full text-left px-3 py-3 rounded-xl border transition-all active:scale-[0.99]
                                ${isActive
                                    ? 'bg-white dark:bg-white/10 border-indigo-200 dark:border-white/15 shadow-sm'
                                    : 'bg-white/60 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:bg-white hover:dark:bg-white/10'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black
                                    ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-zinc-200'}`}>
                                    {idx + 1}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.label}</div>
                                    <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">{hints[t.key] || ''}</div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    const StudioStepNavMobile = ({ tabs, active, onChange }) => (
        <div className="lg:hidden w-full">
            <select
                value={active}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
                {tabs.map((t, idx) => (
                    <option key={t.key} value={t.key}>{idx + 1}. {t.label}</option>
                ))}
            </select>
        </div>
    );

    const StudioStepFooter = ({ tabs, active, onPrev, onNext }) => {
        const order = tabs.map(t => t.key);
        const idx = Math.max(0, order.indexOf(active));
        const isLast = idx === order.length - 1;
        return (
            <div className="mt-5 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={idx === 0}
                    className={`px-4 py-2 rounded-xl border text-sm font-bold transition-all active:scale-[0.99]
                        ${idx === 0
                            ? 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-zinc-500 border-slate-200 dark:border-white/10 cursor-not-allowed'
                            : 'bg-white dark:bg-white/5 text-slate-900 dark:text-white border-slate-200 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10'
                        }`}
                >
                    Voltar
                </button>
                <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 hidden sm:block">
                        Etapa {idx + 1} de {order.length}
                    </div>
                    <button
                        type="button"
                        onClick={onNext}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-[0.99]"
                    >
                        {isLast ? 'Finalizar' : 'Próximo'}
                    </button>
                </div>
            </div>
        );
    };
const ModalConfirm = ({ open, title, message, onCancel, onConfirm, confirmText = 'Salvar', cancelText = 'Descartar' }) => {
        if (!open) return null;
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
                <div className="relative w-[92vw] max-w-md">
                    <Card noHover className="p-6" delay={0}>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                                <Icon name="AlertTriangle" size={18} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{message}</p>
                            </div>
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-2">
                            <button
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95"
                                onClick={onCancel}
                            >
                                {cancelText}
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        );
    };

    const PreviewPanel = ({ type, media, richHtml }) => {
        if (!type) return null;
        const wrap = (child) => (
            <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15161A]">
                {child}
            </div>
        );

        if (type === 'video') {
            const url = media?.video_url;
            if (!url) return wrap(<div className="h-full flex items-center justify-center text-slate-400"><Icon name="VideoOff" size={28} /></div>);

            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
            const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);

            // Arquivo direto (mp4/webm/ogg)
            if (url.match(/\.(mp4|webm|ogg)(\?.*)?$/i)) {
                return wrap(<video src={url} className="w-full h-full object-cover" controls playsInline />);
            }

            if (ytMatch) {
                const id = ytMatch[1];
                const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
                return wrap(<iframe src={src} className="w-full h-full" title="YouTube preview" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>);
            }

            if (vimeoMatch) {
                const id = vimeoMatch[1];
                const src = `https://player.vimeo.com/video/${id}`;
                return wrap(<iframe src={src} className="w-full h-full" title="Vimeo preview" frameBorder="0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen></iframe>);
            }

            // Fallback: tentar em iframe direto
            return wrap(<iframe src={url} className="w-full h-full" title="Video preview" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>);
        }

        if (type === 'doc') {
            const url = media?.pdf_url;
            if (!url) return wrap(<div className="h-full flex items-center justify-center text-slate-400"><Icon name="FileText" size={28} /></div>);
            return wrap(<iframe src={url} className="w-full h-full border-0" title="PDF"></iframe>);
        }

        if (type === 'live') {
            const url = media?.live_url;
            if (!url) return wrap(<div className="h-full flex items-center justify-center text-slate-400"><Icon name="Radio" size={28} /></div>);
            return wrap(<iframe src={url} className="w-full h-full border-0" allowFullScreen></iframe>);
        }

        if (type === 'code') {
            const code = media?.code || '';
            return wrap(
                <pre className="h-full overflow-auto p-4 text-xs leading-relaxed font-mono text-slate-700 dark:text-zinc-200 bg-slate-50 dark:bg-[#0B0C10]">
                    <code>{code}</code>
                </pre>
            );
        }

        // text
        return wrap(
            <div className="h-full overflow-auto p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: richHtml || '' }} />
            </div>
        );
    };

    const StudioView = () => {
        const canUse = !!SaasConfig.user?.can_edit_posts;
        const canManageUpsell = !!SaasConfig.user?.can_manage_upsell;

        const [courses, setCourses] = useState([]);
        const [loadingCourses, setLoadingCourses] = useState(false);
        const [search, setSearch] = useState('');
        const [statusFilter, setStatusFilter] = useState('all');
        const [selectedCourse, setSelectedCourse] = useState(null);
        const [mobilePane, setMobilePane] = useState('library');

        const [treeLoading, setTreeLoading] = useState(false);
        const [tree, setTree] = useState([]); // [{id,name,lessons:[]}]
        const [selectedEntity, setSelectedEntity] = useState(null); // {kind:'course'|'module'|'item', data:{...}}

        const [activeTab, setActiveTab] = useState('content');
        const [draft, setDraft] = useState(null);
        const [dirty, setDirty] = useState(false);
        const [saveState, setSaveState] = useState('');
        const [confirmSwitch, setConfirmSwitch] = useState(null);
        const [tourStep, setTourStep] = useState(-1);
        const [isFullscreen, setIsFullscreen] = useState(false);

        const refreshCourses = async () => {
            setLoadingCourses(true);
            try {
                const data = await apiFetch('studio/courses');
                setCourses(Array.isArray(data) ? data : []);
            } catch (e) {
                showToast(e.message || 'Erro ao carregar cursos', 'error');
            } finally {
                setLoadingCourses(false);
            }
        };

        const refreshTree = async (courseId) => {
            setTreeLoading(true);
            try {
                const data = await apiFetch(`studio/courses/${courseId}/items`);
                setTree(Array.isArray(data?.modules) ? data.modules : []);
            } catch (e) {
                showToast(e.message || 'Erro ao carregar estrutura', 'error');
            } finally {
                setTreeLoading(false);
            }
        };

        useEffect(() => {
            if (canUse) {
                refreshCourses();
                // Verificar se deve mostrar o tour
                const tourCompleted = localStorage.getItem('studio-tour-completed');
                if (!tourCompleted) {
                    setTimeout(() => setTourStep(0), 1000); // Delay para garantir que a UI está renderizada
                }
            }
        }, [canUse]);

        // Autosave (opcional v1)
        useEffect(() => {
            if (!dirty || !draft) return;
            const t = setTimeout(() => {
                handleSave({ silent: true });
            }, 20000);
            return () => clearTimeout(t);
        }, [dirty, draft]);

        const requestSwitchEntity = (nextEntity) => {
            if (dirty) {
                setConfirmSwitch(nextEntity);
                return;
            }
            applySwitchEntity(nextEntity);
        };

        const applySwitchEntity = async (entity) => {
            setConfirmSwitch(null);
            setSelectedEntity(entity);
            if (entity?.kind === 'item' || entity?.kind === 'module') { setMobilePane('editor'); }
            setActiveTab('content');
            setDirty(false);
            setSaveState('');

            if (!entity) {
                setDraft(null);
                return;
            }

            if (entity.kind === 'course') {
                try {
                    const d = await apiFetch(`studio/courses/${entity.data.id}`);
                    setDraft(d);
                } catch (e) {
                    showToast(e.message || 'Erro ao carregar curso', 'error');
                }
            }

            if (entity.kind === 'item') {
                try {
                    const d = await apiFetch(`studio/items/${entity.data.id}`);
                    setDraft(d);
                } catch (e) {
                    showToast(e.message || 'Erro ao carregar item', 'error');
                }
            }

            if (entity.kind === 'module') {
                // módulo: dados já estão no tree
                setDraft({ ...entity.data });
            }
        };

        const handleSelectCourse = async (course) => {
            setMobilePane('structure');
            setSelectedCourse(course);
            setSelectedEntity(null);
            setDraft(null);
            setDirty(false);
            await refreshTree(course.id);
            requestSwitchEntity({ kind: 'course', data: { id: course.id } });
        };

        const handleCreateCourse = async () => {
            try {
                const title = `Novo Curso ${new Date().toLocaleDateString('pt-BR')}`;
                const res = await apiFetch('studio/courses', { method: 'POST', body: JSON.stringify({ title, status: 'draft' }) });
                showToast('Curso criado com sucesso', 'success');
                await refreshCourses();
                const created = { id: res.id, title, status: 'draft' };
                await handleSelectCourse(created);
            } catch (e) {
                showToast(e.message || 'Erro ao criar curso', 'error');
            }
        };

        const handleCreateModule = async () => {
            if (!selectedCourse) return;
            try {
                const res = await apiFetch(`studio/courses/${selectedCourse.id}/modules`, { method: 'POST', body: JSON.stringify({ name: 'Novo Módulo' }) });
                showToast('Módulo criado com sucesso', 'success');
                await refreshTree(selectedCourse.id);
                requestSwitchEntity({ kind: 'module', data: { id: res.id, name: res.name } });
            } catch (e) {
                showToast(e.message || 'Erro ao criar módulo', 'error');
            }
        };

        const handleCreateItem = async (moduleId) => {
            if (!selectedCourse) return;
            try {
                const res = await apiFetch('studio/items', {
                    method: 'POST',
                    body: JSON.stringify({ course_id: selectedCourse.id, module_id: moduleId, title: 'Novo Conteúdo', status: 'draft', type: 'video' })
                });
                showToast('Conteúdo criado com sucesso', 'success');
                await refreshTree(selectedCourse.id);
                requestSwitchEntity({ kind: 'item', data: { id: res.id } });
            } catch (e) {
                showToast(e.message || 'Erro ao criar conteúdo', 'error');
            }
        };

        const handleMoveItem = async (moduleId, orderedIds) => {
            try {
                await apiFetch('studio/reorder', { method: 'POST', body: JSON.stringify({ course_id: selectedCourse?.id, module_id: moduleId, ordered_item_ids: orderedIds }) });
            } catch (e) {
                showToast(e.message || 'Erro ao reordenar', 'error');
            }
        };

        const handleDeleteCourse = async (courseId) => {
            try {
                await apiFetch(`studio/courses/${courseId}`, { method: 'DELETE' });
                showToast('Curso excluído com sucesso', 'success');
                await refreshCourses();
                if (selectedCourse?.id === courseId) {
                    setSelectedCourse(null);
                    setSelectedEntity(null);
                    setDraft(null);
                }
            } catch (e) {
                showToast(e.message || 'Erro ao excluir curso', 'error');
            }
        };

        const handleDeleteModule = async (moduleId) => {
            try {
                await apiFetch(`studio/modules/${moduleId}`, { method: 'DELETE' });
                showToast('Módulo excluído com sucesso', 'success');
                await refreshTree(selectedCourse?.id);
            } catch (e) {
                showToast(e.message || 'Erro ao excluir módulo', 'error');
            }
        };

        const handleDeleteItem = async (itemId) => {
            try {
                await apiFetch(`studio/items/${itemId}`, { method: 'DELETE' });
                showToast('Conteúdo excluído com sucesso', 'success');
                await refreshTree(selectedCourse?.id);
                if (selectedEntity?.kind === 'item' && draft?.id === itemId) {
                    setSelectedEntity(null);
                    setDraft(null);
                }
            } catch (e) {
                showToast(e.message || 'Erro ao excluir conteúdo', 'error');
            }
        };

        const mutateDraft = (patch) => {
            setDraft(prev => ({ ...(prev || {}), ...patch }));
            setDirty(true);
            setSaveState('Editando');
        };

        const mutateNested = (path, value) => {
            setDraft(prev => {
                const next = JSON.parse(JSON.stringify(prev || {}));
                let cur = next;
                for (let i = 0; i < path.length - 1; i++) {
                    const k = path[i];
                    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
                    cur = cur[k];
                }
                cur[path[path.length - 1]] = value;
                return next;
            });
            setDirty(true);
            setSaveState('Editando');
        };

        const handleSave = async ({ silent = false } = {}) => {
            if (!draft || !selectedEntity) return;
            // validação mínima por tipo
            if (selectedEntity.kind === 'item') {
                const t = draft.type;
                if (!draft.title || draft.title.trim() === '') {
                    if (!silent) showToast('Título é obrigatório', 'warning');
                    return;
                }
                if (t === 'video' && !(draft.media?.video_url || '').trim()) {
                    if (!silent) showToast('Video URL é obrigatório', 'warning');
                    return;
                }
                if (t === 'doc' && !(draft.media?.pdf_url || '').trim()) {
                    if (!silent) showToast('PDF URL é obrigatório', 'warning');
                    return;
                }
            }

            setSaveState('Salvando…');
            try {
                if (selectedEntity.kind === 'course') {
                    await apiFetch(`studio/courses/${draft.id}`, { method: 'PUT', body: JSON.stringify({
                        title: draft.title,
                        status: draft.status,
                        content: draft.content,
                        excerpt: draft.excerpt,
                    })});
                    if (!silent) showToast('Curso salvo com sucesso', 'success');
                    await refreshCourses();
                }

                if (selectedEntity.kind === 'module') {
                    await apiFetch(`studio/modules/${draft.id}`, { method: 'PUT', body: JSON.stringify({ name: draft.name })});
                    if (!silent) showToast('Módulo salvo com sucesso', 'success');
                    await refreshTree(selectedCourse?.id);
                }

                if (selectedEntity.kind === 'item') {
                    const payload = {
                        title: draft.title,
                        status: draft.status,
                        content: draft.content?.html || '',
                        excerpt: draft.content?.excerpt || '',
                        type: draft.type,
                        module_id: draft.module_id,
                        media: draft.media,
                        access: {
                            access: draft.access?.mode,
                            checkout_url: canManageUpsell ? draft.access?.checkout_url : undefined,
                            offer_title: canManageUpsell ? draft.access?.offer_title : undefined,
                            offer_price: canManageUpsell ? draft.access?.offer_price : undefined,
                            offer_bullets: canManageUpsell ? draft.access?.offer_bullets : undefined,
                        }
                    };
                    await apiFetch(`studio/items/${draft.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                    if (!silent) showToast('Conteúdo salvo com sucesso', 'success');
                    await refreshTree(selectedCourse?.id);
                }

                setDirty(false);
                setSaveState('Salvo');
            } catch (e) {
                if (!silent) showToast(e.message || 'Erro ao salvar', 'error');
                setSaveState('');
            }
        };

        if (!canUse) {
            return (
                <div className="text-center py-24">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Acesso restrito</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">Você não tem permissão para usar o Studio.</p>
                </div>
            );
        }

        const filteredCourses = courses.filter(c => {
            const okSearch = !search || (c.title || '').toLowerCase().includes(search.toLowerCase());
            const okStatus = statusFilter === 'all' ? true : c.status === statusFilter;
            return okSearch && okStatus;
        });

        const editorTabs = [
            { key: 'content', label: 'Conteúdo' },
            { key: 'media', label: 'Mídia' },
            { key: 'access', label: 'Acesso' },
            { key: 'publish', label: 'Publicação' },
            { key: 'extras', label: 'Extras' },
        ];

        const currentType = selectedEntity?.kind === 'item' ? draft?.type : null;

        // Product Tour Steps
        const tourSteps = [
            {
                title: 'Bem-vindo ao Studio CMS',
                description: 'Aqui você gerencia todos os seus cursos, módulos e conteúdos. Vamos conhecer as principais funcionalidades!',
                icon: 'Wand2',
                cardStyle: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
            },
            {
                title: 'Biblioteca de Cursos',
                description: 'Aqui estão todos os seus cursos. Use a busca para encontrar rapidamente e os filtros para ver apenas rascunhos ou publicados. Clique em um curso para editá-lo.',
                icon: 'BookOpen',
                cardStyle: { top: '20%', left: '15%' },
            },
            {
                title: 'Estrutura do Curso',
                description: 'Organize seu curso em módulos. O módulo "Geral" é padrão e não pode ser excluído. Módulos customizados têm visual diferenciado. Arraste conteúdos para reordenar.',
                icon: 'Network',
                cardStyle: { top: '20%', left: '50%', transform: 'translateX(-50%)' },
            },
            {
                title: 'Editor de Conteúdo',
                description: 'Edite seus cursos, módulos e conteúdos aqui. Use o botão de tela cheia para ter mais espaço. O preview atualiza em tempo real conforme você edita.',
                icon: 'Edit',
                cardStyle: { top: '20%', right: '15%' },
            },
        ];

        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 pb-6 lg:pb-12 relative px-2 sm:px-4 lg:px-0">
                <ModalConfirm
                    open={!!confirmSwitch}
                    title="Alterações não salvas"
                    message="Você tem mudanças pendentes. Salvar antes de sair?"
                    onCancel={() => { setDirty(false); applySwitchEntity(confirmSwitch); }}
                    onConfirm={async () => { await handleSave(); applySwitchEntity(confirmSwitch); }}
                    confirmText="Salvar"
                    cancelText="Descartar"
                />

                {/* Product Tour */}
                {tourStep >= 0 && (
                    <ProductTour
                        steps={tourSteps}
                        currentStep={tourStep}
                        onNext={() => setTourStep(prev => prev < tourSteps.length - 1 ? prev + 1 : -1)}
                        onPrev={() => setTourStep(prev => prev > 0 ? prev - 1 : -1)}
                        onClose={() => setTourStep(-1)}
                        onSkip={() => setTourStep(-1)}
                        showDontShowAgain={true}
                    />
                )}

                {/* Container de Toasts */}
                <div id="toast-container" className="fixed top-4 right-4 z-[9999] space-y-2"></div>

                
{/* MOBILE PANE SWITCHER */}
<div className="lg:hidden col-span-1 mb-3">
    <Card noHover className="p-3 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10">
        <div className="grid grid-cols-3 gap-2">
            <button
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    mobilePane === 'library' 
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' 
                        : 'bg-white dark:bg-white/5 text-slate-700 dark:text-zinc-200 hover:bg-white/90 dark:hover:bg-white/10'
                }`}
                onClick={() => setMobilePane('library')}
                type="button"
            >
                <Icon name="BookOpen" size={14} />
                Cursos
            </button>
            <button
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    mobilePane === 'structure' 
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' 
                        : 'bg-white dark:bg-white/5 text-slate-700 dark:text-zinc-200 hover:bg-white/90 dark:hover:bg-white/10'
                }`}
                onClick={() => setMobilePane('structure')}
                type="button"
            >
                <Icon name="Network" size={14} />
                Estrutura
            </button>
            <button
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    mobilePane === 'editor' 
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' 
                        : 'bg-white dark:bg-white/5 text-slate-700 dark:text-zinc-200 hover:bg-white/90 dark:hover:bg-white/10'
                }`}
                onClick={() => setMobilePane('editor')}
                type="button"
            >
                <Icon name="Edit" size={14} />
                Editor
            </button>
        </div>
    </Card>
</div>

                {/* COL A */}
                <div className={`lg:col-span-3 space-y-3 lg:space-y-4 ${mobilePane === 'library' ? '' : 'hidden lg:block'}`}>
                    <Card noHover className="p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-500/10 dark:to-violet-500/10 border-indigo-200/50 dark:border-indigo-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Icon name="Wand2" size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    Studio CMS
                                </h2>
                                <p className="text-[10px] text-slate-600 dark:text-zinc-400 mt-1">Gerencie seus cursos</p>
                            </div>
                        </div>
                        <StudioTooltip text="Criar um novo curso do zero">
                            <button
                                onClick={handleCreateCourse}
                                className="w-full px-4 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Icon name="Plus" size={14} />
                                Novo Curso
                            </button>
                        </StudioTooltip>
                        {courses.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-indigo-200/50 dark:border-indigo-500/20 grid grid-cols-2 gap-3">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{courses.length}</div>
                                    <div className="text-[10px] text-slate-600 dark:text-zinc-400">Cursos</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
                                        {courses.filter(c => c.status === 'publish').length}
                                    </div>
                                    <div className="text-[10px] text-slate-600 dark:text-zinc-400">Publicados</div>
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card noHover className="p-5">
                        <div className="space-y-4">
                            {/* Busca melhorada */}
                            <div className="relative">
                                <div className="flex items-center bg-white dark:bg-[#15161A] border-2 border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-sm">
                                    <Icon name="Search" size={16} className="text-slate-400 flex-shrink-0" />
                                    <input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Buscar por título, status..."
                                        className="w-full bg-transparent border-none text-sm ml-3 text-slate-700 dark:text-zinc-200 focus:outline-none placeholder:text-slate-400"
                                    />
                                    {search && (
                                        <button
                                            onClick={() => setSearch('')}
                                            className="ml-2 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                        >
                                            <Icon name="X" size={12} className="text-slate-400" />
                                        </button>
                                    )}
                                </div>
                                {search && (
                                    <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                                        {filteredCourses.length} {filteredCourses.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
                                    </div>
                                )}
                            </div>
                            
                            {/* Filtros visuais melhorados */}
                            <div>
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-2 block">Filtrar por status</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { key: 'all', label: 'Todos', icon: 'List', color: 'indigo' },
                                        { key: 'draft', label: 'Rascunho', icon: 'Edit', color: 'amber' },
                                        { key: 'publish', label: 'Publicado', icon: 'CheckCircle', color: 'emerald' },
                                    ].map(f => {
                                        const isActive = statusFilter === f.key;
                                        const count = f.key === 'all' ? courses.length : courses.filter(c => c.status === f.key).length;
                                        const activeClasses = f.key === 'all' 
                                            ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-transparent shadow-md'
                                            : f.key === 'draft'
                                            ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white border-transparent shadow-md'
                                            : 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-transparent shadow-md';
                                        return (
                                            <button
                                                key={f.key}
                                                onClick={() => setStatusFilter(f.key)}
                                                className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 flex flex-col items-center gap-1
                                                    ${isActive
                                                        ? activeClasses
                                                        : 'bg-white dark:bg-white/5 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-200 dark:hover:border-indigo-500/30'
                                                    }`}
                                            >
                                                <Icon name={f.icon} size={14} />
                                                <span>{f.label}</span>
                                                <span className={`text-[9px] ${isActive ? 'text-white/80' : 'text-slate-400'}`}>({count})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-3">
                        {loadingCourses ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <Icon name="Loader2" size={32} className="animate-spin text-indigo-500" />
                                <p className="text-sm text-slate-500 dark:text-zinc-400">Carregando cursos...</p>
                            </div>
                        ) : (
                            filteredCourses.map((c, i) => (
                                <CourseCard
                                    key={c.id}
                                    course={c}
                                    isActive={selectedCourse?.id === c.id}
                                    onClick={() => handleSelectCourse(c)}
                                    onDelete={() => handleDeleteCourse(c.id)}
                                    delay={i * 60}
                                />
                            ))
                        )}

                        {!loadingCourses && filteredCourses.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center">
                                    <Icon name="BookOpen" size={32} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Nenhum curso encontrado</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                                    {search || statusFilter !== 'all' ? 'Tente ajustar os filtros' : 'Crie seu primeiro curso para começar'}
                                </p>
                                {!search && statusFilter === 'all' && (
                                    <button
                                        onClick={handleCreateCourse}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                                    >
                                        <Icon name="Plus" size={14} />
                                        Criar primeiro curso
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* COL B */}
                <div className={`lg:col-span-4 space-y-3 lg:space-y-4 ${mobilePane === 'structure' ? '' : 'hidden lg:block'}`}>
                    <Card noHover className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Icon name="Network" size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    Estrutura do Curso
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                    {selectedCourse ? selectedCourse.title : 'Selecione um curso'}
                                </p>
                            </div>
                            <StudioTooltip text={selectedCourse ? "Adicionar novo módulo ao curso" : "Selecione um curso primeiro"}>
                                <button
                                    onClick={handleCreateModule}
                                    disabled={!selectedCourse}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed`}
                                >
                                    <Icon name="Plus" size={14} />
                                    Módulo
                                </button>
                            </StudioTooltip>
                        </div>
                        {selectedCourse && (
                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                                    <Icon name="Layers" size={14} />
                                    <span className="font-semibold">{tree.length} módulos</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                                    <Icon name="FileText" size={14} />
                                    <span className="font-semibold">
                                        {tree.reduce((acc, m) => acc + (m.items?.length || 0), 0)} conteúdos
                                    </span>
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card noHover className="p-5">
                        {!selectedCourse && (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                                    <Icon name="BookOpen" size={32} className="text-slate-400 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Nenhum curso selecionado</h3>
                                <p className="text-xs text-slate-500 dark:text-zinc-400">Selecione um curso na biblioteca para ver sua estrutura</p>
                            </div>
                        )}
                        {selectedCourse && treeLoading && (
                            <div className="flex items-center justify-center h-40"><Icon name="Loader2" size={24} className="animate-spin text-indigo-500" /></div>
                        )}
                        {selectedCourse && !treeLoading && (
                            <div className="space-y-4">
                                {tree.map((m) => {
                                    const ids = (m.items || []).map(x => x.id);
                                    const handleReorder = async (itemId, newIdx) => {
                                        if (newIdx < 0 || newIdx >= ids.length) return;
                                        const currentIdx = ids.indexOf(itemId);
                                        if (currentIdx === -1) return;
                                        const newOrder = [...ids];
                                        const [removed] = newOrder.splice(currentIdx, 1);
                                        newOrder.splice(newIdx, 0, removed);
                                        setTree(prev => prev.map(mm => mm.id === m.id ? ({ ...mm, items: newOrder.map(id => (mm.items || []).find(x => x.id === id)).filter(Boolean) }) : mm));
                                        await handleMoveItem(m.id, newOrder);
                                    };
                                    return (
                                        <ModuleCard
                                            key={m.id}
                                            module={m}
                                            items={m.items || []}
                                            onEdit={() => requestSwitchEntity({ kind: 'module', data: { id: m.id, name: m.name } })}
                                            onCreateItem={() => handleCreateItem(m.id)}
                                            onItemClick={(item) => requestSwitchEntity({ kind: 'item', data: { id: item.id } })}
                                            onReorder={handleReorder}
                                            onDelete={() => handleDeleteModule(m.id)}
                                            onDeleteItem={handleDeleteItem}
                                            isDefault={m.id === 0 || m.name === 'Geral'}
                                        />
                                    );
                                })}
                                {tree.length === 0 && (
                                    <div className="text-center py-16">
                                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center">
                                            <Icon name="Layers" size={32} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Nenhum módulo ainda</h3>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">Organize seu curso em módulos</p>
                                        <button
                                            onClick={handleCreateModule}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                                        >
                                            <Icon name="Plus" size={14} />
                                            Criar primeiro módulo
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>

                {/* COL C */}
                <div className={`lg:col-span-5 space-y-3 lg:space-y-4 ${mobilePane === 'editor' ? '' : 'hidden lg:block'}`}>
                    <Card noHover className="p-6">
                        {!selectedEntity && (
                            <div className="text-center py-24">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center">
                                    <Icon name="Wand2" size={40} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Editor Pronto</h2>
                                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-1">Selecione um curso, módulo ou conteúdo</p>
                                <p className="text-xs text-slate-400 dark:text-zinc-500">para começar a editar</p>
                                <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-zinc-500">
                                    <div className="flex items-center gap-2">
                                        <Icon name="BookOpen" size={14} />
                                        <span>Curso</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="Layers" size={14} />
                                        <span>Módulo</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Icon name="FileText" size={14} />
                                        <span>Conteúdo</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedEntity && !draft && (
                            <div className="flex items-center justify-center h-40"><Icon name="Loader2" size={24} className="animate-spin text-indigo-500" /></div>
                        )}

                        {selectedEntity && draft && (
                            <>
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                                                selectedEntity.kind === 'course' ? 'bg-gradient-to-br from-indigo-500 to-violet-600' :
                                                selectedEntity.kind === 'module' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                                                'bg-gradient-to-br from-emerald-500 to-teal-600'
                                            }`}>
                                                <Icon 
                                                    name={selectedEntity.kind === 'course' ? 'BookOpen' : selectedEntity.kind === 'module' ? 'Layers' : 'FileText'} 
                                                    size={18} 
                                                    className="text-white" 
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {selectedEntity.kind === 'course' ? 'Editor de Curso' : selectedEntity.kind === 'module' ? 'Editor de Módulo' : 'Editor de Conteúdo'}
                                                </p>
                                                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                                    {draft.title || draft.name || 'Sem título'}
                                                </h2>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-13">
                                            {saveState && (
                                                <div className="flex items-center gap-2 text-xs">
                                                    {saveState === 'Salvando…' && (
                                                        <>
                                                            <Icon name="Loader2" size={12} className="animate-spin text-indigo-500" />
                                                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Salvando…</span>
                                                        </>
                                                    )}
                                                    {saveState === 'Salvo' && (
                                                        <>
                                                            <Icon name="CheckCircle" size={12} className="text-emerald-500" />
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Salvo</span>
                                                        </>
                                                    )}
                                                    {saveState === 'Editando' && (
                                                        <>
                                                            <Icon name="Edit" size={12} className="text-amber-500" />
                                                            <span className="text-amber-600 dark:text-amber-400 font-medium">Editando</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {dirty && !saveState && (
                                                <span className="text-xs text-slate-400 dark:text-zinc-500">Alterações não salvas</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <StudioTooltip text="Abrir editor em tela cheia">
                                            <button
                                                onClick={() => setIsFullscreen(true)}
                                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95"
                                            >
                                                <Icon name="Maximize2" size={16} className="text-slate-600 dark:text-zinc-400" />
                                            </button>
                                        </StudioTooltip>
                                        <StudioTooltip text="Salvar e ver notificação">
                                            <button
                                                onClick={() => handleSave({ silent: false })}
                                                disabled={saveState === 'Salvando…'}
                                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {saveState === 'Salvando…' ? (
                                                    <>
                                                        <Icon name="Loader2" size={14} className="animate-spin" />
                                                        Salvando
                                                    </>
                                                ) : (
                                                    <>
                                                        <Icon name="Save" size={14} />
                                                        Salvar
                                                    </>
                                                )}
                                            </button>
                                        </StudioTooltip>
                                        <StudioTooltip text="Salvar silenciosamente e continuar editando">
                                            <button
                                                onClick={() => handleSave({ silent: true })}
                                                disabled={saveState === 'Salvando…'}
                                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                <Icon name="Check" size={14} />
                                                Continuar
                                            </button>
                                        </StudioTooltip>
                                    </div>
                                </div>


                                {/* COURSE */}
                                {selectedEntity.kind === 'course' && (
                                    <div className="mt-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título</label>
                                                <input
                                                    value={draft.title || ''}
                                                    onChange={(e) => mutateDraft({ title: e.target.value })}
                                                    onBlur={() => handleSave({ silent: true })}
                                                    className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                <select
                                                    value={draft.status || 'draft'}
                                                    onChange={(e) => mutateDraft({ status: e.target.value })}
                                                    onBlur={() => handleSave({ silent: true })}
                                                    className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                >
                                                    <option value="draft">Rascunho</option>
                                                    <option value="publish">Publicado</option>
                                                </select>
                                            </div>
                                        </div>


<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="md:col-span-2">
        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Capa do curso</label>
        <div className="mt-2 flex items-center gap-4">
            <div className="w-24 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#15161A] flex items-center justify-center">
                {draft.cover_url ? (
                    <img src={draft.cover_url} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                    <Icon name="Image" size={18} className="text-slate-400" />
                )}
            </div>

            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <label className="px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer">
                        Enviar capa
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                try {
                                    setSaveState('Enviando capa…');
                                    const up = await apiUpload('studio/media', f);
                                    mutateDraft({ cover_id: up.id, cover_url: up.url });
                                    await handleSave({ silent: true });
                                    showToast('Capa atualizada com sucesso', 'success');
                                    setSaveState('Salvo');
                                } catch (err) {
                                    showToast(err.message || 'Erro ao enviar capa', 'error');
                                    setSaveState('Erro ao salvar');
                                } finally {
                                    e.target.value = '';
                                }
                            }}
                        />
                    </label>

                    {draft.cover_url && (
                        <button
                            onClick={async () => {
                                mutateDraft({ cover_id: 0, cover_url: '' });
                                await handleSave({ silent: true });
                                showToast('Capa removida com sucesso', 'success');
                            }}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95"
                        >
                            Remover
                        </button>
                    )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">A capa aparece no app do aluno e no Studio.</p>
            </div>
        </div>
    </div>
</div>


                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Resumo</label>
                                            <textarea
                                                value={draft.excerpt || ''}
                                                onChange={(e) => mutateDraft({ excerpt: e.target.value })}
                                                onBlur={() => handleSave({ silent: true })}
                                                rows={3}
                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Descrição</label>
                                            <textarea
                                                value={draft.content || ''}
                                                onChange={(e) => mutateDraft({ content: e.target.value })}
                                                onBlur={() => handleSave({ silent: true })}
                                                rows={6}
                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* MODULE */}
                                {selectedEntity.kind === 'module' && (
                                    <div className="mt-6 space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Nome do Módulo</label>
                                            <input
                                                value={draft.name || ''}
                                                onChange={(e) => mutateDraft({ name: e.target.value })}
                                                onBlur={() => handleSave({ silent: true })}
                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ITEM */}
                                {selectedEntity.kind === 'item' && (
                                    <div className="mt-6">
                                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                            <div className="lg:col-span-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Criação guiada</div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white">Configure o conteúdo em etapas</div>
                                                    </div>
                                                    <StudioStepNavMobile tabs={editorTabs} active={activeTab} onChange={setActiveTab} />
                                                </div>

                                                <div className="hidden lg:block">
                                                    <StudioStepNav tabs={editorTabs} active={activeTab} onChange={setActiveTab} />
                                                </div>

                                                <div className="mt-4">
<div className="mt-2 space-y-4">
                                        {activeTab === 'content' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título</label>
                                                    <input
                                                        value={draft.title || ''}
                                                        onChange={(e) => mutateDraft({ title: e.target.value })}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Resumo</label>
                                                    <textarea
                                                        value={draft.content?.excerpt || ''}
                                                        onChange={(e) => mutateNested(['content','excerpt'], e.target.value)}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        rows={3}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Texto (HTML)</label>
                                                    <textarea
                                                        value={draft.content?.html || ''}
                                                        onChange={(e) => mutateNested(['content','html'], e.target.value)}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        rows={8}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                    <p className="text-[11px] text-slate-400 mt-2">Use HTML limpo. Renderiza no preview.</p>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'media' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="md:col-span-2">
                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Tipo</label>
                                                        <select
                                                            value={draft.type || 'video'}
                                                            onChange={(e) => mutateDraft({ type: e.target.value })}
                                                            onBlur={() => handleSave({ silent: true })}
                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        >
                                                            <option value="video">Vídeo</option>
                                                            <option value="doc">Documento (PDF)</option>
                                                            <option value="code">Código</option>
                                                            <option value="live">Live</option>
                                                            <option value="text">Texto Rico</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Duração</label>
                                                        <input
                                                            value={draft.media?.duration || ''}
                                                            onChange={(e) => mutateNested(['media','duration'], e.target.value)}
                                                            onBlur={() => handleSave({ silent: true })}
                                                            placeholder="Ex: 15 min"
                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>

                                                
{draft.type === 'video' && (
    <div>
        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Vídeo (URL)</label>
        <input
            value={draft.media?.video_url || ''}
            onChange={(e) => mutateNested(['media','video_url'], e.target.value)}
            onBlur={() => handleSave({ silent: true })}
            placeholder="https://..."
            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
        />
        <div className="mt-2 flex items-center gap-2">
            <label className="px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer">
                Enviar vídeo
                <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        try {
                            setSaveState('Enviando vídeo…');
                            const up = await apiUpload('studio/media', f);
                            mutateNested(['media','video_url'], up.url);
                            mutateNested(['media','video_attachment_id'], up.id);
                            await handleSave({ silent: true });
                            Toast.success('Vídeo enviado');
                            setSaveState('Salvo');
                        } catch (err) {
                            Toast.error(err.message || 'Erro ao enviar vídeo');
                            setSaveState('Erro ao salvar');
                        } finally {
                            e.target.value = '';
                        }
                    }}
                />
            </label>
            <p className="text-[11px] text-slate-400">Upload direto para a mídia do WordPress.</p>
        </div>
    </div>
)}

                                                {draft.type === 'doc' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">PDF URL</label>
                                                            <input
                                                                value={draft.media?.pdf_url || ''}
                                                                onChange={(e) => mutateNested(['media','pdf_url'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                placeholder="https://.../arquivo.pdf"
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Páginas</label>
                                                            <input
                                                                value={draft.media?.pages || ''}
                                                                onChange={(e) => mutateNested(['media','pages'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                placeholder="Ex: 120"
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {draft.type === 'code' && (
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Linguagem</label>
                                                            <input
                                                                value={draft.media?.code_language || ''}
                                                                onChange={(e) => mutateNested(['media','code_language'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                placeholder="Ex: JavaScript"
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Código</label>
                                                            <textarea
                                                                value={draft.media?.code || ''}
                                                                onChange={(e) => mutateNested(['media','code'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                rows={8}
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Instruções</label>
                                                            <textarea
                                                                value={draft.media?.instructions || ''}
                                                                onChange={(e) => mutateNested(['media','instructions'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                rows={4}
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {draft.type === 'live' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Live URL</label>
                                                            <input
                                                                value={draft.media?.live_url || ''}
                                                                onChange={(e) => mutateNested(['media','live_url'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                placeholder="https://..."
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                            <select
                                                                value={draft.media?.live_status || 'scheduled'}
                                                                onChange={(e) => mutateNested(['media','live_status'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            >
                                                                <option value="scheduled">Agendada</option>
                                                                <option value="live">Ao vivo</option>
                                                                <option value="ended">Encerrada</option>
                                                            </select>
                                                        </div>
                                                        <div className="md:col-span-3">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Data/Hora</label>
                                                            <input
                                                                value={draft.media?.live_datetime || ''}
                                                                onChange={(e) => mutateNested(['media','live_datetime'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                placeholder="2026-01-10 19:30"
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'access' && (
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Modo</label>
                                                    <div className="mt-2 flex gap-2">
                                                        {[
                                                            { key: 'free', label: 'Grátis' },
                                                            { key: 'paid', label: 'Pago' },
                                                            { key: 'mixed', label: 'Misto' },
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.key}
                                                                onClick={() => mutateNested(['access','mode'], opt.key)}
                                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95
                                                                    ${draft.access?.mode === opt.key
                                                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                                                                        : 'bg-white dark:bg-white/5 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-200 dark:hover:border-white/20'
                                                                    }`}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-2">Editor não altera financeiro.</p>
                                                </div>

                                                <div className={`${canManageUpsell ? '' : 'opacity-50 pointer-events-none'} space-y-4`}>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Checkout URL</label>
                                                        <input
                                                            value={draft.access?.checkout_url || ''}
                                                            onChange={(e) => mutateNested(['access','checkout_url'], e.target.value)}
                                                            onBlur={() => handleSave({ silent: true })}
                                                            placeholder="https://..."
                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div className="md:col-span-2">
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título da Oferta</label>
                                                            <input
                                                                value={draft.access?.offer_title || ''}
                                                                onChange={(e) => mutateNested(['access','offer_title'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Preço (opcional)</label>
                                                            <input
                                                                value={draft.access?.offer_price || ''}
                                                                onChange={(e) => mutateNested(['access','offer_price'], e.target.value)}
                                                                onBlur={() => handleSave({ silent: true })}
                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Bullets</label>
                                                        <textarea
                                                            value={(draft.access?.offer_bullets || []).join('\n')}
                                                            onChange={(e) => mutateNested(['access','offer_bullets'], e.target.value.split('\n').map(l => l.trim()).filter(Boolean))}
                                                            onBlur={() => handleSave({ silent: true })}
                                                            rows={6}
                                                            placeholder="1 benefício por linha"
                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'publish' && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                    <select
                                                        value={draft.status || 'draft'}
                                                        onChange={(e) => mutateDraft({ status: e.target.value })}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    >
                                                        <option value="draft">Rascunho</option>
                                                        <option value="publish">Publicado</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Ordem</label>
                                                    <input
                                                        type="number"
                                                        value={draft.menu_order || 0}
                                                        onChange={(e) => mutateDraft({ menu_order: parseInt(e.target.value || '0', 10) })}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {activeTab === 'extras' && (
                                            <div className="space-y-4">
                                                {draft.type === 'doc' && (
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Tempo de leitura</label>
                                                        <input
                                                            value={draft.media?.read_time || ''}
                                                            onChange={(e) => mutateNested(['media','read_time'], e.target.value)}
                                                            onBlur={() => handleSave({ silent: true })}
                                                            placeholder="Ex: 30 min"
                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                        />
                                                    </div>
                                                )}
                                                <div className="text-xs text-slate-400">Extras do v1. Expande na próxima versão.</div>
                                            </div>
                                        )}
                                    </div>
                                                </div>

                                                <StudioStepFooter
                                                    tabs={editorTabs}
                                                    active={activeTab}
                                                    onPrev={() => {
                                                        const order = editorTabs.map(t => t.key);
                                                        const idx = order.indexOf(activeTab);
                                                        const prev = order[Math.max(0, idx - 1)];
                                                        setActiveTab(prev);
                                                    }}
                                                    onNext={() => {
                                                        const order = editorTabs.map(t => t.key);
                                                        const idx = order.indexOf(activeTab);
                                                        const next = order[Math.min(order.length - 1, idx + 1)];
                                                        setActiveTab(next);
                                                    }}
                                                />
                                            </div>

                                            <div className="lg:col-span-2">
                                                <div className="lg:sticky lg:top-6">
                                                    <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Preview</div>
                                                    <PreviewPanel type={currentType} media={draft.media} richHtml={draft.content?.html} />
                                                    <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                                                        O preview atualiza conforme você edita.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>
                </div>

                {/* Editor em Tela Cheia */}
                <FullscreenEditor
                    isOpen={isFullscreen}
                    onClose={() => setIsFullscreen(false)}
                    title={selectedEntity ? (selectedEntity.kind === 'course' ? 'Editor de Curso' : selectedEntity.kind === 'module' ? 'Editor de Módulo' : 'Editor de Conteúdo') : 'Editor'}
                >
                    {selectedEntity && draft && (
                        <div className="max-w-full mx-auto w-full">
                            <div className="bg-white dark:bg-[#15161A] rounded-2xl p-8 shadow-xl">
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                                        {draft.title || draft.name || 'Sem título'}
                                    </h2>
                                    <p className="text-sm text-slate-500 dark:text-zinc-400">
                                        {selectedEntity.kind === 'course' ? 'Edite as informações do curso' : 
                                         selectedEntity.kind === 'module' ? 'Edite o nome do módulo' : 
                                         'Edite o conteúdo da aula'}
                                    </p>
                                </div>
                                
                                {/* Renderizar o conteúdo completo do editor */}
                                <div className="space-y-6">
                                    {/* COURSE */}
                                    {selectedEntity.kind === 'course' && (
                                        <div className="mt-6 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título</label>
                                                    <input
                                                        value={draft.title || ''}
                                                        onChange={(e) => mutateDraft({ title: e.target.value })}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                    <select
                                                        value={draft.status || 'draft'}
                                                        onChange={(e) => mutateDraft({ status: e.target.value })}
                                                        onBlur={() => handleSave({ silent: true })}
                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                    >
                                                        <option value="draft">Rascunho</option>
                                                        <option value="publish">Publicado</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Capa do curso</label>
                                                    <div className="mt-2 flex items-center gap-4">
                                                        <div className="w-24 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#15161A] flex items-center justify-center">
                                                            {draft.cover_url ? (
                                                                <img src={draft.cover_url} alt="Capa" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Icon name="Image" size={18} className="text-slate-400" />
                                                            )}
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <label className="px-4 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer">
                                                                    Enviar capa
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={async (e) => {
                                                                            const f = e.target.files?.[0];
                                                                            if (!f) return;
                                                                            try {
                                                                                setSaveState('Enviando capa…');
                                                                                const up = await apiUpload('studio/media', f);
                                                                                mutateDraft({ cover_id: up.id, cover_url: up.url });
                                                                                await handleSave({ silent: true });
                                                                                showToast('Capa atualizada com sucesso', 'success');
                                                                                setSaveState('Salvo');
                                                                            } catch (err) {
                                                                                showToast(err.message || 'Erro ao enviar capa', 'error');
                                                                                setSaveState('Erro ao salvar');
                                                                            } finally {
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>

                                                                {draft.cover_url && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            mutateDraft({ cover_id: 0, cover_url: '' });
                                                                            await handleSave({ silent: true });
                                                                            showToast('Capa removida com sucesso', 'success');
                                                                        }}
                                                                        className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-all active:scale-95"
                                                                    >
                                                                        Remover
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-2">A capa aparece no app do aluno e no Studio.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Resumo</label>
                                                <textarea
                                                    value={draft.excerpt || ''}
                                                    onChange={(e) => mutateDraft({ excerpt: e.target.value })}
                                                    onBlur={() => handleSave({ silent: true })}
                                                    rows={3}
                                                    className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Descrição</label>
                                                <textarea
                                                    value={draft.content || ''}
                                                    onChange={(e) => mutateDraft({ content: e.target.value })}
                                                    onBlur={() => handleSave({ silent: true })}
                                                    rows={6}
                                                    className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* MODULE */}
                                    {selectedEntity.kind === 'module' && (
                                        <div className="mt-6 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Nome do Módulo</label>
                                                <input
                                                    value={draft.name || ''}
                                                    onChange={(e) => mutateDraft({ name: e.target.value })}
                                                    onBlur={() => handleSave({ silent: true })}
                                                    className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* ITEM */}
                                    {selectedEntity.kind === 'item' && (
                                        <div className="mt-6">
                                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                                <div className="lg:col-span-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">Criação guiada</div>
                                                            <div className="text-sm font-bold text-slate-900 dark:text-white">Configure o conteúdo em etapas</div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 space-y-4">
                                                        {activeTab === 'content' && (
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título</label>
                                                                    <input
                                                                        value={draft.title || ''}
                                                                        onChange={(e) => mutateDraft({ title: e.target.value })}
                                                                        onBlur={() => handleSave({ silent: true })}
                                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Resumo</label>
                                                                    <textarea
                                                                        value={draft.content?.excerpt || ''}
                                                                        onChange={(e) => mutateNested(['content','excerpt'], e.target.value)}
                                                                        onBlur={() => handleSave({ silent: true })}
                                                                        rows={3}
                                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                    />
                                                                </div>

                                                                <div>
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Texto (HTML)</label>
                                                                    <textarea
                                                                        value={draft.content?.html || ''}
                                                                        onChange={(e) => mutateNested(['content','html'], e.target.value)}
                                                                        onBlur={() => handleSave({ silent: true })}
                                                                        rows={8}
                                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                    />
                                                                    <p className="text-[11px] text-slate-400 mt-2">Use HTML limpo. Renderiza no preview.</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {activeTab === 'media' && (
                                                            <div className="space-y-4">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    <div className="md:col-span-2">
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Tipo</label>
                                                                        <select
                                                                            value={draft.type || 'video'}
                                                                            onChange={(e) => mutateDraft({ type: e.target.value })}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        >
                                                                            <option value="video">Vídeo</option>
                                                                            <option value="doc">Documento (PDF)</option>
                                                                            <option value="code">Código</option>
                                                                            <option value="live">Live</option>
                                                                            <option value="text">Texto Rico</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Duração</label>
                                                                        <input
                                                                            value={draft.media?.duration || ''}
                                                                            onChange={(e) => mutateNested(['media','duration'], e.target.value)}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            placeholder="Ex: 15 min"
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {draft.type === 'video' && (
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Vídeo (URL)</label>
                                                                        <input
                                                                            value={draft.media?.video_url || ''}
                                                                            onChange={(e) => mutateNested(['media','video_url'], e.target.value)}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            placeholder="https://..."
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        />
                                                                        <div className="mt-2 flex items-center gap-2">
                                                                            <label className="px-3 py-2 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95 cursor-pointer">
                                                                                Enviar vídeo
                                                                                <input
                                                                                    type="file"
                                                                                    accept="video/*"
                                                                                    className="hidden"
                                                                                    onChange={async (e) => {
                                                                                        const f = e.target.files?.[0];
                                                                                        if (!f) return;
                                                                                        try {
                                                                                            setSaveState('Enviando vídeo…');
                                                                                            const up = await apiUpload('studio/media', f);
                                                                                            mutateNested(['media','video_url'], up.url);
                                                                                            mutateNested(['media','video_attachment_id'], up.id);
                                                                                            await handleSave({ silent: true });
                                                                                            Toast.success('Vídeo enviado');
                                                                                            setSaveState('Salvo');
                                                                                        } catch (err) {
                                                                                            Toast.error(err.message || 'Erro ao enviar vídeo');
                                                                                            setSaveState('Erro ao salvar');
                                                                                        } finally {
                                                                                            e.target.value = '';
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </label>
                                                                            <p className="text-[11px] text-slate-400">Upload direto para a mídia do WordPress.</p>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {draft.type === 'doc' && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                        <div className="md:col-span-2">
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">PDF URL</label>
                                                                            <input
                                                                                value={draft.media?.pdf_url || ''}
                                                                                onChange={(e) => mutateNested(['media','pdf_url'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                placeholder="https://.../arquivo.pdf"
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Páginas</label>
                                                                            <input
                                                                                value={draft.media?.pages || ''}
                                                                                onChange={(e) => mutateNested(['media','pages'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                placeholder="Ex: 120"
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {draft.type === 'code' && (
                                                                    <div className="space-y-4">
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Linguagem</label>
                                                                            <input
                                                                                value={draft.media?.code_language || ''}
                                                                                onChange={(e) => mutateNested(['media','code_language'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                placeholder="Ex: JavaScript"
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Código</label>
                                                                            <textarea
                                                                                value={draft.media?.code || ''}
                                                                                onChange={(e) => mutateNested(['media','code'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                rows={8}
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Instruções</label>
                                                                            <textarea
                                                                                value={draft.media?.instructions || ''}
                                                                                onChange={(e) => mutateNested(['media','instructions'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                rows={4}
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {draft.type === 'live' && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                        <div className="md:col-span-2">
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Live URL</label>
                                                                            <input
                                                                                value={draft.media?.live_url || ''}
                                                                                onChange={(e) => mutateNested(['media','live_url'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                placeholder="https://..."
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                                            <select
                                                                                value={draft.media?.live_status || 'scheduled'}
                                                                                onChange={(e) => mutateNested(['media','live_status'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            >
                                                                                <option value="scheduled">Agendada</option>
                                                                                <option value="live">Ao vivo</option>
                                                                                <option value="ended">Encerrada</option>
                                                                            </select>
                                                                        </div>
                                                                        <div className="md:col-span-3">
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Data/Hora</label>
                                                                            <input
                                                                                value={draft.media?.live_datetime || ''}
                                                                                onChange={(e) => mutateNested(['media','live_datetime'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                placeholder="2026-01-10 19:30"
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activeTab === 'access' && (
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Modo</label>
                                                                    <div className="mt-2 flex gap-2">
                                                                        {[
                                                                            { key: 'free', label: 'Grátis' },
                                                                            { key: 'paid', label: 'Pago' },
                                                                            { key: 'mixed', label: 'Misto' },
                                                                        ].map(opt => (
                                                                            <button
                                                                                key={opt.key}
                                                                                onClick={() => mutateNested(['access','mode'], opt.key)}
                                                                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95
                                                                                    ${draft.access?.mode === opt.key
                                                                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                                                                                        : 'bg-white dark:bg-white/5 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-white/10 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-200 dark:hover:border-white/20'
                                                                                    }`}
                                                                            >
                                                                                {opt.label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-400 mt-2">Editor não altera financeiro.</p>
                                                                </div>

                                                                <div className={`${canManageUpsell ? '' : 'opacity-50 pointer-events-none'} space-y-4`}>
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Checkout URL</label>
                                                                        <input
                                                                            value={draft.access?.checkout_url || ''}
                                                                            onChange={(e) => mutateNested(['access','checkout_url'], e.target.value)}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            placeholder="https://..."
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                        <div className="md:col-span-2">
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Título da Oferta</label>
                                                                            <input
                                                                                value={draft.access?.offer_title || ''}
                                                                                onChange={(e) => mutateNested(['access','offer_title'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Preço (opcional)</label>
                                                                            <input
                                                                                value={draft.access?.offer_price || ''}
                                                                                onChange={(e) => mutateNested(['access','offer_price'], e.target.value)}
                                                                                onBlur={() => handleSave({ silent: true })}
                                                                                className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Bullets</label>
                                                                        <textarea
                                                                            value={(draft.access?.offer_bullets || []).join('\n')}
                                                                            onChange={(e) => mutateNested(['access','offer_bullets'], e.target.value.split('\n').map(l => l.trim()).filter(Boolean))}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            rows={6}
                                                                            placeholder="1 benefício por linha"
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {activeTab === 'publish' && (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div className="md:col-span-2">
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Status</label>
                                                                    <select
                                                                        value={draft.status || 'draft'}
                                                                        onChange={(e) => mutateDraft({ status: e.target.value })}
                                                                        onBlur={() => handleSave({ silent: true })}
                                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                    >
                                                                        <option value="draft">Rascunho</option>
                                                                        <option value="publish">Publicado</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Ordem</label>
                                                                    <input
                                                                        type="number"
                                                                        value={draft.menu_order || 0}
                                                                        onChange={(e) => mutateDraft({ menu_order: parseInt(e.target.value || '0', 10) })}
                                                                        onBlur={() => handleSave({ silent: true })}
                                                                        className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {activeTab === 'extras' && (
                                                            <div className="space-y-4">
                                                                {draft.type === 'doc' && (
                                                                    <div>
                                                                        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">Tempo de leitura</label>
                                                                        <input
                                                                            value={draft.media?.read_time || ''}
                                                                            onChange={(e) => mutateNested(['media','read_time'], e.target.value)}
                                                                            onBlur={() => handleSave({ silent: true })}
                                                                            placeholder="Ex: 30 min"
                                                                            className="mt-2 w-full px-4 py-3 rounded-xl bg-white dark:bg-[#15161A] border border-slate-200 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="text-xs text-slate-400">Extras do v1. Expande na próxima versão.</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-2">
                                                    <div className="lg:sticky lg:top-6">
                                                        <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Preview</div>
                                                        <PreviewPanel type={currentType} media={draft.media} richHtml={draft.content?.html} />
                                                        <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                                                            O preview atualiza conforme você edita.
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </FullscreenEditor>
            </div>
        );
    };

    const App = () => {
        const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// --- NAVEGAÇÃO (URL ÚNICA FIXA) ---
// Não altere window.location. Navegação por estado interno.
const [currentView, setCurrentView] = useState('dashboard');
const [selectedCourseId, setSelectedCourseId] = useState(null);

const navigate = (view, data = null) => {
    if (view === 'player') {
        const id = parseInt(String(data || ''), 10);
        if (!Number.isFinite(id)) return;
        setSelectedCourseId(id);
        setCurrentView('player');
        return;
    }
    setSelectedCourseId(null);
    setCurrentView(view);
};


        const MobileDrawer = ({ isOpen, onClose, children }) => (
            <>
                <div 
                    className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={onClose}
                />
                <aside 
                    className={`fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-[#09090b] z-50 transform transition-transform duration-300 md:hidden shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    {children}
                </aside>
            </>
        );

        if (currentView === 'player') {
            return (
                <ThemeProvider>
                    <LayoutContainer>
                        <PlayerView 
                            courseId={selectedCourseId} 
                            onBack={() => navigate('courses')} 
                        />
                    </LayoutContainer>
                </ThemeProvider>
            );
        }

        return (
            <ThemeProvider>
                <LayoutContainer>
                    <aside className="hidden md:block w-72 h-full relative z-20 shrink-0">
                        <SidebarContent currentView={currentView} setView={navigate} />
                    </aside>

                    <MobileDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}>
                        <SidebarContent currentView={currentView} setView={navigate} onCloseMobile={() => setMobileMenuOpen(false)} />
                    </MobileDrawer>

                    <main className="flex-1 flex flex-col h-full min-w-0 relative z-10">
                        <Header onMenuClick={() => setMobileMenuOpen(true)} title={currentView} />
                        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                            <div className="w-full max-w-[1600px] mx-auto p-6 md:p-8">
                                {currentView === 'dashboard' && <DashboardView setView={navigate} />}
                                {currentView === 'courses' && <CoursesView onSelectCourse={(id) => navigate('player', id)} />}
                                {currentView === 'studio' && <StudioView />}
                                {currentView === 'explore' && (
                                    <div className="text-center py-20">
                                        <h2 className="text-xl font-bold dark:text-white">Em breve</h2>
                                    </div>
                                )}
                            </div>
                        </div>
                    </main>
                </LayoutContainer>
            </ThemeProvider>
        );
    };

    const rootId = (typeof SaasConfig !== 'undefined' && SaasConfig.root) ? SaasConfig.root : 'saas-root';
    const container = document.getElementById(rootId);

    const showBootError = (title, detail) => {
        const target = container || document.body;
        const box = document.createElement('div');
        box.style.padding = '16px';
        box.style.margin = '16px';
        box.style.border = '1px solid rgba(255,0,0,0.25)';
        box.style.borderRadius = '12px';
        box.style.background = 'rgba(255,0,0,0.06)';
        box.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        box.style.whiteSpace = 'pre-wrap';
        box.innerText = `[Nexus SaaS] ${title}

${detail || ''}`;
        target.appendChild(box);
    };

    if (!container) {
        showBootError('Root não encontrado', `Não achei o container com id "${rootId}". Verifique se o shortcode [saas_area] está na página.`);
        return;
    }

    try {
        const style = document.createElement('style');
        style.innerHTML = `
            .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.35); border-radius: 999px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.55); }
            .animate-blob { animation: blob 10s infinite; }
            .animation-delay-2000 { animation-delay: 2000ms; }
            .animation-delay-4000 { animation-delay: 4000ms; }
            .fill-mode-forwards { animation-fill-mode: forwards; }

            /* Nexus SaaS: animações locais (evita conteúdo invisível quando o Engine não fornece keyframes) */
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes slideRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
            .animate-fade-in { animation: fadeIn 420ms ease-out forwards; }
            .animate-slide-up { animation: slideUp 520ms ease-out forwards; }
            .animate-slide-right { animation: slideRight 520ms ease-out forwards; }
        `;
        document.head.appendChild(style);

        window.ReactDOM.render(<App />, container);
    } catch (e) {
        showBootError('Falha ao iniciar o app', (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e));
    }
})();