const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add downloadFile function
content = content.replace(
  /const onOpen = \(id: string\) => \{/,
  `const downloadFile = (fileId: string, fileName: string) => {
    const token = useAuthStore.getState().token;
    fetch(\`/api/files/\${fileId}/download?token=\${token}\`)
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error('Download error:', err);
        alert('Failed to download file');
      });
  };

  const onOpen = (id: string) => {`
);

// 2. Fix folderHistory state and usages
content = content.replace(
  /const \[folderHistory, setFolderHistory\] = useState<string\[\]>\(\[\]\)/,
  "const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([])"
);

content = content.replace(
  /setFolderHistory\(h => \[\.\.\.h, id\]\)/g,
  "setFolderHistory(h => [...h, { id, name: item.name }])"
);

// Fix breadcrumb
content = content.replace(
  /\{folderHistory\.map\(\(fid, i\) => \{\s*const f = items\.find\(x => x\.id === fid\)\s*return \(\s*<div key=\{fid\} className="flex items-center">\s*<ChevronRight size=\{16\} className="text-gray-400 mx-1" \/>\s*<button onClick=\{\(\) => \{ setFolderId\(fid\); setFolderHistory\(h => h\.slice\(0, i \+ 1\)\) \}\} className="text-gray-500 hover:text-gray-900 transition-colors">\s*\{f \? f\.name : 'Folder'\}\s*<\/button>\s*<\/div>\s*\)\s*\}\)\}/g,
  `{folderHistory.map((f, i) => {
              return (
                <div key={f.id} className="flex items-center">
                  <ChevronRight size={16} className="text-gray-400 mx-1" />
                  <button onClick={() => { setFolderId(f.id); setFolderHistory(h => h.slice(0, i + 1)) }} className="text-gray-500 hover:text-gray-900 transition-colors">
                    {f.name}
                  </button>
                </div>
              )
            })}`
);

// 3. Fix thumbnailUrl to include token
content = content.replace(
  /thumbnailUrl: f\.type === 'image' \? `\/api\/files\/\$\{f\.id\}\/download` : undefined/g,
  "thumbnailUrl: f.type === 'image' ? `/api/files/${f.id}/download?token=${useAuthStore.getState().token}` : undefined"
);

// 4. Pass onDownload to PreviewModal
content = content.replace(
  /function PreviewModal\(\{ item, siblings, onClose \}: \{ item: DriveItem; siblings: DriveItem\[\]; onClose: \(\) => void \}\) \{/,
  "function PreviewModal({ item, siblings, onClose, onDownload }: { item: DriveItem; siblings: DriveItem[]; onClose: () => void; onDownload: (id: string, name: string) => void }) {"
);

// Add fallback to PreviewModal
const fallbackPreview = `
        {!['image', 'video', 'audio', 'pdf'].includes(current.type) && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-2xl h-[60vh] bg-white rounded-xl flex items-center justify-center border border-white/10">
              <div className="text-center text-gray-400">
                <FileText size={56} strokeWidth={1} color="#6B7280" className="mx-auto mb-3" />
                <p className="text-sm text-gray-500">No preview available</p>
                <p className="text-xs text-gray-400 mt-1">{current.name}</p>
                <button onClick={() => onDownload(current.id, current.name)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                  <Download size={14} /> Download to view
                </button>
              </div>
            </div>
          </div>
        )}
      </div>`;
content = content.replace(
  /(\{\s*\/\* Thumbnail strip for images \*\/\s*\})/g,
  fallbackPreview + "\n\n      $1"
);

// Fix PDF Download button
content = content.replace(
  /<button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">\s*<Download size=\{14\} \/> Download to view\s*<\/button>/g,
  `<button onClick={() => onDownload(current.id, current.name)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto">
                  <Download size={14} /> Download to view
                </button>`
);

// Update PreviewModal invocation
content = content.replace(
  /<PreviewModal item=\{previewItem\} siblings=\{visibleItems\} onClose=\{\(\) => setPreviewItem\(null\)\} \/>/g,
  "<PreviewModal item={previewItem} siblings={visibleItems} onClose={() => setPreviewItem(null)} onDownload={downloadFile} />"
);

// 5. Update ContextMenu
content = content.replace(
  /function ContextMenu\(\{ ctx, item, onClose, onRename, onShare, onMove, onTrash, onRestore, onDelete \}: \{[\s\S]*?\}\) \{/,
  match => match.replace("}: {", ", onDownload }: { onDownload: () => void; ")
);
content = content.replace(
  /<MenuItem icon=\{Download\} label="Download" onClick=\{\(\) => \{\}\} \/>/g,
  `<MenuItem icon={Download} label="Download" onClick={() => { onDownload(); onClose(); }} />`
);

// Pass onDownload from Drive to FileGrid and FileList
content = content.replace(
  /onTrash=\{\(\) => handleTrash\(ctx\.item\)\} \/>/g,
  "onTrash={() => handleTrash(ctx.item)} onDownload={() => downloadFile(ctx.item, items.find(i => i.id === ctx.item)?.name || 'file')} />"
);

fs.writeFileSync(file, content);
console.log('Fix script done');
