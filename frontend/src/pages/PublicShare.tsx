import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicFile } from '../lib/api'
import { Download, Lock, FileText, FileImage, FileVideo, Music, FileArchive, Folder } from 'lucide-react'

import { PdfViewer } from '../components/PdfViewer'

const COLORS: Record<string, string> = {
  folder: '#F59E0B', image: '#1054A0', video: '#EF4444', audio: '#8B5CF6',
  pdf: '#EF4444', doc: '#3B82F6', spreadsheet: '#10B981', archive: '#6B7280', other: '#9CA3AF'
}

function FIcon({ type, size = 24 }: { type: string; size?: number }) {
  const c = COLORS[type] || COLORS.other
  switch (type) {
    case 'image': return <FileImage size={size} color={c} />
    case 'video': return <FileVideo size={size} color={c} />
    case 'audio': return <Music size={size} color={c} />
    case 'archive': return <FileArchive size={size} color={c} />
    default: return <FileText size={size} color={c} />
  }
}

export default function PublicShare() {
  const { hash } = useParams()
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<any>(null)
  const [allowDownload, setAllowDownload] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')

  useEffect(() => {
    fetchFile()
  }, [hash])

  const fetchFile = async (pw?: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await getPublicFile(hash!, pw)
      setFile(data.file)
      setAllowDownload(data.allowDownload)
      setNeedsPassword(false)
    } catch (err: any) {
      if (err.requirePassword) {
        setNeedsPassword(true)
      } else {
        setError(err.error || 'Failed to load file')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!file || !allowDownload) return;
    fetch(`/api/share/public/${hash}/download${password ? '?password='+encodeURIComponent(password) : ''}`)
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error(err);
        alert('Failed to download file');
      });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 text-center border border-gray-100 dark:border-slate-800">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Protected File</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">This file is password protected. Please enter the password to view it.</p>
          <form onSubmit={e => { e.preventDefault(); fetchFile(password); }}>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button type="submit" className="w-full py-2.5 bg-[#1054A0] text-white rounded-xl font-medium hover:bg-[#0D4A8A] transition-colors">
              Unlock
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (error || !file) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800">
        <p className="text-gray-500 dark:text-slate-400 mb-4">{error || 'File not found'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white dark:bg-slate-900/10 rounded-xl flex items-center justify-center">
            {file.type === 'folder' ? <Folder size={20} color={COLORS.folder} /> : <FIcon type={file.type} size={20} />}
          </div>
          <div>
            <h1 className="text-white font-medium text-sm truncate max-w-[300px]">{file.name}</h1>
            <p className="text-white/40 text-xs">Shared by {file.owner?.name || 'Unknown'}</p>
          </div>
        </div>
        {allowDownload && file.type !== 'folder' && (
          <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900/10 hover:bg-white dark:bg-slate-900/20 text-white rounded-xl transition-colors text-sm font-medium">
            <Download size={16} /> Download
          </button>
        )}
      </header>
      <main className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {file.type === 'image' ? (
          <img src={`/api/share/public/${hash}/download?preview=true${password ? '&password='+encodeURIComponent(password) : ''}`} alt={file.name} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
        ) : file.type === 'video' ? (
          <video src={`/api/share/public/${hash}/download?preview=true${password ? '&password='+encodeURIComponent(password) : ''}`} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" />
        ) : file.type === 'audio' ? (
          <audio src={`/api/share/public/${hash}/download?preview=true${password ? '&password='+encodeURIComponent(password) : ''}`} controls autoPlay className="w-96" />
        ) : file.type === 'pdf' ? (
          <div className="w-full max-w-5xl h-[80vh]">
            <PdfViewer
              url={`/api/share/public/${hash}/download?preview=true${password ? '&password='+encodeURIComponent(password) : ''}`}
              title={file.name}
              onDownload={allowDownload ? handleDownload : undefined}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 bg-white dark:bg-slate-900/5 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
              <FIcon type={file.type} size={48} />
            </div>
            <p className="text-white/60 text-sm">No preview available</p>
          </div>
        )}
      </main>
    </div>
  )
}

