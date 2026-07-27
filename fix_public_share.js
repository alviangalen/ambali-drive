const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/PublicShare.tsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /fetch\(\`\/api\/files\/\$\{file\.id\}\/download\`\)/g,
  "fetch(`/api/share/public/${hash}/download${password ? '?password='+encodeURIComponent(password) : ''}`)"
);

content = content.replace(
  /src=\{\`\/api\/files\/\$\{file\.id\}\/download\`\}/g,
  "src={`/api/share/public/${hash}/download${password ? '?password='+encodeURIComponent(password) : ''}`}"
);

fs.writeFileSync(file, content);
console.log('PublicShare.tsx download routes fixed');
