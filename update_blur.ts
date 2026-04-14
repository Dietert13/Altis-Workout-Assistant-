import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace no-blur with backdrop-blur-[1px] for Exit buttons
content = content.replace(
  /className="px-4 py-1\.5 flex items-center gap-2 group border border-(aquamarine|transparent) bg-transparent rounded-full no-blur hover:bg-transparent transition-all duration-300 shadow-\[0_0_10px_rgba\(127,255,212,0\.2\)\] hover:shadow-\[0_0_20px_rgba\(127,255,212,0\.4\)\] drop-shadow-\[0_0_8px_rgba\(127,255,212,0\.4\)\]"/g,
  'className="px-4 py-1.5 flex items-center gap-2 group border border-$1 bg-transparent rounded-full backdrop-blur-[1px] hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)] drop-shadow-[0_0_8px_rgba(127,255,212,0.4)]"'
);

// Replace no-blur with backdrop-blur-[1px] for + buttons
content = content.replace(
  /className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-transparent bg-transparent no-blur hover:bg-transparent transition-all duration-300 shadow-\[0_0_10px_rgba\(127,255,212,0\.2\)\] hover:shadow-\[0_0_20px_rgba\(127,255,212,0\.4\)\] drop-shadow-\[0_0_8px_rgba\(127,255,212,0\.4\)\]"/g,
  'className="relative z-40 w-12 h-12 rounded-full flex items-center justify-center p-0 group border border-transparent bg-transparent backdrop-blur-[1px] hover:bg-transparent transition-all duration-300 shadow-[0_0_10px_rgba(127,255,212,0.2)] hover:shadow-[0_0_20px_rgba(127,255,212,0.4)] drop-shadow-[0_0_8px_rgba(127,255,212,0.4)]"'
);

fs.writeFileSync('src/App.tsx', content);
