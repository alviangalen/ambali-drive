const fs = require('fs');
const file = 'frontend/src/pages/Drive.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'interface UploadItem { id: string; name: string; size: number; progress: number; done: boolean; error?: boolean; errorMsg?: string }',
  'interface UploadItem { id: string; name: string; size: number; progress: number; done: boolean; error?: boolean; errorMsg?: string; abortController?: AbortController }'
);

code = code.replace(
  'function UploadToast({ files, onDone }: { files: UploadItem[]; onDone: () => void }) {',
  'function UploadToast({ files, onDone, onCancel }: { files: UploadItem[], onDone: () => void, onCancel: (id: string) => void }) {'
);

code = code.replace(
  '<span className="text-xs text-gray-400 flex-shrink-0">{f.done ? fmtBytes(f.size) : `${f.progress}%`}</span>',
  `<div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{f.done ? fmtBytes(f.size) : \`\${f.progress}%\`}</span>
                {!f.done && (
                  <button onClick={() => onCancel(f.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>`
);

code = code.replace(
  'export default function Drive() {',
  `export default function Drive() {
  const uploadQueue = useRef<{ file: File, item: UploadItem, folderId: string | null }[]>([])
  const isUploading = useRef(false)
  const uploadsRef = useRef<UploadItem[] | null>(null)`
);

code = code.replace(
  'const [QUOTA, setQuota] = useState(15 * 1024 ** 3);',
  `const [QUOTA, setQuota] = useState(15 * 1024 ** 3);
  useEffect(() => { uploadsRef.current = uploads; }, [uploads])`
);

const oldHandleFolder = `  const handleFolderInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    
    const uploadItems: UploadItem[] = fileArray.map(f => ({ id: genId(), name: f.name, size: f.size, progress: 0, done: false }))
    setUploads(uploadItems)
    
    // For simplicity, we just upload all files flat to the current folderId.
    // A robust solution would recreate the folder tree, but let's at least upload the files.
    await Promise.all(fileArray.map(async (file, i) => {
      const uf = uploadItems[i]
      try {
        await uploadFile(file, folderId, (pct) => {
          setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: pct === 100 ? 99 : pct } : x) : null)
        })
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: 100, done: true } : x) : null)
      } catch (err: any) {
        console.error('Folder file upload failed:', err)
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, done: true, error: true } : x) : null)
      }
    }))
    loadData()
  }

  const handleFileInput = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    
    // Setup uploads state
    const uploadItems: UploadItem[] = fileArray.map(f => ({ id: genId(), name: f.name, size: f.size, progress: 0, done: false }))
    setUploads(uploadItems)
    
    await Promise.all(fileArray.map(async (file, i) => {
      const uf = uploadItems[i]
      try {
        await uploadFile(file, folderId, (pct) => {
          setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: pct === 100 ? 99 : pct } : x) : null)
        })
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, progress: 100, done: true } : x) : null)
      } catch (err: any) {
        console.error('Upload failed:', err)
        setUploads(u => u ? u.map(x => x.id === uf.id ? { ...x, done: true, error: true, errorMsg: err.message || 'Failed' } : x) : null)
      }
    }))
    loadData()
  }`;

const newHandleFolder = `  const processQueue = async () => {
    if (isUploading.current) return;
    isUploading.current = true;
    while (uploadQueue.current.length > 0) {
      const task = uploadQueue.current.shift();
      if (!task) continue;
      const { file, item, folderId: uploadFolderId } = task;
      
      if (item.abortController?.signal.aborted) {
        setUploads(u => u ? u.map(x => x.id === item.id ? { ...x, done: true, error: true, errorMsg: 'Canceled' } : x) : null)
        continue;
      }

      try {
        await uploadFile(file, uploadFolderId, (pct) => {
          setUploads(u => u ? u.map(x => x.id === item.id ? { ...x, progress: pct === 100 ? 99 : pct } : x) : null)
        }, item.abortController?.signal)
        
        setUploads(u => u ? u.map(x => x.id === item.id ? { ...x, progress: 100, done: true } : x) : null)
        loadData()
      } catch (err: any) {
        console.error('Upload failed:', err)
        if (err.message !== 'Upload canceled') {
          setUploads(u => u ? u.map(x => x.id === item.id ? { ...x, done: true, error: true, errorMsg: err.message || 'Failed' } : x) : null)
        }
      }
    }
    isUploading.current = false;
  }

  const handleFolderInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)

    const uploadItems: UploadItem[] = fileArray.map(f => ({ 
      id: genId(), 
      name: f.name, 
      size: f.size, 
      progress: 0, 
      done: false,
      abortController: new AbortController()
    }))

    setUploads(prev => [...(prev || []), ...uploadItems])

    fileArray.forEach((file, i) => {
      uploadQueue.current.push({ file, item: uploadItems[i], folderId })
    })

    processQueue()
  }

  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)

    const uploadItems: UploadItem[] = fileArray.map(f => ({ 
      id: genId(), 
      name: f.name, 
      size: f.size, 
      progress: 0, 
      done: false,
      abortController: new AbortController()
    }))

    setUploads(prev => [...(prev || []), ...uploadItems])

    fileArray.forEach((file, i) => {
      uploadQueue.current.push({ file, item: uploadItems[i], folderId })
    })

    processQueue()
  }

  const handleCancelUpload = (id: string) => {
    const item = uploadsRef.current?.find(u => u.id === id)
    if (item && item.abortController) {
      item.abortController.abort()
      setUploads(u => u ? u.map(x => x.id === id ? { ...x, done: true, error: true, errorMsg: 'Canceled' } : x) : null)
    }
  }`;

code = code.replace(oldHandleFolder, newHandleFolder);

code = code.replace(
  '<UploadToast files={uploads} onDone={() => setUploads(null)} />',
  '<UploadToast files={uploads} onDone={() => setUploads(null)} onCancel={handleCancelUpload} />'
);

fs.writeFileSync(file, code);
console.log("Patched successfully");
