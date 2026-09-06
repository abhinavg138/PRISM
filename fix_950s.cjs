const fs = require('fs');
const path = require('path');

function replace950(content) {
  content = content.replace(/text-slate-950/g, 'text-white');
  content = content.replace(/bg-red-950(\/[0-9]+)?/g, 'bg-red-50');
  content = content.replace(/bg-orange-950(\/[0-9]+)?/g, 'bg-orange-50');
  content = content.replace(/bg-yellow-950(\/[0-9]+)?/g, 'bg-amber-50');
  content = content.replace(/bg-emerald-950(\/[0-9]+)?/g, 'bg-emerald-50');
  content = content.replace(/bg-amber-950(\/[0-9]+)?/g, 'bg-amber-50');
  content = content.replace(/bg-blue-950(\/[0-9]+)?/g, 'bg-blue-50');
  content = content.replace(/bg-indigo-950(\/[0-9]+)?/g, 'bg-indigo-50');
  content = content.replace(/from-slate-950/g, 'from-gray-50');
  content = content.replace(/to-slate-950/g, 'to-gray-50');
  content = content.replace(/via-slate-900/g, 'via-gray-100');
  content = content.replace(/via-indigo-950\/40/g, 'via-indigo-50');
  
  // borders
  content = content.replace(/border-red-700(\/[0-9]+)?/g, 'border-red-200');
  content = content.replace(/border-red-800(\/[0-9]+)?/g, 'border-red-200');
  content = content.replace(/border-orange-700(\/[0-9]+)?/g, 'border-orange-200');
  content = content.replace(/border-orange-800(\/[0-9]+)?/g, 'border-orange-200');
  content = content.replace(/border-yellow-700(\/[0-9]+)?/g, 'border-amber-200');
  content = content.replace(/border-yellow-800(\/[0-9]+)?/g, 'border-amber-200');
  content = content.replace(/border-amber-700(\/[0-9]+)?/g, 'border-amber-200');
  content = content.replace(/border-amber-800(\/[0-9]+)?/g, 'border-amber-200');
  content = content.replace(/border-emerald-700(\/[0-9]+)?/g, 'border-emerald-200');
  content = content.replace(/border-emerald-800(\/[0-9]+)?/g, 'border-emerald-200');
  content = content.replace(/border-emerald-500\/30/g, 'border-emerald-200');
  content = content.replace(/border-blue-500\/30/g, 'border-blue-200');
  content = content.replace(/border-blue-800(\/[0-9]+)?/g, 'border-blue-200');
  
  // texts
  content = content.replace(/text-red-400/g, 'text-red-600');
  content = content.replace(/text-red-300/g, 'text-red-700');
  content = content.replace(/text-orange-400/g, 'text-orange-600');
  content = content.replace(/text-orange-300/g, 'text-orange-700');
  content = content.replace(/text-yellow-400/g, 'text-amber-600');
  content = content.replace(/text-yellow-300/g, 'text-amber-700');
  content = content.replace(/text-emerald-400/g, 'text-emerald-600');
  content = content.replace(/text-emerald-300/g, 'text-emerald-700');
  content = content.replace(/text-blue-400/g, 'text-blue-600');
  
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
      content = replace950(content);
      if (original !== content) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir('./src');
