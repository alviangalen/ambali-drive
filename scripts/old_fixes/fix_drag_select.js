const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'frontend/src/pages/Drive.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add useRef to react imports
if (!content.includes('useRef')) {
  content = content.replace(
    /import \{ useState, useEffect \} from 'react'/,
    "import { useState, useEffect, useRef } from 'react'"
  );
}

// 2. Add state for dragBox
if (!content.includes('const [dragBox, setDragBox]')) {
  content = content.replace(
    /const \[search, setSearch\] = useState\(''\)/,
    `const [search, setSearch] = useState('')
  const [dragBox, setDragBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const dragBoxRef = useRef<{ startX: number, startY: number } | null>(null);`
  );
}

// 3. Add handleMouseDown, handleMouseMove, handleMouseUp
if (!content.includes('const handleMouseDown =')) {
  const dragLogic = `
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-file-id]') || target.closest('button') || target.closest('input') || target.closest('.no-drag')) {
      return;
    }
    dragBoxRef.current = { startX: e.clientX, startY: e.clientY };
    setDragBox({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragBoxRef.current) return;
    setDragBox({ ...dragBoxRef.current, endX: e.clientX, endY: e.clientY });
    
    // Collision detection
    const boxLeft = Math.min(dragBoxRef.current.startX, e.clientX);
    const boxRight = Math.max(dragBoxRef.current.startX, e.clientX);
    const boxTop = Math.min(dragBoxRef.current.startY, e.clientY);
    const boxBottom = Math.max(dragBoxRef.current.startY, e.clientY);

    const fileEls = document.querySelectorAll('[data-file-id]');
    const newSelected = new Set(selected); // Keep previously selected items? 
    // Usually drag select REPLACES selection unless Shift/Ctrl is held.
    // Let's replace selection if neither is held, or add if Ctrl is held.
    let baseSelection = (e.ctrlKey || e.metaKey || e.shiftKey) ? new Set(selected) : new Set<string>();

    fileEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      const overlap = !(rect.right < boxLeft || rect.left > boxRight || rect.bottom < boxTop || rect.top > boxBottom);
      const id = el.getAttribute('data-file-id');
      if (id) {
        if (overlap) {
          baseSelection.add(id);
        } else if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
           // We only remove if it wasn't selected before the drag started, but it's hard to track. 
           // For simplicity, we just rebuild the set from scratch if no modifiers.
        }
      }
    });
    setSelected(baseSelection);
  };

  const handleMouseUp = () => {
    dragBoxRef.current = null;
    setDragBox(null);
  };
`;

  content = content.replace(
    /const \[newMenu, setNewMenu\] = useState\(false\)/,
    `const [newMenu, setNewMenu] = useState(false)\n${dragLogic}`
  );
}

// 4. Update <main> element
if (!content.includes('onMouseDown={handleMouseDown}')) {
  content = content.replace(
    /<main className="flex-1 overflow-y-auto"/,
    `<main className="flex-1 overflow-y-auto" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}`
  );
}

// 5. Add Selection Box UI
if (!content.includes('id="selection-box"')) {
  const boxUI = `
        {dragBox && (
          <div
            id="selection-box"
            style={{
              position: 'fixed',
              pointerEvents: 'none',
              zIndex: 9999,
              border: '1px solid rgba(66, 133, 244, 0.5)',
              backgroundColor: 'rgba(66, 133, 244, 0.1)',
              left: Math.min(dragBox.startX, dragBox.endX),
              top: Math.min(dragBox.startY, dragBox.endY),
              width: Math.abs(dragBox.endX - dragBox.startX),
              height: Math.abs(dragBox.endY - dragBox.startY),
            }}
          />
        )}
  `;
  content = content.replace(
    /\{\/\* Upload toast \*\/\}/,
    `${boxUI}\n      {/* Upload toast */}`
  );
}

// 6. Update Ctrl+Click logic in FileGrid and FileList
// Wait, the onSelect callback is used. We need to pass the event to know if Ctrl is held!
// Actually, FileGrid/FileList already has onClick handler that checks e.ctrlKey:
// onClick={e => { e.stopPropagation(); if (selected.has(item.id) && !e.metaKey && !e.ctrlKey) onOpen(item); else onSelect(new Set([item.id])) }}
// We need to change that to:
// else if (e.ctrlKey || e.metaKey) { const s = new Set(selected); if (s.has(item.id)) s.delete(item.id); else s.add(item.id); onSelect(s); } else { onSelect(new Set([item.id])) }

content = content.replace(
  /onClick=\{e => \{ e\.stopPropagation\(\); if \(selected\.has\(item\.id\) && !e\.metaKey && !e\.ctrlKey\) onOpen\(item\); else onSelect\(new Set\(\[item\.id\]\)\) \}\}/g,
  `onClick={e => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
              const s = new Set(selected);
              if (s.has(item.id)) s.delete(item.id);
              else s.add(item.id);
              onSelect(s);
            } else if (selected.has(item.id)) {
              onOpen(item);
            } else {
              onSelect(new Set([item.id]));
            }
          }}`
);

// Add data-file-id to FileGrid items
content = content.replace(
  /className={`group relative flex flex-col p-3 rounded-2xl border transition-all duration-200 cursor-pointer \$\{/g,
  `data-file-id={item.id}\n          className={\`group relative flex flex-col p-3 rounded-2xl border transition-all duration-200 cursor-pointer \${`
);

// Add data-file-id to FileList items
content = content.replace(
  /className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer \$\{/g,
  `data-file-id={item.id}\n          className={\`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer \${`
);

fs.writeFileSync(file, content);
console.log('Drag select added');
