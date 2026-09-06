import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Send, Sparkles, Bot, User, ArrowRight, ShieldAlert, 
  ExternalLink, CornerDownLeft, RefreshCw 
} from 'lucide-react';
import { AICopilotMessage, Project } from '../types/index';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject?: Project | null;
  onSelectProject: (p: Project) => void;
  allProjects: Project[];
}

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
      content: `### 🏛️ PRISM Risk Intelligence Copilot Active\n\nWelcome to the AI-grounded infrastructure monitoring assistant for the **Ministry of Statistics & Programme Implementation (MoSPI)** and **Cabinet PMG**.\n\nI analyze live PAIMANA features, TreeSHAP attributions, delay regressions, and policy simulations across **${allProjects.length} mega-infrastructure projects**.\n\nClick any quick prompt below or ask any specific inquiry!`,
      timestamp: 'Just now',
      suggestedQuestions: [
        '🚨 Identify Top 3 Critical Projects for Cabinet escalation',
        '🌲 Why is the USBRL Rail Link in Kashmir marked Critical?',
        '⚡ How much budget is at risk across all transport corridors?',
        '📄 Generate MoSPI Flash Report executive summary'
      ]
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // When an active project is opened in the app, add a context notice
  useEffect(() => {
    if (activeProject && isOpen) {
      // Check if already focused
      const projectPrompt = `Focused on **${activeProject.name}** (\`${activeProject.code}\`, ${activeProject.sector}). Current Risk Score: **${activeProject.riskScore}/100** (${activeProject.riskTier}). Ask me about its TreeSHAP drivers, contractor stress, or What-If mitigations.`;
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.content.includes(activeProject.name)) {
        setMessages(prev => [
          ...prev,
          {
            id: `focus-${Date.now()}`,
            role: 'assistant',
            content: projectPrompt,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestedQuestions: [
              `What are the top SHAP drivers for ${activeProject.name.split('(')[0]}?`,
              `How can we simulate 12-week clearance speedup on ${activeProject.id}?`,
              `What is the primary delay cause for this project?`
            ]
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

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          activeProjectId: activeProject?.id
        })
      });

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
    } catch (err) {
      console.error('Copilot API call failed:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'PRISM Copilot encountered a network processing event. Please re-try.',
          timestamp: 'Just now'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white border-l border-slate-300 shadow-2xl flex flex-col">
      
      {/* Drawer Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              PRISM AI Copilot
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Grounded
              </span>
            </h3>
            <p className="text-[11px] text-slate-600">
              MoSPI / PMG Risk Intelligence Assistant
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {/* Header / Avatar */}
            <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500">
              {msg.role === 'assistant' ? (
                <>
                  <Bot className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-semibold text-slate-600">PRISM Intelligence</span>
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

            {/* Content Bubble */}
            <div
              className={`p-3.5 rounded-xl max-w-[92%] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans text-xs space-y-2">
                {msg.content}
              </div>

              {/* Grounded Project Reference Cards */}
              {msg.groundedProjects && msg.groundedProjects.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Grounded Project References:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.groundedProjects.map((gp) => {
                      const fullProject = allProjects.find(p => p.id === gp.id);
                      return (
                        <button
                          key={gp.id}
                          onClick={() => fullProject && onSelectProject(fullProject)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-medium transition-colors"
                        >
                          <span className="font-bold text-blue-600">{gp.id}</span>
                          <span className="truncate max-w-[140px]">{gp.name.split('(')[0]}</span>
                          <ExternalLink className="w-3 h-3 text-slate-600" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Follow-up Prompts */}
            {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[92%]">
                {msg.suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[11px] bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 px-2.5 py-1 rounded-full text-left transition-all hover:text-blue-600"
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
            <span className="text-xs">Reasoning with PAIMANA indicators & TreeSHAP attributions...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-slate-50 border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about project risks, delay root causes, or What-If..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl font-bold transition-all shadow-sm"
            title="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <span className="text-[10px] text-slate-500 mt-1.5 block text-center">
          PRISM Copilot is grounded strictly on verified MoSPI & executing agency project data.
        </span>
      </div>

    </div>
  );
};
