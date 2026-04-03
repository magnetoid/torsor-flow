"use client";

import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Code2, Play, Settings, Box, CircleDashed,
  CheckCircle2, Copy, Download, X, ChevronDown
} from 'lucide-react';
import Editor from '@monaco-editor/react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Provider = 'openai' | 'anthropic' | 'gemini';
type AgentConfig = { provider: Provider; model: string };
type StepData = { name: string; code: string };

const PROVIDERS: { id: Provider; label: string; models: string[] }[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
];

const DEFAULT_AGENT: Record<string, AgentConfig> = {
  generator: { provider: 'openai', model: 'gpt-4o-mini' },
  fixer: { provider: 'openai', model: 'gpt-4o-mini' },
  optimizer: { provider: 'openai', model: 'gpt-4o-mini' },
};

const STEP_DEFS = [
  { key: 'generator', label: '1. Generator', icon: CircleDashed, description: 'Drafts initial code' },
  { key: 'fixer',     label: '2. Fixer',     icon: Box,           description: 'Reviews & fixes bugs' },
  { key: 'optimizer', label: '3. Optimizer', icon: Sparkles,      description: 'Polishes & optimizes' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ openai: '', anthropic: '', gemini: '' });
  const [agents, setAgents] = useState(DEFAULT_AGENT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [activeTab, setActiveTab] = useState<'generator' | 'fixer' | 'optimizer' | 'final'>('final');
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'system', content: 'System initialized. Ready for vibe coding. What would you like to build today? 🚀' },
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const addMessage = (role: string, content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
    setTimeout(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }, 50);
  };

  const getEditorCode = (): string => {
    if (activeTab === 'final') return steps[2]?.code ?? steps[steps.length - 1]?.code ?? '// Awaiting results...';
    const idx = { generator: 0, fixer: 1, optimizer: 2 }[activeTab];
    return steps[idx]?.code ?? `// ${activeTab} output not yet available...`;
  };

  const copyCode = useCallback(() => {
    const code = getEditorCode();
    navigator.clipboard.writeText(code).then(() => addMessage('system', 'Code copied to clipboard! 📋'));
  }, [steps, activeTab]);

  const downloadCode = useCallback(() => {
    const code = getEditorCode();
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vibe-coder-${activeTab}.tsx`;
    a.click();
  }, [steps, activeTab]);

  const handleVibe = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setCurrentStep(0);
    setSteps([]);
    addMessage('user', prompt);

    try {
      const res = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, apiKeys, agents }),
      });

      if (!res.body) throw new Error('No stream body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const lines = event.split('\n');
          const eventType = lines.find((l) => l.startsWith('event:'))?.slice(7).trim();
          const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(6).trim();
          if (!dataLine) continue;

          try {
            const data = JSON.parse(dataLine);

            if (eventType === 'step_start') {
              setCurrentStep(data.step);
              const providerLabel = PROVIDERS.find((p) => p.id === data.provider)?.label ?? '';
              addMessage('system', `▶ ${data.name} agent is working… ${providerLabel ? `(${providerLabel})` : ''}`);
            } else if (eventType === 'step_done') {
              setSteps((prev) => {
                const next = [...prev];
                next[data.step - 1] = { name: data.name, code: data.code };
                return next;
              });
              const tabMap: Record<number, typeof activeTab> = { 1: 'generator', 2: 'fixer', 3: 'optimizer' };
              setActiveTab(tabMap[data.step] ?? 'final');
              addMessage('system', `✅ ${data.name} finished.`);
            } else if (eventType === 'done') {
              setCurrentStep(4);
              setActiveTab('final');
              addMessage('system', 'Agent array done! Code generated, reviewed, and optimized. ✨');
            } else if (eventType === 'error') {
              throw new Error(data.message);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      addMessage('system', `❌ Error: ${err.message}`);
      setCurrentStep(0);
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const getStepStatus = (n: number) => {
    if (steps[n - 1]) return 'done';
    if (currentStep === n && isGenerating) return 'active';
    return 'pending';
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <header className="glass-panel header animate-fade-in">
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <Sparkles className="logo-icon" size={22} />
          </div>
          <h1 className="text-gradient">Vibe Coder</h1>
          <span className="badge">Multi-Agent AI</span>
        </div>
        <button className="btn-icon gear-btn" onClick={() => setShowSettings(!showSettings)}>
          <Settings size={20} className={showSettings ? 'spinning' : ''} />
        </button>
      </header>

      {/* Settings Drawer */}
      {showSettings && (
        <div className="settings-drawer glass-panel animate-fade-in">
          <div className="settings-header">
            <h3>Configuration</h3>
            <button className="btn-icon" onClick={() => setShowSettings(false)}><X size={16} /></button>
          </div>

          <div className="settings-columns">
            {/* API Keys */}
            <div className="settings-section">
              <h4 className="settings-subtitle">API Keys</h4>
              {PROVIDERS.map((p) => (
                <div className="input-group" key={p.id}>
                  <label>{p.label}</label>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder={`${p.id === 'openai' ? 'sk-...' : p.id === 'anthropic' ? 'sk-ant-...' : 'AI...'}`}
                    value={apiKeys[p.id]}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {/* Agent Config */}
            <div className="settings-section">
              <h4 className="settings-subtitle">Agent Models</h4>
              {STEP_DEFS.map(({ key, label, description }) => (
                <div className="input-group" key={key}>
                  <label>{label} <span className="label-desc">{description}</span></label>
                  <div className="select-row">
                    <div className="select-wrapper">
                      <select
                        className="settings-select"
                        value={agents[key].provider}
                        onChange={(e) => {
                          const newProvider = e.target.value as Provider;
                          const defaultModel = PROVIDERS.find((p) => p.id === newProvider)!.models[0];
                          setAgents((prev) => ({ ...prev, [key]: { provider: newProvider, model: defaultModel } }));
                        }}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="select-icon" />
                    </div>
                    <div className="select-wrapper">
                      <select
                        className="settings-select"
                        value={agents[key].model}
                        onChange={(e) => setAgents((prev) => ({ ...prev, [key]: { ...prev[key], model: e.target.value } }))}
                      >
                        {PROVIDERS.find((p) => p.id === agents[key].provider)?.models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="select-icon" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="main-layout">

        {/* Left Panel */}
        <section className="left-panel glass-panel animate-fade-in">
          <div className="pipeline-status">
            <h2 className="section-title">Agent Array</h2>
            <div className="pipeline-steps">
              {STEP_DEFS.map(({ key, label, icon: Icon }, i) => {
                const n = i + 1;
                const status = getStepStatus(n);
                const providerLabel = PROVIDERS.find((p) => p.id === agents[key].provider)?.label;
                return (
                  <React.Fragment key={key}>
                    <div className={`step step-${status}`}>
                      {status === 'done'
                        ? <CheckCircle2 size={16} className="step-icon-done" />
                        : <Icon size={16} className={status === 'active' ? 'spin' : ''} />}
                      <div className="step-text">
                        <span className="step-label">{label}</span>
                        <span className="step-meta">{providerLabel} · {agents[key].model}</span>
                      </div>
                    </div>
                    {i < 2 && <div className={`connector ${steps[i] ? 'connector-lit' : ''}`} />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="chat-container">
            <div className="chat-history" ref={chatRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.role}`}>
                  {msg.role === 'user' && <span className="msg-prefix">You</span>}
                  {msg.content}
                </div>
              ))}
            </div>
            <div className="prompt-area">
              <textarea
                className="prompt-input"
                placeholder="Describe what you want to build… (Enter to run)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleVibe(); } }}
                disabled={isGenerating}
                rows={3}
              />
              <button className="btn-primary run-btn" onClick={handleVibe} disabled={isGenerating || !prompt.trim()}>
                {isGenerating
                  ? <><CircleDashed size={16} className="spin" /> Vibing…</>
                  : <><Play size={16} /> Vibe It</>}
              </button>
            </div>
          </div>
        </section>

        {/* Right Panel */}
        <section className="right-panel glass-panel animate-fade-in">
          <div className="editor-header">
            <div className="tabs">
              {(['generator', 'fixer', 'optimizer', 'final'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'final' ? <><Sparkles size={12} /> Final</> : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <div className="editor-actions">
              <button className="btn-tool" onClick={copyCode} title="Copy code">
                <Copy size={15} />
              </button>
              <button className="btn-tool" onClick={downloadCode} title="Download .tsx">
                <Download size={15} />
              </button>
            </div>
          </div>
          <div className="editor-area">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={getEditorCode()}
              options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', padding: { top: 16 }, readOnly: isGenerating }}
            />
          </div>
        </section>

      </main>

      <style jsx>{`
        .workspace-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 0.85rem;
          gap: 0.85rem;
          background-image:
            radial-gradient(circle at 80% 0%, rgba(139, 92, 246, 0.12), transparent 35%),
            radial-gradient(circle at 10% 100%, rgba(236, 72, 153, 0.06), transparent 35%);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.7rem 1.5rem;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .logo-section { display: flex; align-items: center; gap: 0.75rem; }

        .logo-icon-wrapper {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          padding: 0.45rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.35);
        }
        .logo-icon { color: white; }

        h1 { font-size: 1.35rem; }

        .badge {
          background: rgba(139,92,246,0.15);
          border: 1px solid rgba(139,92,246,0.3);
          color: var(--accent-primary);
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .btn-icon { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; transition: color 0.2s, transform 0.3s; display: flex; }
        .btn-icon:hover { color: white; }
        .gear-btn:hover { transform: rotate(60deg); }
        .spinning { animation: spin-once 0.5s ease-out; }

        @keyframes spin-once { from { transform: rotate(0); } to { transform: rotate(180deg); } }

        /* ── Settings Drawer ─────────────────────────────────────── */
        .settings-drawer {
          padding: 1.25rem 1.5rem;
          border-radius: 12px;
          flex-shrink: 0;
          background: rgba(8, 8, 15, 0.92);
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .settings-header h3 { font-size: 1rem; }

        .settings-columns {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 2rem;
        }

        .settings-subtitle {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent-primary);
          margin-bottom: 0.75rem;
        }

        .settings-section { display: flex; flex-direction: column; gap: 0.6rem; }

        .input-group label {
          display: flex;
          gap: 0.4rem;
          align-items: baseline;
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .label-desc { font-size: 0.7rem; opacity: 0.6; }

        .settings-input, .settings-select {
          background: rgba(0,0,0,0.35);
          border: 1px solid var(--glass-border);
          border-radius: 7px;
          padding: 0.4rem 0.75rem;
          color: white;
          font-family: var(--font-body);
          font-size: 0.85rem;
          width: 100%;
          transition: border-color 0.15s;
          -webkit-appearance: none;
          appearance: none;
        }

        .settings-input:focus, .settings-select:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .select-row { display: flex; gap: 0.5rem; }

        .select-wrapper {
          position: relative;
          flex: 1;
        }

        .settings-select { padding-right: 2rem; cursor: pointer; }

        .select-icon {
          position: absolute;
          right: 0.6rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--text-secondary);
        }

        /* ── Main Layout ─────────────────────────────────────────── */
        .main-layout {
          display: flex;
          gap: 0.85rem;
          flex: 1;
          min-height: 0;
        }

        .left-panel {
          width: 370px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          overflow: hidden;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        /* ── Pipeline ────────────────────────────────────────────── */
        .section-title { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); margin-bottom: 0.75rem; }

        .pipeline-status {
          background: rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1rem;
          flex-shrink: 0;
        }

        .pipeline-steps { display: flex; flex-direction: column; }

        .step {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          padding: 0.55rem 0.5rem;
          border-radius: 8px;
          font-size: 0.88rem;
          transition: all 0.25s;
          border: 1px solid transparent;
        }

        .step-pending { color: var(--text-secondary); opacity: 0.5; }
        .step-active {
          color: var(--accent-primary);
          background: rgba(139,92,246,0.08);
          border-color: rgba(139,92,246,0.25);
          opacity: 1;
        }
        .step-done { color: #34d399; opacity: 1; }

        .step-icon-done { color: #34d399; flex-shrink: 0; margin-top: 2px; }

        .step-text { display: flex; flex-direction: column; }
        .step-label { font-weight: 500; line-height: 1.2; }
        .step-meta { font-size: 0.72rem; color: var(--text-secondary); opacity: 0.7; margin-top: 1px; }

        .connector {
          width: 2px;
          height: 14px;
          background: rgba(255,255,255,0.08);
          margin: 2px 0 2px 1.1rem;
          border-radius: 2px;
          transition: background 0.4s;
        }
        .connector-lit { background: #34d399; }

        /* ── Chat ────────────────────────────────────────────────── */
        .chat-container { display: flex; flex-direction: column; flex: 1; gap: 0.65rem; min-height: 0; }

        .chat-history {
          flex: 1;
          overflow-y: auto;
          background: rgba(0,0,0,0.12);
          border-radius: 10px;
          padding: 0.75rem;
          border: 1px solid rgba(255,255,255,0.02);
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          min-height: 0;
        }

        .message {
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          font-size: 0.84rem;
          line-height: 1.4;
          word-break: break-word;
        }

        .msg-prefix {
          font-weight: 700;
          margin-right: 0.4rem;
          color: var(--accent-secondary);
        }

        .message-system {
          background: rgba(139,92,246,0.07);
          border-left: 2px solid rgba(139,92,246,0.4);
          color: #c4c4d4;
        }

        .message-user {
          background: rgba(255,255,255,0.04);
          border-right: 2px solid var(--accent-secondary);
          color: white;
        }

        .prompt-area { display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0; }

        .prompt-input {
          width: 100%;
          background: rgba(0,0,0,0.28);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          color: white;
          font-family: var(--font-body);
          font-size: 0.9rem;
          resize: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .prompt-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 2px rgba(139,92,246,0.18);
        }

        .prompt-input:disabled { opacity: 0.5; }

        .run-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.7rem;
          font-size: 0.95rem;
        }

        .run-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; }

        /* ── Editor Panel ────────────────────────────────────────── */
        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.4);
          border-bottom: 1px solid var(--glass-border);
          flex-shrink: 0;
        }

        .tabs { display: flex; }

        .tab {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.7rem 1.1rem;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s, background 0.15s;
          border-bottom: 2px solid transparent;
        }

        .tab-active {
          color: white;
          border-bottom-color: var(--accent-primary);
          background: rgba(255,255,255,0.02);
        }

        .tab:hover:not(.tab-active) { color: rgba(255,255,255,0.8); }

        .editor-actions { display: flex; gap: 0.4rem; padding: 0 0.75rem; }

        .btn-tool {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0.35rem 0.5rem;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }

        .btn-tool:hover { background: rgba(255,255,255,0.09); color: white; border-color: rgba(255,255,255,0.15); }

        .editor-area { flex: 1; background: #0d0d12; overflow: hidden; }

        /* ── Shared Utilities ────────────────────────────────────── */
        .spin { animation: spinner 1.5s linear infinite; }
        @keyframes spinner { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
