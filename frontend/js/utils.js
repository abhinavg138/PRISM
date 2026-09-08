/**
 * ============================================================================
 * PRISM — Utilities & Formatters
 * Safe DOM rendering helpers, currency formatters, and badge generators.
 * ============================================================================
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrencyCr(val) {
  if (val == null || isNaN(val)) return '₹0 Cr';
  return `₹${Math.round(val).toLocaleString('en-IN')} Cr`;
}

export function formatPercent(val, decimals = 1) {
  if (val == null || isNaN(val)) return '0%';
  return `${Number(val).toFixed(decimals)}%`;
}

export function formatMonths(val) {
  if (val == null || isNaN(val)) return '0 mos';
  return `${Math.round(val)} mos`;
}

export function formatDate(val) {
  if (!val) return 'N/A';
  return String(val);
}

export function getRiskBadgeHtml(tier, score) {
  const t = (tier || 'UNRATED').toUpperCase();
  let cls = 'badge-moderate';
  if (t === 'CRITICAL') cls = 'badge-critical';
  else if (t === 'HIGH') cls = 'badge-high';
  else if (t === 'LOW') cls = 'badge-low';

  const scoreText = score != null ? ` (${Math.round(score)})` : '';
  return `<span class="badge ${cls}"><span class="w-1.5 h-1.5 rounded-full bg-current"></span>${t}${scoreText}</span>`;
}

export function getPriorityBadgeHtml(tier, score) {
  const t = (tier || 'UNASSIGNED').toUpperCase();
  let cls = 'badge-p3';
  if (t === 'P1') cls = 'badge-p1';
  else if (t === 'P2') cls = 'badge-p2';

  const scoreText = score != null ? ` (${Math.round(score)})` : '';
  return `<span class="badge ${cls}"><i data-lucide="zap" class="w-3 h-3"></i>${t}${scoreText}</span>`;
}

export function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Safe markdown parser for Copilot responses (supports bold, lists, headers, code, tables).
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';
  
  let html = escapeHtml(markdownText);
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  
  // Inline code
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
  
  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/gim, '');
  
  // Line breaks to paragraphs
  const lines = html.split('\n');
  const result = [];
  let inList = false;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('<ul>') || line.startsWith('<li>') || line.endsWith('</ul>')) {
      result.push(line);
    } else if (line.startsWith('<h1') || line.startsWith('<h2') || line.startsWith('<h3')) {
      result.push(line);
    } else {
      result.push(`<p>${line}</p>`);
    }
  }
  
  return result.join('');
}
