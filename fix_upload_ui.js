const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add error property to UploadItem
content = content.replace(/interface UploadItem \{ id: string; name: string; size: number; progress: number; done: boolean \}/,
  "interface UploadItem { id: string; name: string; size: number; progress: number; done: boolean; error?: boolean }"
);

// 2. Fix handleFolderInput catch block
content = content.replace(/console\.error\('Folder file upload failed:', err\)\s*setUploads\(u => u \? u\.map\(x => x\.id === uf\.id \? \{ \.\.\.x, done: true \} : x\) : null\)/g,
  "console.error('Folder file upload failed:', err)\n        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, done: true, error: true } : x) : null)"
);

// 3. Fix handleFileInput catch block
content = content.replace(/console\.error\('Upload failed:', err\)\s*setUploads\(u => u \? u\.map\(x => x\.id === uf\.id \? \{ \.\.\.x, done: true \} : x\) : null\)/g,
  "console.error('Upload failed:', err)\n        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, done: true, error: true } : x) : null)"
);

// 4. Make UploadToast red if error
content = content.replace(/className=\{`h-full rounded-full transition-all duration-300 \$\{f\.done \? 'bg-green-500' : 'progress-bar'\} `\}/g,
  "className={`h-full rounded-full transition-all duration-300 ${f.error ? 'bg-red-500' : f.done ? 'bg-green-500' : 'progress-bar'}`}"
);

content = content.replace(/className=\{`h-full rounded-full transition-all duration-300 \$\{f\.done \? 'bg-green-500' : 'progress-bar'\}`\}/g,
  "className={`h-full rounded-full transition-all duration-300 ${f.error ? 'bg-red-500' : f.done ? 'bg-green-500' : 'progress-bar'}`}"
);

fs.writeFileSync(file, content);
console.log('Upload UI fix script completed');
