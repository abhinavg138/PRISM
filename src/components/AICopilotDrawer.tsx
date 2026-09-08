import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Sparkles, Bot, User, ArrowRight, ShieldAlert,
  Shield, Lock, Info, CheckCircle2, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, Layers, TrendingUp, HelpCircle
} from 'lucide-react';
import { AICopilotMessage, Project } from '../types/index';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ProjectRiskCard } from './ProjectRiskCard';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: Project | null;
  onSelectProject: (p: Project) => void;
  allProjects: Project[];
}

// Purposeful intelligence actions covering all primary decision workflows
const DEFAULT_INTELLIGENCE_ACTIONS = [
  'Which projects have the highest risk?',
  'Why is project 701396 high risk?',
  'Which sectors have the highest average risk?',
  'Which projects need intervention first?',
  'Which projects show stagnant progress?',
  'How has project 701396\'s progress changed since April?',
  'What are the main PRISM risk indicators?',
  'How is the PRISM Risk Index calculated?',
  'What happens if progress improves?',
  'Can you change the risk score?',
];

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  activeProject,
  onSelectProject,
  allProjects
}) => {
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `### 🏛️ PRISM Infrastructure Intelligence Copilot\n\nGrounded on verified **MoSPI PAIMANA** monthly observations across **${allProjects.length > 0 ? allProjects.length.toLocaleString() : '2,054'}** monitored infrastructure projects (Apr–Jul 2026).\n\n**Operational Intelligence Capabilities:**\n- **Root-Cause Diagnostics:** Deconstruct risk scores across the 6 empirical PRISM indicators.\n- **Intervention Prioritization:** Identify P1 immediate-urgency projects ranked by capital at risk.\n- **Longitudinal Trajectory:** Compare physical velocity versus cumulative capital drawdowns.\n- **Methodology Transparency:** Audit mathematical formulas and indicator weighting.\n\n> 🛡️ **Authority Rule:** Risk scores and priority tiers are computed deterministically by the **PRISM Risk Engine** — not Gemini. The Copilot explains and contextualizes verified facts without calculating or modifying scores.\n\nSelect a priority prompt below or type your inquiry:`,
      timestamp: 'Just now',
      suggestedQuestions: DEFAULT_INTELLIGENCE_ACTIONS.slice(0, 5)
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Auto focus textarea when opened
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading]);

  // Adjust textarea height dynamically
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  // Context notice when active project is focused
  useEffect(() => {
    if (activeProject && isOpen) {
      const isUnrated = activeProject.riskScore == null;
      const scoreText = !isUnrated
        ? `PRISM Risk Index: **${activeProject.riskScore}/100** (${activeProject.riskTier})`
        : `Risk Status: **UNRATED** (Insufficient observations)`;

      const projectPrompt = `Now focused on **${activeProject.name}** (\`PAIMANA-${activeProject.id}\`, ${activeProject.derivedSector || activeProject.sector || 'Infrastructure'}). ${scoreText}. Ask about its underlying risk drivers, monthly progress history, or intervention options.`;

      const suggestedQuestions = !isUnrated ? [
        `Why is project ${activeProject.id} ${activeProject.riskTier?.toLowerCase()} risk?`,
        `How has project ${activeProject.id}'s progress changed since April?`,
        `What is the recommended action for ${activeProject.id}?`,
        'Can you change the risk score?',
      ] : [
        `What is the recorded progress vs spend for project ${activeProject.id}?`,
        `What is the schedule slippage for project ${activeProject.id}?`,
        `Show monthly snapshots for project ${activeProject.id}.`,
      ];

      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.content.includes(activeProject.name)) {
        setMessages(prev => [
          ...prev,
          {
            id: `focus-${Date.now()}`,
            role: 'assistant',
            content: projectPrompt,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedQuestions,
            groundedProjects: [activeProject]
          }
        ]);
      }
    }
  }, [activeProject?.id, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: AICopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          activeProjectId: activeProject?.id
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let serverError = `Server responded with status ${response.status}`;
        try {
          const errData = await response.json();
          serverError = errData.error || errData.answer || serverError;
        } catch { /* ignore */ }
        throw new Error(serverError);
      }

      const data = await response.json();

      const assistantMessage: AICopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        groundedProjects: data.groundedProjects || [],
        suggestedQuestions: data.suggestedQuestions || [],
        totalMatching: data.totalMatching,
        displayedCount: data.displayedCount
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      const detail = isTimeout ? 'Request timed out after 60s' : (err?.message || 'Network communication error');

      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **PRISM Copilot Advisory:** Unable to complete live query processing (${detail}). Please retry your inquiry or select a suggested intelligence prompt.`,
          timestamp: 'Just now',
          suggestedQuestions: DEFAULT_INTELLIGENCE_ACTIONS.slice(0, 3)
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] md:w-[540px] bg-slate-50/70 border-l border-slate-200 shadow-2xl flex flex-col backdrop-blur-xs font-sans"
      role="dialog"
      aria-labelledby="copilot-drawer-title"
    >
      {/* 1. Header: Enterprise Intelligence Branding */}
      <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md ring-1 ring-white/15">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="copilot-drawer-title" className="text-sm font-bold text-white tracking-tight">
                PRISM AI Copilot
              </h2>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center gap-1 font-semibold">
                <Shield className="w-2.5 h-2.5 text-emerald-400" />
                GROUNDED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              MoSPI PAIMANA · {allProjects.length > 0 ? allProjects.length.toLocaleString() : '2,054'} projects · Apr–Jul 2026
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close AI Copilot drawer"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* 2. Persistent Trust Boundary Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2 shrink-0">
        <Lock className="w-3 h-3 text-blue-400 shrink-0" />
        <span className="text-[10.5px] text-slate-400 leading-tight">
          Authoritative intelligence:
          <span className="text-slate-200 font-semibold"> Risk scores are determined by the PRISM Risk Engine, not Gemini.</span>
        </span>
      </div>

      {/* 3. Active Project Focus Banner */}
      {activeProject && (
        <div className="px-4 py-2.5 bg-blue-50/90 border-b border-blue-200/80 flex items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider bg-blue-100/80 px-1.5 py-0.5 rounded shrink-0">
              Current Project
            </span>
            <span className="text-xs font-bold text-slate-900 truncate" title={activeProject.name}>
              {activeProject.name.split('(')[0].trim()}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shrink-0">
              PAIMANA-{activeProject.id}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeProject.riskScore != null && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                activeProject.riskTier === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                activeProject.riskTier === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                activeProject.riskTier === 'MODERATE' ? 'bg-yellow-100 text-yellow-800' :
                'bg-emerald-100 text-emerald-800'
              }`}>
                {activeProject.riskScore}/100
              </span>
            )}
            <button
              onClick={() => onSelectProject(activeProject)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 px-2 py-0.5 rounded hover:bg-blue-100/50 transition-colors"
              title="Open Project Deep-Dive Modal"
            >
              <span>Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Quick Suggested Questions Banner (Initial state or collapsed) */}
      {messages.length <= 2 && (
        <div className="p-3 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-blue-600" />
              Suggested Intelligence Inquiries
            </span>
            <button
              onClick={() => setShowAllQuestions(!showAllQuestions)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>{showAllQuestions ? 'Show fewer' : `Show all (${DEFAULT_INTELLIGENCE_ACTIONS.length})`}</span>
              {showAllQuestions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(showAllQuestions ? DEFAULT_INTELLIGENCE_ACTIONS : DEFAULT_INTELLIGENCE_ACTIONS.slice(0, 5)).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="text-[11px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-2.5 py-1 rounded-full text-left transition-all font-medium cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Messages Canvas */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Metadata / Author Header */}
            <div className="flex items-center gap-1.5 mb-1 text-[10.5px] text-slate-400">
              {msg.role === 'assistant' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-700">PRISM Intelligence</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold inline-flex items-center gap-0.5">
                    <Shield className="w-2 h-2" />
                    GROUNDED
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-700">Officer Query</span>
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Message Bubble Body */}
            {msg.role === 'user' ? (
              <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%] font-medium shadow-xs leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-4 shadow-xs text-slate-800 space-y-3.5 max-w-[98%] w-full">
                {/* Rendered Markdown Body */}
                <MarkdownRenderer
                  content={msg.content}
                  allProjects={allProjects}
                  onSelectProject={onSelectProject}
                />

                {/* Structured Project Result Cards */}
                {msg.groundedProjects && msg.groundedProjects.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                          Verified Project Entities ({msg.totalMatching && msg.totalMatching > msg.groundedProjects.length
                            ? `Showing ${msg.groundedProjects.length} of ${msg.totalMatching}`
                            : msg.groundedProjects.length})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        PRISM Risk Engine · PAIMANA Source
                      </span>
                    </div>

                    <div className="space-y-2">
                      {msg.groundedProjects.map((gp) => {
                        const fullProject = allProjects.find(p => p.id === gp.id) || (gp as Project);
                        return (
                          <ProjectRiskCard
                            key={gp.id}
                            project={fullProject}
                            onSelect={onSelectProject}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Follow-up Suggested Question Chips */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[96%]">
                {msg.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[11px] bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-3 py-1 rounded-full text-left transition-all shadow-2xs font-medium cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2.5 text-slate-700 p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs w-fit">
            <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-800 block">
                Synthesizing verified PAIMANA evidence...
              </span>
              <span className="text-[10.5px] text-slate-500 block">
                Evaluating empirical indicators & longitudinal snapshots
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 6. Modern Pinned Floating Composer */}
      <div className="p-3 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="bg-slate-50/90 border border-slate-200 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 rounded-xl p-1.5 transition-all shadow-2xs"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder="Ask about project risks, evidence, or intervention priorities..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Ask PRISM Copilot"
              className="flex-1 max-h-28 min-h-[36px] px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 bg-transparent resize-none focus:outline-none leading-relaxed font-sans"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-lg transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* 7. Grounded Trust Footer */}
        <div className="mt-2 text-[10.5px] text-slate-400 text-center flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>
            Grounded on verified MoSPI PAIMANA data · Gemini does not modify official risk scores.
          </span>
        </div>
      </div>
    </div>
  );
};
