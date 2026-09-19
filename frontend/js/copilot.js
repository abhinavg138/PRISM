/**
 * ============================================================================
 * PRISM — AI Copilot Drawer Module
 * Grounded Assistant with active project context, canned query chips,
 * markdown response formatting, and deterministic backend attribution.
 * ============================================================================
 */

import { state } from './state.js';
import { api } from './api.js';
import { renderMarkdown, renderIcons, escapeHtml, getRiskBadgeHtml } from './utils.js';

const DEFAULT_SUGGESTIONS = [
  'Show high-risk projects in Delhi',
  'Which projects show stagnant progress?',
  'Why is project 701396 high risk?',
  'Which sectors have the highest average risk?',
  'Which projects are on good pace?',
  'What is the PRISM risk calculation methodology?'
];

export function initCopilot() {
  bindCopilotEvents();
}

export function openCopilot(project = null) {
  const drawer = document.getElementById('copilot-drawer-backdrop');
  if (!drawer) return;

  // Project context switching: detect switch to another project
  if (project) {
    const isNewProject = !state.copilotProject || (state.copilotProject.id !== project.id);
    if (isNewProject) {
      // Clear stale conversation history from prior project
      state.copilotMessages = [];
      const chatContainer = document.getElementById('copilot-chat-container');
      if (chatContainer) chatContainer.innerHTML = '';
    }
    state.copilotProject = project;
  }

  updateCopilotContextBanner();
  drawer.classList.add('active');

  if (state.copilotMessages.length === 0) {
    // Initial welcome message
    const p = state.copilotProject;
    addCopilotMessage({
      role: 'copilot',
      isWelcome: true,
      text: p 
        ? `Hello! I am PRISM Copilot. I have loaded active project context for **${p.name}** (\`${p.code || `PAIMANA-${p.id}`}\`).\n\nHow can I assist you with this project's risk profile, risk drivers, schedule slippage, sector peer comparison, or potential interventions?`
        : `Hello! I am PRISM Copilot, your national infrastructure risk intelligence assistant grounded in the MoSPI PAIMANA dataset (2,054 projects). Ask me about regional bottlenecks, high-risk sectors, stagnant milestones, or specific project IDs.`,
      sources: ['MoSPI PAIMANA April–July 2026 Authoritative Flash Reports']
    });
  }

  renderSuggestions();
  renderIcons();

  // Auto-focus input for quick follow-up
  setTimeout(() => {
    document.getElementById('copilot-input')?.focus();
  }, 200);
}

export function closeCopilot() {
  const drawer = document.getElementById('copilot-drawer-backdrop');
  if (drawer) drawer.classList.remove('active');
}

function updateCopilotContextBanner() {
  const banner = document.getElementById('copilot-context-banner');
  if (!banner) return;

  if (state.copilotProject) {
    const p = state.copilotProject;
    banner.innerHTML = `
      <div class="p-3 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-b border-blue-200 text-xs shadow-xs">
        <div class="flex items-start justify-between gap-2">
          <div class="space-y-1 min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                <i data-lucide="crosshair" class="w-3 h-3"></i> Project Context
              </span>
              <span class="font-mono text-[11px] font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                ${escapeHtml(p.code || `PAIMANA-${p.id}`)}
              </span>
              ${getRiskBadgeHtml(p.riskTier, p.riskScore)}
            </div>
            <div class="font-bold text-slate-900 text-xs truncate leading-snug" title="${escapeHtml(p.name)}">
              ${escapeHtml(p.name)}
            </div>
            <div class="text-[10.5px] text-slate-500 flex items-center gap-2">
              <span><strong class="text-slate-600">Sector:</strong> ${escapeHtml(p.sector)}</span>
              <span>&bull;</span>
              <span><strong class="text-slate-600">State:</strong> ${escapeHtml(p.state)}</span>
            </div>
          </div>
          <button id="btn-clear-project-context" class="text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1 rounded bg-white hover:bg-red-50 border border-slate-200 transition shrink-0 flex items-center gap-1 shadow-2xs" title="Clear project context and return to portfolio mode">
            <i data-lucide="x" class="w-3 h-3"></i> Clear
          </button>
        </div>
      </div>
    `;
    document.getElementById('btn-clear-project-context')?.addEventListener('click', () => {
      state.copilotProject = null;
      updateCopilotContextBanner();
      renderSuggestions();
      renderIcons();
    });
  } else {
    banner.innerHTML = '';
  }
}

