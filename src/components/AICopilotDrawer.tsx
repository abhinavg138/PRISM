import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Sparkles, Bot, User, ArrowRight, ShieldAlert,
  ExternalLink, RefreshCw, Shield, Lock, Info, CheckCircle2
} from 'lucide-react';
import { AICopilotMessage, Project } from '../types/index';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: Project | null;
  onSelectProject: (p: Project) => void;
  allProjects: Project[];
}

// High-value demo questions covering all 10 SIH judge scenarios
const DEMO_QUESTIONS = [
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
      content: `### 🏛️ PRISM Infrastructure Intelligence Copilot\n\nGrounded on verified **MoSPI PAIMANA** monthly observations across **${allProjects.length.toLocaleString()}** monitored infrastructure projects (Apr–Jul 2026).\n\n**What I can help with:**\n- Project risk explanation & evidence review\n- Sector and state-level risk intelligence\n- Intervention priority reasoning\n- Longitudinal progress analysis\n- PRISM Risk Engine methodology\n\n⚠️ **Note:** Risk scores are computed exclusively by the **PRISM Deterministic Risk Engine** — not by me. I explain and contextualize; I do not calculate or modify official scores.\n\nSelect a question below or type your own:`,
      timestamp: 'Just now',
      suggestedQuestions: DEMO_QUESTIONS.slice(0, 5)
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMoreQuestions, setShowMoreQuestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  // Context notice when active project is opened
  useEffect(() => {
    if (activeProject && isOpen) {
      const isUnrated = activeProject.riskScore == null;
      const scoreText = !isUnrated
        ? `PRISM Risk Index: **${activeProject.riskScore}/100** (${activeProject.riskTier})`
        : `Risk Status: **UNRATED** (Insufficient longitudinal observations)`;

      const projectPrompt = `Now focused on **${activeProject.name}** (\`${activeProject.code || activeProject.id}\`, ${activeProject.derivedSector || activeProject.sector}). ${scoreText}. Ask me about its risk indicators, monthly progress history, or evidence provenance.`;

      const suggestedQuestions = !isUnrated ? [
        `Why is project ${activeProject.id} ${activeProject.riskTier?.toLowerCase()} risk?`,
        `How has project ${activeProject.id}'s progress changed since April?`,
        `What is the recommended action for ${activeProject.id}?`,
        'Can you change the risk score?',
      ] : [
        `What is the physical progress vs spend for ${activeProject.name.split('(')[0].trim()}?`,
        `What is the recorded schedule slippage for ${activeProject.id}?`,
        `Show monthly snapshot history for project ${activeProject.id}.`,
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
            suggestedQuestions
          }
        ]);
      }
    }
  }, [activeProject?.id, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input.trim();
    if (!query || isLoading) return;

    const userMessage: AICopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
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
        suggestedQuestions: data.suggestedQuestions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      const detail = isTimeout ? 'Request timed out after 60s' : (err?.message || 'Network error');

      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `PRISM Copilot encountered an issue (${detail}). Please re-try.`,
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white border-l border-slate-200 shadow-2xl flex flex-col">

      {/* Drawer Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              PRISM AI Copilot
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />
                GROUNDED
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">MoSPI PAIMANA · {allProjects.length.toLocaleString()} projects · Apr–Jul 2026</p>
          </div>
        </div>

        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Trust indicator bar */}
      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
        <Lock className="w-3 h-3 text-blue-400 shrink-0" />
        <span className="text-[10px] text-slate-400 leading-tight">
          Answers generated from verified PRISM/PAIMANA project context.
          <span className="text-slate-300 font-semibold"> Risk scores are determined by the PRISM Risk Engine, not Gemini.</span>
        </span>
      </div>

      {/* Quick Questions Panel (collapsed by default after first load) */}
      {messages.length <= 1 && (
        <div className="p-3 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Quick Demo Questions</span>
            <button
              onClick={() => setShowMoreQuestions(!showMoreQuestions)}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold"
            >
              {showMoreQuestions ? 'Show fewer' : `Show all ${DEMO_QUESTIONS.length}`}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(showMoreQuestions ? DEMO_QUESTIONS : DEMO_QUESTIONS.slice(0, 5)).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="text-[11px] bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 px-2.5 py-1 rounded-full text-left transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {/* Avatar Row */}
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
              {msg.role === 'assistant' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-600">PRISM Intelligence</span>
                  <span className="px-1 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold inline-flex items-center gap-0.5">
                    <Shield className="w-2 h-2" />
                    GROUNDED
                  </span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-600">Officer Query</span>
                  <User className="w-3.5 h-3.5 text-blue-600" />
                </>
              )}
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Message Bubble */}
            <div className={`p-3.5 rounded-xl max-w-[94%] leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
            }`}>
              <div className="whitespace-pre-wrap font-sans text-xs space-y-1.5">
                {msg.content}
              </div>

              {/* Grounded Project References */}
              {msg.groundedProjects && msg.groundedProjects.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      Grounded References ({msg.groundedProjects.length} project{msg.groundedProjects.length > 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.groundedProjects.map((gp) => {
                      const fullProject = allProjects.find(p => p.id === gp.id);
                      return (
                        <button
                          key={gp.id}
                          onClick={() => fullProject && onSelectProject(fullProject)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-800 text-[11px] font-medium transition-colors"
                        >
                          <span className="font-mono font-bold text-blue-600">{gp.id}</span>
                          <span className="truncate max-w-[130px]">{gp.name?.split('(')[0]}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Follow-up Questions */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 max-w-[94%]">
                {msg.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[11px] bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 px-2.5 py-1 rounded-full text-left transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-600 p-3 bg-slate-50 rounded-xl border border-slate-200 w-fit">
            <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-xs">Reasoning with PAIMANA data & PRISM risk evidence...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about project risks, evidence, or intervention priorities..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Shield className="w-3 h-3 text-emerald-600" />
          <span className="text-[10px] text-slate-500">
            Grounded strictly on verified MoSPI PAIMANA data. Gemini does not modify official risk scores.
          </span>
        </div>
      </div>

    </div>
  );
};

// Local import for Database icon — needed in grounded references section
function Database(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
    </svg>
  );
}
