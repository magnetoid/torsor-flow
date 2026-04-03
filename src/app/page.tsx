"use client";

import React, { useState } from 'react';
import { Sparkles, Code2, Play, Settings, Box, Monitor, CircleDashed, CheckCircle2, AlertCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); 
  const [codeContent, setCodeContent] = useState(`// Your AI generated code will appear here\n// Array status: Initializing...\n\nfunction App() {\n  return (\n    <div className="app">\n      <h1>Hello Vibe Coder</h1>\n    </div>\n  );\n}`);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'system', content: 'System initialized. Ready for vibe coding. What would you like to build today?' }
  ]);
  const [showSettings, setShowSettings] = useState(false);

  const handleVibe = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentStep(1);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setCodeContent('// Generator agent is thinking...\\n// Asking for initial architecture based on prompt.');

    try {
      // In a more complex app, this would use Server-Sent Events (SSE) to update step by step.
      // Here we will mock the multi-step updates using a mock if no key, or fetch all at once and simulate steps.
      
      const payload = {
        prompt,
        apiKeys: { openai: apiKey }
      };

      // To make the UI feel alive during the fetch
      const simulateSteps = setInterval(() => {
        setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
      }, 3000);

      const res = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(simulateSteps);

      const data = await res.json();

      if (data.success) {
        setCurrentStep(4); // Done
        setCodeContent(data.finalCode);
        setMessages(prev => [...prev, { role: 'system', content: 'Agent array finished! Code has been generated, reviewed, and optimized.' }]);
      } else {
        setCurrentStep(0);
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${data.error}` }]);
      }
      
    } catch (error: any) {
      setCurrentStep(0);
      setMessages(prev => [...prev, { role: 'system', content: `Failed to execute: ${error.message}` }]);
    } finally {
      setIsGenerating(false);
      setPrompt("");
    }
  };

  const getStepClass = (stepNum: number) => {
    if (currentStep > stepNum) return 'step active completed';
    if (currentStep === stepNum && isGenerating) return 'step active thinking';
    return 'step pending';
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <header className="glass-panel header animate-fade-in">
        <div className="logo-section">
          <div className="logo-icon-wrapper">
            <Sparkles className="logo-icon" size={24} />
          </div>
          <h1 className="text-gradient">Vibe Coder</h1>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={20} />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-panel glass-panel animate-fade-in">
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Settings</h3>
          <div className="input-group">
            <label>OpenAI API Key (optional - uses mock data if empty)</label>
            <input 
              type="password" 
              className="prompt-input" 
              style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="sk-..." 
            />
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="main-layout">
        
        {/* Left Panel: Chat & Pipeline */}
        <section className="left-panel glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
          
          <div className="pipeline-status">
            <h2 className="section-title">Agent Array</h2>
            <div className="pipeline-steps">
              <div className={getStepClass(1)}>
                {currentStep > 1 ? <CheckCircle2 size={18} /> : <CircleDashed size={18} className={currentStep === 1 ? 'animate-spin' : ''} />}
                <span>1. Generator {currentStep === 1 && isGenerating ? '(Thinking...)' : ''}</span>
              </div>
              <div className="step-connector"></div>
              <div className={getStepClass(2)}>
                {currentStep > 2 ? <CheckCircle2 size={18} /> : <Box size={18} className={currentStep === 2 ? 'animate-spin' : ''} />}
                <span>2. Fixer {currentStep === 2 && isGenerating ? '(Reviewing...)' : ''}</span>
              </div>
              <div className="step-connector"></div>
              <div className={getStepClass(3)}>
                 {currentStep > 3 && currentStep !== 4 ? <CheckCircle2 size={18} /> : <Sparkles size={18} className={currentStep === 3 ? 'animate-spin' : ''} />}
                <span>3. Optimizer {currentStep === 3 && isGenerating ? '(Polishing...)' : ''}</span>
              </div>
            </div>
          </div>

          <div className="chat-container">
            <div className="chat-history">
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  {msg.role === 'user' ? 'You: ' : ''}{msg.content}
                </div>
              ))}
            </div>
            
            <div className="prompt-area">
              <textarea 
                className="prompt-input" 
                placeholder="Type your feature request..." 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleVibe();
                  }
                }}
                disabled={isGenerating}
              />
              <button 
                className="btn-primary run-vibe-btn" 
                onClick={handleVibe}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? <CircleDashed className="animate-spin" size={18} /> : <Play size={18} />} 
                {isGenerating ? 'Vibing...' : 'Vibe It'}
              </button>
            </div>
          </div>

        </section>

        {/* Right Panel: Code & Preview */}
        <section className="right-panel glass-panel animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="tabs">
            <button className="tab active">
              <Code2 size={16} /> Code Result
            </button>
          </div>
          <div className="editor-area">
            {/* Monaco Editor */}
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={codeContent}
              onChange={(value) => setCodeContent(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                padding: { top: 16 }
              }}
            />
          </div>
        </section>

      </main>

      <style jsx>{`
        .workspace-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 1rem;
          gap: 1rem;
          background-image: radial-gradient(circle at top right, rgba(139, 92, 246, 0.1), transparent 40%),
                            radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.05), transparent 40%);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          border-radius: 12px;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .logo-icon-wrapper {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          padding: 0.5rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }

        .logo-icon {
          color: white;
        }

        .btn-icon {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          transition: color 0.2s, transform 0.2s;
        }

        .btn-icon:hover {
          color: white;
          transform: rotate(45deg);
        }

        .settings-panel {
          position: absolute;
          top: 80px;
          right: 20px;
          width: 350px;
          padding: 1.5rem;
          z-index: 100;
          background: rgba(10,10,15,0.9);
        }

        .input-group label {
          display: block;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .main-layout {
          display: flex;
          gap: 1rem;
          flex: 1;
          height: calc(100vh - 100px);
        }

        .left-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          min-width: 350px;
          max-width: 450px;
        }

        .right-panel {
          flex: 2;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .section-title {
          font-size: 1.1rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .pipeline-status {
          margin-bottom: 2rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .pipeline-steps {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .step {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
          padding: 0.5rem;
          border-radius: 6px;
          transition: all 0.3s;
        }

        .step.active {
          color: var(--accent-primary);
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }

        .step.completed {
          color: var(--text-primary);
          background: rgba(255,255,255,0.05);
        }

        .step.pending {
          color: var(--text-secondary);
          opacity: 0.6;
        }

        .animate-spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          margin-top: auto;
          gap: 1rem;
          overflow: hidden;
        }

        .chat-history {
          flex: 1;
          overflow-y: auto;
          background: rgba(0,0,0,0.15);
          border-radius: 12px;
          padding: 1rem;
          border: 1px solid rgba(255,255,255,0.02);
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .message {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.9rem;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .message.system {
          background: rgba(139, 92, 246, 0.1);
          border-left: 3px solid var(--accent-primary);
          color: #d1d5db;
        }

        .message.user {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border-right: 3px solid var(--accent-secondary);
          align-self: flex-end;
          max-width: 90%;
        }

        .prompt-area {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .prompt-input {
          width: 100%;
          min-height: 80px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1rem;
          color: white;
          font-family: var(--font-body);
          resize: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .prompt-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }

        .run-vibe-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.8rem;
          font-size: 1.05rem;
        }
        
        .run-vibe-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .tabs {
          display: flex;
          background: rgba(0,0,0,0.4);
          border-bottom: 1px solid var(--glass-border);
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-body);
          font-weight: 500;
          cursor: pointer;
          transition: color var(--transition-fast), background var(--transition-fast);
        }

        .tab.active {
          color: white;
          background: rgba(255,255,255,0.03);
          border-bottom: 2px solid var(--accent-primary);
        }

        .tab:hover:not(.active) {
          color: white;
          background: rgba(255,255,255,0.01);
        }

        .editor-area {
          flex: 1;
          padding: 0;
          background: #0d0d12;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