function renderSuggestions() {
  const container = document.getElementById('copilot-suggestions');
  if (!container) return;

  let suggestions = DEFAULT_SUGGESTIONS;
  if (state.copilotProject) {
    const p = state.copilotProject;
    const isHighRisk = (p.riskScore || 0) >= 60 || p.riskTier === 'HIGH' || p.riskTier === 'CRITICAL';
    suggestions = [
      isHighRisk ? 'Why is this project currently high risk?' : 'What is this project\'s current risk level?',
      'What are the main risk drivers?',
      'How severe is the schedule risk?',
      'How does this project compare with its peers?',
      'What intervention should be prioritized?'
    ];
  }

  container.innerHTML = `
    <div class="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
      ${suggestions.map(s => `
        <button class="suggestion-chip px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-700 whitespace-nowrap transition-colors" data-prompt="${escapeHtml(s)}">
          ${escapeHtml(s)}
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.getAttribute('data-prompt');
      if (prompt) sendMessage(prompt);
    });
  });
}

function bindCopilotEvents() {
  const input = document.getElementById('copilot-input');
  const sendBtn = document.getElementById('btn-copilot-send');
  const closeBtn = document.getElementById('btn-copilot-close');
  const clearBtn = document.getElementById('btn-copilot-clear');

  closeBtn?.addEventListener('click', closeCopilot);

  clearBtn?.addEventListener('click', () => {
    state.copilotMessages = [];
    const chatContainer = document.getElementById('copilot-chat-container');
    if (chatContainer) chatContainer.innerHTML = '';
    openCopilot(state.copilotProject);
  });

  const handleSend = () => {
    const q = input?.value?.trim();
    if (!q) return;
    input.value = '';
    sendMessage(q);
  };

  sendBtn?.addEventListener('click', handleSend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

async function sendMessage(question) {
  addCopilotMessage({ role: 'user', text: question });

  const typingId = showTypingIndicator();

  try {
    const history = state.copilotMessages.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    const pid = state.copilotProject ? state.copilotProject.id : null;
    const res = await api.askCopilot(question, pid, history);

    removeTypingIndicator(typingId);

    addCopilotMessage({
      role: 'copilot',
      text: res.answer || res.text || 'No response received.',
      sources: res.sources || ['PRISM Evidence & Canonical MoSPI PAIMANA Registry'],
      groundedProjects: res.groundedProjects || []
    });
  } catch (err) {
    removeTypingIndicator(typingId);
    addCopilotMessage({
      role: 'copilot',
      text: `**Unable to complete request**: ${err.message || 'Connection to intelligence service failed.'}\n\nPlease try again or select one of the suggested queries.`,
      isError: true
    });
  }
}

function addCopilotMessage(msg) {
  state.copilotMessages.push(msg);
  const container = document.getElementById('copilot-chat-container');
  if (!container) return;

  const isUser = msg.role === 'user';
  const msgEl = document.createElement('div');
  msgEl.className = isUser ? 'chat-bubble-user' : 'chat-bubble-copilot';

  let groundedHtml = '';
  if (msg.groundedProjects && msg.groundedProjects.length > 0) {
    groundedHtml = `
      <div class="mt-3 pt-2 border-t border-slate-200">
        <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Grounded Projects (${msg.groundedProjects.length})</div>
        <div class="space-y-1">
          ${msg.groundedProjects.slice(0, 5).map(p => `
            <div class="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200 text-xs cursor-pointer hover:border-blue-400" onclick="window.prismApp.openProjectDetail('${escapeHtml(p.id)}')">
              <span class="font-semibold text-slate-800 truncate mr-2">${escapeHtml(p.name || p.id)}</span>
              <span class="badge ${p.riskTier === 'CRITICAL' ? 'badge-critical' : p.riskTier === 'HIGH' ? 'badge-high' : 'badge-low'} text-[10px] shrink-0 font-mono">${Math.round(p.riskScore || 0)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  let sourcesHtml = '';
  if (msg.sources && msg.sources.length > 0) {
    sourcesHtml = `
      <div class="mt-2 text-[10.5px] text-slate-400 flex items-center gap-1">
        <i data-lucide="shield-check" class="w-3 h-3 text-emerald-600 shrink-0"></i>
        <span>${escapeHtml(msg.sources.join(', '))}</span>
      </div>
    `;
  }

  const orbHtml = msg.isWelcome ? `
    <div class="mobile-ai-orb mb-3 md:hidden">
      <div class="copilot-orb-glow"></div>
    </div>
  ` : '';

  msgEl.innerHTML = `
    ${orbHtml}
    <div class="copilot-content">${renderMarkdown(msg.text)}</div>
    ${groundedHtml}
    ${sourcesHtml}
  `;

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
  renderIcons();
}

function showTypingIndicator() {
  const container = document.getElementById('copilot-chat-container');
  if (!container) return null;

  const typingEl = document.createElement('div');
  const id = `typing-${Date.now()}`;
  typingEl.id = id;
  typingEl.className = 'chat-bubble-copilot flex items-center gap-1.5 py-2 px-3 text-xs text-slate-500';
  typingEl.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
    <span>Consulting PRISM engines and grounding PAIMANA records...</span>
  `;
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}
