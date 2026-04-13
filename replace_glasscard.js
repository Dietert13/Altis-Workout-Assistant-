const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/<GlassCard/g, '<div');
content = content.replace(/<\/GlassCard>/g, '</div>');
fs.writeFileSync('src/App.tsx', content);
