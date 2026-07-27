const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Fix openFolder signature and logic
content = content.replace(
  /const openFolder = \(id: string\) => \{[\s\S]*?setSection\('myDrive'\)\n  \}/,
  `const openFolder = (id: string, name: string) => {
    setFolderHistory(h => [...h, { id, name }])
    setFolderId(id)
    setSelected(new Set())
    setSection('myDrive')
  }`
);

// 2. Fix onOpen inside Drive component
content = content.replace(
  /onOpen=\{\(item\) => \{\n\s*if \(item\.type === 'folder'\) openFolder\(item\.id\)/g,
  `onOpen={(item) => {
                  if (item.type === 'folder') openFolder(item.id, item.name)`
);

// Also check onOpen from Recent Files
content = content.replace(
  /onClick=\{\(\) => onOpen\(item\.id\)\}/g,
  `onClick={() => { if (item.type === 'folder') openFolder(item.id, item.name); else setPreviewItem(item); }}`
); // Wait, recent files map uses onOpen(item.id). I should just pass item.

content = content.replace(
  /onClick=\{\(\) => onOpen\(item\)\}/g, // wait, did it pass item.id?
  "" // I'll just regex the Recent files carefully
);

// Actually, in Drive.tsx, is there a global onOpen?
// No, onOpen is just passed inline to FileGrid and FileList, and used inline in Recent Files.
content = content.replace(
  /<div\n\s*key=\{item\.id\}\n\s*onClick=\{\(\) => onOpen\(item\.id\)\}/g,
  `<div
                  key={item.id}
                  onClick={() => { if (item.type === 'folder') openFolder(item.id, item.name); else setPreviewItem(item); }}`
);

// 3. Fix navigateTo logic
content = content.replace(
  /const navigateTo = \(id: string \| null\) => \{\n\s*setFolderId\(id\)\n\s*setFolderHistory\(\[\]\)\n\s*setSelected\(new Set\(\)\)\n\s*\}/,
  `const navigateTo = (id: string | null) => {
    setFolderId(id)
    if (!id) setFolderHistory([])
    else {
      setFolderHistory(h => {
        const idx = h.findIndex(x => x.id === id)
        return idx >= 0 ? h.slice(0, idx + 1) : h
      })
    }
    setSelected(new Set())
  }`
);

// 4. Fix breadcrumb logic
content = content.replace(
  /const breadcrumb = useMemo\(\(\) => \{[\s\S]*?return crumbs\n  \}, \[folderId, items\]\)/,
  `const breadcrumb = useMemo(() => {
    return [{ id: null as string | null, name: 'My Drive' }, ...folderHistory]
  }, [folderHistory])`
);

// 5. Fix FileGrid onClick
content = content.replace(
  /onClick=\{e => \{ e\.stopPropagation\(\); onSelect\(new Set\(\[item\.id\]\)\) \}\}\n\s*onDoubleClick=\{e => \{ e\.stopPropagation\(\); onOpen\(item\) \}\}/g,
  `onClick={e => { e.stopPropagation(); if (selected.has(item.id) && !e.metaKey && !e.ctrlKey) onOpen(item); else onSelect(new Set([item.id])) }}
        onDoubleClick={e => { e.stopPropagation(); onOpen(item) }}`
);

fs.writeFileSync(file, content);
console.log('Fix script 2 done');
