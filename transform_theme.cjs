const fs = require('fs');
const path = require('path');

function replaceColors(content) {
  // Backgrounds
  content = content.replace(/bg-slate-950(\/[0-9]+)?/g, 'bg-slate-50');
  content = content.replace(/bg-slate-900(\/[0-9]+)?/g, 'bg-white');
  content = content.replace(/bg-slate-800(\/[0-9]+)?/g, 'bg-slate-100');
  content = content.replace(/bg-slate-700(\/[0-9]+)?/g, 'bg-slate-200');
  
  // Borders
  content = content.replace(/border-slate-800(\/[0-9]+)?/g, 'border-slate-200');
  content = content.replace(/border-slate-700(\/[0-9]+)?/g, 'border-slate-300');
  content = content.replace(/border-slate-900(\/[0-9]+)?/g, 'border-slate-200');
  
  // Dividers
  content = content.replace(/divide-slate-800(\/[0-9]+)?/g, 'divide-slate-200');
  
  // Text
  content = content.replace(/text-slate-100/g, 'text-slate-900');
  content = content.replace(/text-slate-200/g, 'text-slate-800');
  content = content.replace(/text-slate-300/g, 'text-slate-700');
  content = content.replace(/text-slate-400/g, 'text-slate-600');
  content = content.replace(/text-slate-500/g, 'text-slate-500');
  content = content.replace(/text-white/g, 'text-slate-900');

  // Change generic Amber highlights to Blue (Primary)
  // Be careful with risk colors. We'll manually replace specific UI elements if needed, 
  // but most 'amber' used for generic highlights can become 'blue'
  content = content.replace(/text-amber-400/g, 'text-blue-600');
  content = content.replace(/text-amber-500/g, 'text-blue-700');
  content = content.replace(/text-amber-300/g, 'text-blue-600');
  
  content = content.replace(/bg-amber-500(\/[0-9]+)?/g, 'bg-blue-600');
  content = content.replace(/bg-amber-400/g, 'bg-blue-500');
  
  content = content.replace(/border-amber-500(\/[0-9]+)?/g, 'border-blue-600');
  content = content.replace(/border-amber-400/g, 'border-blue-500');
  
  content = content.replace(/from-amber-500/g, 'from-blue-600');
  content = content.replace(/to-orange-500/g, 'to-blue-700');
  content = content.replace(/hover:from-amber-400/g, 'hover:from-blue-500');
  content = content.replace(/hover:to-orange-400/g, 'hover:to-blue-600');
  
  content = content.replace(/ring-amber-500/g, 'ring-blue-600');

  return content;
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = replaceColors(content);
      if (original !== content) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('./src');
