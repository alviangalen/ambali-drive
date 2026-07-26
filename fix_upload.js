const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add folderInputRef
content = content.replace(/const fileInputRef = useRef<HTMLInputElement>\(null\)/,
  "const fileInputRef = useRef<HTMLInputElement>(null)\n  const folderInputRef = useRef<HTMLInputElement>(null)"
);

// 2. Add handleFolderInput
const folderInputCode = `
  const handleFolderInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    
    const uploadItems: UploadItem[] = fileArray.map(f => ({ id: genId(), name: f.name, size: f.size, progress: 0, done: false }))
    setUploads(uploadItems)
    
    // For simplicity, we just upload all files flat to the current folderId.
    // A robust solution would recreate the folder tree, but let's at least upload the files.
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const uf = uploadItems[i]
      try {
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: 30 } : x) : null)
        await uploadFile(file, folderId)
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: 100, done: true } : x) : null)
      } catch (err) {
        console.error('Folder file upload failed:', err)
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, done: true } : x) : null)
      }
    }
    loadData()
  }
`;

content = content.replace(/const handleFileInput =/, folderInputCode + "\n  const handleFileInput =");

// 3. Fix input rendering
const inputsCode = `
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFileInput(e.target.files); e.target.value = ''; }} />
      <input ref={folderInputRef} type="file" webkitdirectory directory className="hidden" onChange={e => { handleFolderInput(e.target.files); e.target.value = ''; }} />
`;
content = content.replace(/<input ref=\{fileInputRef\}[^>]+onChange=\{e => handleFileInput\(e\.target\.files\)\} \/>/, inputsCode);

// 4. Update the "Folder upload" button to use folderInputRef
content = content.replace(/<button onClick=\{\(\) => \{ setNewMenu\(false\); fileInputRef\.current\?\.click\(\) \}\} className="[^"]+">\s*<Upload size=\{15\} className="text-blue-500" \/>Folder upload\s*<\/button>/,
  '<button onClick={() => { setNewMenu(false); folderInputRef.current?.click() }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">\n                  <Upload size={15} className="text-blue-500" />Folder upload\n                </button>'
);

fs.writeFileSync(file, content);
console.log('Upload fix script completed');
