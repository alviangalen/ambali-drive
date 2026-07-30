import { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Folder, FileText, FileImage, FileVideo, Music, FileArchive, Upload, Download, Plus, Search, Star, Share2, Trash2, LayoutGrid, List, ChevronRight, Clock, Users, User, X, Copy, Scissors, Clipboard, Link, Eye, EyeOff, Calendar, Lock, RotateCcw, Pencil, Home, ZoomIn, ZoomOut, ChevronLeft, CloudUpload, Globe, FolderPlus, Check, AlertTriangle, Move, Settings, HelpCircle, Shield, Bell, ChevronDown, CheckCircle2, LogOut, MoreVertical, Menu
} from 'lucide-react'
import ambaliLogo from '@/imports/ambalilogocrop-removebg-preview.png'
import { fetchFiles, createFolder as apiCreateFolder, uploadFile, renameFile, trashFile, restoreFile, deleteFile, moveFile, copyFile, createShareLink, removeShareLink, getStorageUsed, updateProfile, getSessions, revokeSession } from '../lib/api'
import { useAuthStore } from '../store/authStore'

// ─── Types ───────────────────────────────────────────────────────────────────
type FileType = 'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'spreadsheet' | 'archive' | 'other'
type Role = 'owner' | 'editor' | 'viewer'
type NavSection = 'myDrive' | 'recent' | 'starred' | 'shared' | 'trash'

interface SharedUser { id: string; name: string; email: string; initials: string; color: string; role: Role }
interface ShareLink { url: string; password: string | null; expiresAt: string | null; allowDownload: boolean }
interface DriveItem {
  id: string; name: string; type: FileType; size: number; modified: string
  starred: boolean; trashed: boolean; trashedAt?: string; parentId: string | null
  sharedWith: SharedUser[]; shareLink: ShareLink | null; thumbnailUrl?: string; owner: string
}
interface UploadItem { id: string; name: string; size: number; progress: number; done: boolean; error?: boolean; errorMsg?: string; abortController?: AbortController }
interface CtxMenu { x: number; y: number; itemId: string }


// ─── Utilities ───────────────────────────────────────────────────────────────
function fmtBytes(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB'
  return (b/1073741824).toFixed(2) + ' GB'
}
function fmtDate(iso: string) {
  const d = new Date(iso), now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function genId() { return Math.random().toString(36).slice(2, 10) }

// ─── File Icon ────────────────────────────────────────────────────────────────
const COLORS: Record<FileType, string> = {
  folder: '#F59E0B', image: '#8B5CF6', video: '#EF4444', audio: '#EC4899',
  pdf: '#EF4444', doc: '#2563EB', spreadsheet: '#16A34A', archive: '#78716C', other: '#6B7280'
}
function FIcon({ type, size = 18, className = '' }: { type: FileType; size?: number; className?: string }) {
  const c = COLORS[type], p = { size, color: c, strokeWidth: 1.75, className }
  if (type === 'folder') return <Folder {...p} />
  if (type === 'image') return <FileImage {...p} />
  if (type === 'video') return <FileVideo {...p} />
  if (type === 'audio') return <Music {...p} />
  if (type === 'archive') return <FileArchive {...p} />
  return <FileText {...p} />
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
    >
      {initials}
    </div>
  )
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────
function Modal({ onClose, children, width = 'max-w-lg' }: { onClose: () => void; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${width} slide-up overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({ item, siblings, onClose, onDownload }: { item: DriveItem; siblings: DriveItem[]; onClose: () => void; onDownload: (id: string, name: string) => void }) {
  const imgSiblings = siblings.filter(s => s.type === 'image')
  const [current, setCurrent] = useState(item)
  const [zoom, setZoom] = useState(1)
  const token = useAuthStore.getState().token;
  const previewUrl = `/api/files/${current.id}/download?preview=true&token=${token}`;

  const prev = () => {
    const newIdx = (imgSiblings.findIndex(s => s.id === current.id) - 1 + imgSiblings.length) % imgSiblings.length
    setCurrent(imgSiblings[newIdx])
    setZoom(1)
  }
  const next = () => {
    const newIdx = (imgSiblings.findIndex(s => s.id === current.id) + 1) % imgSiblings.length
    setCurrent(imgSiblings[newIdx])
    setZoom(1)
  }

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    if (current.type === 'image') window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [current])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95 backdrop-blur-sm" onClick={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 text-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <FIcon type={current.type} size={18} />
          <span className="font-medium text-sm text-white/90">{current.name}</span>
          <span className="text-white/40 text-xs">{fmtBytes(current.size)}</span>
        </div>
        <div className="flex items-center gap-2">
          {current.type === 'image' && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                <ZoomOut size={16} />
              </button>
              <span className="text-white/40 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
                <ZoomIn size={16} />
              </button>
            </>
          )}
          <button onClick={() => onDownload(current.id, current.name)} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
            <Download size={16} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 pb-4" onClick={e => e.stopPropagation()}>
        {current.type === 'image' && (
          <div className="relative flex items-center justify-center w-full h-full">
            {imgSiblings.length > 1 && (
              <button onClick={prev} className="absolute left-2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <img
              src={current.thumbnailUrl}
              alt={current.name}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
            {imgSiblings.length > 1 && (
              <button onClick={next} className="absolute right-2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors">
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}
        {current.type === 'video' && (
          <div className="flex flex-col items-center gap-4 w-full h-full justify-center" onClick={e => e.stopPropagation()}>
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-full max-h-[75vh] bg-black rounded-lg shadow-2xl"
            />
          </div>
        )}
        {current.type === 'audio' && (
          <div className="flex flex-col items-center gap-6 w-full h-full justify-center" onClick={e => e.stopPropagation()}>
            <div className="w-64 h-64 bg-gradient-to-br from-pink-500/20 to-purple-500/20 rounded-2xl border border-white/10 flex items-center justify-center">
              <Music size={72} color="#EC4899" strokeWidth={1} />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">{current.name}</p>
              <p className="text-white/40 text-sm mt-1">{fmtBytes(current.size)}</p>
            </div>
            <audio src={previewUrl} controls autoPlay className="w-96" />
          </div>
        )}
        {current.type === 'pdf' && (
          <div className="flex flex-col items-center w-full h-full justify-center" onClick={e => e.stopPropagation()}>
            <iframe
              src={`${previewUrl}#toolbar=0&view=FitH`}
              className="w-full max-w-4xl h-[75vh] rounded-xl bg-white"
              title={current.name}
            />
          </div>
        )}
        { !['image', 'video', 'audio', 'pdf'].includes(current.type) && (
          <div className="flex flex-col items-center gap-4 w-full">
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
      </div>

      {/* Thumbnail strip for images */}
      {current.type === 'image' && imgSiblings.length > 1 && (
        <div className="flex justify-center gap-2 pb-4 overflow-x-auto hide-scrollbar px-4" onClick={e => e.stopPropagation()}>
          {imgSiblings.map(s => (
            <button
              key={s.id}
              onClick={() => { setCurrent(s); setZoom(1) }}
              className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden transition-all ${s.id === current.id ? 'ring-2 ring-blue-400 opacity-100' : 'opacity-40 hover:opacity-70'}`}
            >
              <img src={s.thumbnailUrl} alt={s.name} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ item, onClose, onUpdate }: { item: DriveItem; onClose: () => void; onUpdate: (item: DriveItem) => void }) {
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<'people' | 'link'>('people')
  const [emailInput, setEmailInput] = useState('')
  const [roleInput, setRoleInput] = useState<Role>('viewer')
  const [shared, setShared] = useState<SharedUser[]>(item.sharedWith)
  const [link, setLink] = useState<ShareLink>(item.shareLink ?? { url: 'Link will be generated on save', password: null, expiresAt: null, allowDownload: true })
  const [linkActive, setLinkActive] = useState(!!item.shareLink)
  const [copied, setCopied] = useState(false)
  const [showPwInput, setShowPwInput] = useState(false)
  const [pwValue, setPwValue] = useState(item.shareLink?.password ?? '')
  const [showExpiry, setShowExpiry] = useState(!!item.shareLink?.expiresAt)
  const [expiryValue, setExpiryValue] = useState(item.shareLink?.expiresAt?.split('T')[0] ?? '')
  const [pwVisible, setPwVisible] = useState(false)

  const addPerson = () => {
    if (!emailInput.trim()) return
    const initials = emailInput.split('@')[0].slice(0, 2).toUpperCase()
    const colors = ['#7C3AED', '#059669', '#DC2626', '#0284C7', '#D97706']
    setShared(s => [...s, {
      id: genId(), name: emailInput.split('@')[0], email: emailInput,
      initials, color: colors[shared.length % colors.length], role: roleInput
    }])
    setEmailInput('')
  }
  const removeUser = (id: string) => setShared(s => s.filter(u => u.id !== id))
  const changeRole = (id: string, role: Role) => setShared(s => s.map(u => u.id === id ? { ...u, role } : u))

  const copyLink = () => {
    navigator.clipboard.writeText(link.url);
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const save = async () => {
    try {
      if (linkActive) {
        const pass = showPwInput && pwValue ? pwValue : null;
        const expiry = showExpiry && expiryValue ? expiryValue + 'T23:59:00Z' : null;
        const res = await createShareLink(item.id, link.allowDownload, pass, expiry);
        onUpdate({
          ...item,
          sharedWith: shared,
          shareLink: {
            url: window.location.origin + '/s/' + res.urlHash,
            password: res.passwordHash ? 'has_password' : null,
            expiresAt: res.expiresAt,
            allowDownload: res.allowDownload
          }
        });
      } else if (item.shareLink) {
        await removeShareLink(item.id);
        onUpdate({
          ...item,
          sharedWith: shared,
          shareLink: null
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      alert('Failed to save share settings');
    }
  }

  return (
    <Modal onClose={onClose} width="max-w-xl">
      <div className="px-6 pt-5 pb-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Share "{item.name}"</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage access and sharing settings</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['people', 'link'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'people' ? <span className="flex items-center justify-center gap-1.5"><Users size={13} />{t}</span> : <span className="flex items-center justify-center gap-1.5"><Link size={13} />{t}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
        {tab === 'people' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={emailInput} onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPerson()}
                placeholder="Add people by email…"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-gray-50/50"
              />
              <select value={roleInput} onChange={e => setRoleInput(e.target.value as Role)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-gray-50/50 text-gray-700">
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button onClick={addPerson} className="px-4 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors">Share</button>
            </div>

            <div className="space-y-1">
              {/* Owner */}
              <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50/50">
                <Avatar initials={(user?.name?.substring(0,2).toUpperCase() || 'U')} color="#1054A0" size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{(user?.name || 'User')} <span className="text-gray-400 font-normal">(you)</span></p>
                  <p className="text-xs text-gray-400 truncate">{(user?.email || '')}</p>
                </div>
                <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-200 rounded-lg">Owner</span>
              </div>
              {shared.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-gray-50 group">
                  <Avatar initials={u.initials} color={u.color} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value as Role)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none bg-white text-gray-700">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button onClick={() => removeUser(u.id)} className="p-1 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg group-hover:hidden ${u.role === 'editor' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{u.role}</span>
                </div>
              ))}
              {shared.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No one else has access yet</p>
              )}
            </div>
          </div>
        )}

        {tab === 'link' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${linkActive ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  {linkActive ? <Globe size={15} color="#1054A0" /> : <Lock size={15} className="text-gray-400" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{linkActive ? 'Anyone with the link' : 'Restricted'}</p>
                  <p className="text-xs text-gray-400">{linkActive ? 'Link sharing is on' : 'Only people with access'}</p>
                </div>
              </div>
              <button
                onClick={() => setLinkActive(!linkActive)}
                className={`relative w-11 h-6 rounded-full transition-colors ${linkActive ? 'bg-[#1054A0]' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${linkActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {linkActive && (
              <div className="space-y-3 fade-in">
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate">
                    <Link size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate text-xs">{link.url}</span>
                  </div>
                  <button onClick={copyLink} className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-1.5 ${copied ? 'bg-green-100 text-green-700' : 'bg-[#1054A0] text-white hover:bg-[#0D4A8A]'}`}>
                    {copied ? <><Check size={13} />Copied</> : <><Copy size={13} />Copy</>}
                  </button>
                </div>

                <div className="space-y-2">
                  {/* Password */}
                  <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Lock size={14} className="text-gray-400" />
                      Password protection
                    </div>
                    <button
                      onClick={() => setShowPwInput(!showPwInput)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${showPwInput ? 'bg-[#1054A0]' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showPwInput ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {showPwInput && (
                    <div className="relative">
                      <input
                        type={pwVisible ? 'text' : 'password'}
                        value={pwValue} onChange={e => setPwValue(e.target.value)}
                        placeholder="Set link password…"
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-gray-50/50"
                      />
                      <button onClick={() => setPwVisible(!pwVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {pwVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  )}

                  {/* Expiry */}
                  <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar size={14} className="text-gray-400" />
                      Expiration date
                    </div>
                    <button
                      onClick={() => setShowExpiry(!showExpiry)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${showExpiry ? 'bg-[#1054A0]' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showExpiry ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {showExpiry && (
                    <input
                      type="date" value={expiryValue} onChange={e => setExpiryValue(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-gray-50/50 text-gray-700"
                    />
                  )}

                  {/* Allow download */}
                  <div className="flex items-center justify-between py-2.5 px-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Download size={14} className="text-gray-400" />
                      Allow download
                    </div>
                    <button
                      onClick={() => setLink(l => ({ ...l, allowDownload: !l.allowDownload }))}
                      className={`relative w-9 h-5 rounded-full transition-colors ${link.allowDownload ? 'bg-[#1054A0]' : 'bg-gray-300'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${link.allowDownload ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
        <button onClick={save} className="px-5 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors">Save</button>
      </div>
    </Modal>
  )
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────
function RenameModal({ item, onClose, onRename }: { item: DriveItem; onClose: () => void; onRename: (id: string, name: string) => void }) {
  const [name, setName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.select() }, [])

  const submit = () => {
    if (name.trim()) { onRename(item.id, name.trim()); onClose() }
  }

  return (
    <Modal onClose={onClose} width="max-w-sm">
      <div className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Rename</h2>
        <input
          ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-gray-50/50 text-gray-900"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={submit} className="px-5 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors">Rename</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────
function NewFolderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('Untitled folder')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.select() }, [])

  const submit = () => {
    if (name.trim()) { onCreate(name.trim()); onClose() }
  }

  return (
    <Modal onClose={onClose} width="max-w-sm">
      <div className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">New folder</h2>
        <input
          ref={inputRef} value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose() }}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-gray-50/50 text-gray-900"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={submit} className="px-5 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors">Create</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Empty Trash Modal ────────────────────────────────────────────────────────
function EmptyTrashModal({ count, onClose, onConfirm }: { count: number; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onClose} width="max-w-sm">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={18} color="#DC2626" />
          </div>
          <h2 className="text-base font-semibold text-gray-900">Empty trash?</h2>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          {count} item{count !== 1 ? 's' : ''} will be permanently deleted and cannot be recovered.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={() => { onConfirm(); onClose() }} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition-colors">Empty trash</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Move Modal ───────────────────────────────────────────────────────────────
function MoveModal({ items, allItems, onClose, onMove }: { items: DriveItem[]; allItems: DriveItem[]; onClose: () => void; onMove: (itemId: string, targetId: string | null) => void }) {
  const item = items[0];
  const [selected, setSelected] = useState<string | null>(item.parentId)
  const folders = allItems.filter(i => i.type === 'folder' && !i.trashed && i.id !== item.id)

  return (
    <Modal onClose={onClose} width="max-w-sm">
      <div className="p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Move to…</h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-56 overflow-y-auto">
          <button
            onClick={() => setSelected(null)}
            className={`flex items-center gap-2.5 w-full px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-left ${selected === null ? 'bg-blue-50 text-[#1054A0]' : 'text-gray-700'}`}
          >
            <Home size={14} className={selected === null ? 'text-[#1054A0]' : 'text-gray-400'} />
            My Drive (root)
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`flex items-center gap-2.5 w-full px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-left ${selected === f.id ? 'bg-blue-50 text-[#1054A0]' : 'text-gray-700'}`}
            >
              <Folder size={14} color={selected === f.id ? '#1054A0' : '#F59E0B'} />
              {f.name}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={() => { items.forEach(i => onMove(i.id, selected)); onClose() }} className="px-5 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors">Move here</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Upload Toast ─────────────────────────────────────────────────────────────
function UploadToast({ files, onDone, onCancel }: { files: UploadItem[], onDone: () => void, onCancel: (id: string) => void }) {
  const allDone = files.every(f => f.done)
  return (
    <div className="fixed bottom-24 md:bottom-5 right-4 md:right-5 z-50 w-[calc(100%-2rem)] md:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden slide-up">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {allDone ? <CheckCircle2 size={15} color="#16A34A" /> : <CloudUpload size={15} color="#1054A0" />}
          <span className="text-sm font-medium text-gray-800">
            {allDone ? 'Upload complete' : `Uploading ${files.length} file${files.length !== 1 ? 's' : ''}…`}
          </span>
        </div>
        {allDone && <button onClick={onDone} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={14} /></button>}
      </div>
      <div className="p-3 space-y-2.5 max-h-48 overflow-y-auto">
        {files.map(f => (
          <div key={f.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600 truncate flex-1 mr-2">
                {f.name}
                {f.errorMsg && <span className="text-red-500 ml-2 block truncate">{f.errorMsg}</span>}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 flex-shrink-0">{f.done ? fmtBytes(f.size) : `${f.progress}%`}</span>
                {!f.done && (
                  <button onClick={() => onCancel(f.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${f.error ? 'bg-red-500' : f.done ? 'bg-green-500' : 'progress-bar'}`}
                style={{ width: `${f.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({
  ctx, item, section, onClose, onPreview, onStar, onShare, onRename, onMove, onTrash, onRestore, onDelete, onDownload, onCopy, onCut
}: {
  ctx: CtxMenu; item: DriveItem; section: NavSection; onClose: () => void;
  onPreview: () => void; onStar: () => void; onShare: () => void;
  onRename: () => void; onMove: () => void; onTrash: () => void;
  onRestore: () => void; onDelete: () => void; onDownload: () => void; onCopy?: () => void; onCut?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() }
    setTimeout(() => window.addEventListener('mousedown', fn), 0)
    return () => window.removeEventListener('mousedown', fn)
  }, [])

  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: ctx.y,
    left: ctx.x,
    zIndex: 100,
    opacity: 0
  })

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      let newTop = ctx.y
      let newLeft = ctx.x
      if (newTop + rect.height > window.innerHeight) {
        newTop = Math.max(10, window.innerHeight - rect.height - 10)
      }
      if (newLeft + rect.width > window.innerWidth) {
        newLeft = Math.max(10, window.innerWidth - rect.width - 10)
      }
      setStyle({
        position: 'fixed',
        top: newTop,
        left: newLeft,
        zIndex: 100,
        opacity: 1
      })
    }
  }, [ctx])

  const MenuItem = ({ icon: Icon, label, onClick, danger = false }: { icon: React.ComponentType<any>; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick(); onClose() }}
      className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`}
    >
      <Icon size={14} className={danger ? 'text-red-400' : 'text-gray-400'} />
      {label}
    </button>
  )

  return (
    <div ref={menuRef} style={style} className="w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 fade-in overflow-hidden">
      {section === 'trash' ? (
        <>
          <MenuItem icon={RotateCcw} label="Restore" onClick={onRestore} />
          <div className="h-px bg-gray-100 my-1" />
          <MenuItem icon={Trash2} label="Delete permanently" onClick={onDelete} danger />
        </>
      ) : (
        <>
          {item.type !== 'folder' && (
            <MenuItem icon={Eye} label="Preview" onClick={onPreview} />
          )}
          <MenuItem icon={Download} label="Download" onClick={() => { onDownload(); onClose(); }} />
          <div className="h-px bg-gray-100 my-1" />
          <MenuItem icon={Star} label={item.starred ? 'Remove from starred' : 'Add to starred'} onClick={onStar} />
          <MenuItem icon={Share2} label="Share" onClick={onShare} />
          <div className="h-px bg-gray-100 my-1" />
          <MenuItem icon={Pencil} label="Rename" onClick={onRename} />
          <MenuItem icon={Move} label="Move to…" onClick={onMove} />
          {onCopy && <MenuItem icon={Copy} label="Copy" onClick={onCopy} />}
          {onCut && <MenuItem icon={Scissors} label="Cut" onClick={onCut} />}
          <div className="h-px bg-gray-100 my-1" />
          <MenuItem icon={Trash2} label="Move to trash" onClick={onTrash} danger />
        </>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Drive() {
  const uploadQueue = useRef<{ file: File, item: UploadItem, folderId: string | null }[]>([])
  const isUploading = useRef(false)
  const uploadsRef = useRef<UploadItem[] | null>(null)
  const [QUOTA, setQuota] = useState(15 * 1024 ** 3);
  const [items, setItems] = useState<DriveItem[]>([])
  const [USED_BYTES, setUsedBytes] = useState(0);
  const [loadingItems, setLoadingItems] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const section = (searchParams.get('section') as NavSection) || 'myDrive'
  const folderId = searchParams.get('folder') || null

  const updateDriveState = useCallback((opts: { s?: NavSection, fId?: string | null }, replace = false) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (opts.s !== undefined) next.set('section', opts.s);
      if (opts.fId !== undefined) {
        if (opts.fId) next.set('folder', opts.fId);
        else next.delete('folder');
      }
      return next;
    }, { replace });
  }, [setSearchParams]);
  const [folderHistory, setFolderHistory] = useState<{id: string, name: string}[]>([])
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const logout = useAuthStore(s => s.logout)
  const user = useAuthStore(s => s.user)

  const loadData = async () => {
    try {
      setItems([])
      setLoadingItems(true)
      const data = await fetchFiles(folderId, section === 'trash', section !== 'myDrive')
      getStorageUsed().then(s => { setUsedBytes(s.used); if (s.quota) setQuota(s.quota); }).catch(console.error)
      // Map API files to DriveItem interface
      const mapped = data.map((f: any) => ({
        id: f.id, name: f.name, type: f.type, size: Number(f.size),
        modified: f.updatedAt, starred: f.isStarred, trashed: f.isTrashed,
        trashedAt: f.trashedAt, parentId: f.parentId, sharedWith: [],
        shareLink: f.publicLink ? {
          url: window.location.origin + '/s/' + f.publicLink.urlHash,
          password: f.publicLink.passwordHash ? 'has_password' : null,
          expiresAt: f.publicLink.expiresAt,
          allowDownload: f.publicLink.allowDownload
        } : null, owner: f.ownerId,
        thumbnailUrl: f.type === 'image' ? `/api/files/${f.id}/download?token=${useAuthStore.getState().token}` : undefined
      }))
      setItems(mapped)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingItems(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [folderId, section])

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[] | null>(null)
  useEffect(() => { uploadsRef.current = uploads; }, [uploads])

  // Prevent accidental navigation/reload when uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploads && uploads.some(i => !i.done && !i.error)) {
        e.preventDefault();
        e.returnValue = 'You have active uploads. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [uploads]);
  const [ctx, setCtx] = useState<CtxMenu | null>(null)
  const [newMenu, setNewMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Modals
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null)
  const [shareItem, setShareItem] = useState<DriveItem | null>(null)
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null)
  const [moveItems, setMoveItems] = useState<DriveItem[] | null>(null)
  const [clipboard, setClipboard] = useState<{ action: 'copy' | 'cut', items: DriveItem[] } | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showEmptyTrash, setShowEmptyTrash] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Computed: visible items
  const visibleItems = useMemo(() => {
    let list: DriveItem[] = []
    if (section === 'shared') return []
    if (section === 'trash') return items.filter(i => i.trashed)
    if (section === 'starred') return items.filter(i => i.starred && !i.trashed)
    if (section === 'recent') return [...items.filter(i => !i.trashed)].sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()).slice(0, 15)
    // myDrive
    list = items.filter(i => !i.trashed && i.parentId === folderId)
    return list
  }, [items, section, folderId])

  const filteredItems = useMemo(() => {
    if (!search) return visibleItems
    return items.filter(i => !i.trashed && i.name.toLowerCase().includes(search.toLowerCase()))
  }, [visibleItems, search, items])

  const recentItems = useMemo(() =>
    [...items.filter(i => !i.trashed && i.type !== 'folder')].sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()).slice(0, 6)
  , [items])

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    return [{ id: null as string | null, name: 'My Drive' }, ...folderHistory]
  }, [folderHistory])

  // Actions
  const downloadFile = (fileId: string, fileName: string) => {
    const token = useAuthStore.getState().token;
    fetch(`/api/files/${fileId}/download?token=${token}`)
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

  const openFolder = (id: string, name: string) => {
    setFolderHistory(h => {
      if (h.length > 0 && h[h.length - 1].id === id) return h;
      return [...h, { id, name }];
    })
    updateDriveState({ s: 'myDrive', fId: id });
    setSelected(new Set())
  }
  const navigateTo = (id: string | null) => {
    updateDriveState({ fId: id });
    if (!id) setFolderHistory([])
    else {
      setFolderHistory(h => {
        const idx = h.findIndex(x => x.id === id)
        return idx >= 0 ? h.slice(0, idx + 1) : h
      })
    }
    setSelected(new Set())
  }
  const navigateSection = (s: NavSection) => {
    updateDriveState({ s, fId: null });
    setFolderHistory([])
    setSelected(new Set())
    setSearch('')
  }
  const toggleStar = (id: string) => setItems(i => i.map(x => x.id === id ? { ...x, starred: !x.starred } : x))
  const trashItem = async (id: string) => {
    setItems(i => i.map(x => x.id === id ? { ...x, trashed: true, trashedAt: new Date().toISOString() } : x))
    await trashFile(id).catch(loadData)
  }
  const restoreItem = async (id: string) => {
    setItems(i => i.map(x => x.id === id ? { ...x, trashed: false, trashedAt: undefined } : x))
    await restoreFile(id).catch(loadData)
  }
  const deleteItem = async (id: string) => {
    setItems(i => i.filter(x => x.id !== id))
    await deleteFile(id).catch(loadData)
  }
  const emptyTrash = async () => {
    const trashed = items.filter(x => x.trashed)
    setItems(i => i.filter(x => !x.trashed))
    for (const f of trashed) {
      await deleteFile(f.id).catch(console.error)
    }
  }
  const renameItemFn = async (id: string, name: string) => {
    setItems(i => i.map(x => x.id === id ? { ...x, name } : x))
    await renameFile(id, name).catch(loadData)
  }
  const handlePaste = async () => {
    if (!clipboard) return;
    try {
      if (clipboard.action === 'copy') {
        for (const item of clipboard.items) {
          if (item.type !== 'folder') {
            await copyFile(item.id, folderId);
          }
        }
      } else if (clipboard.action === 'cut') {
        for (const item of clipboard.items) {
          await moveFile(item.id, folderId);
        }
      }
      setClipboard(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to paste items');
    }
  }

  const moveItemFn = async (itemId: string, targetId: string | null) => {
    setItems(i => i.map(x => x.id === itemId ? { ...x, parentId: targetId, modified: new Date().toISOString() } : x))
    await moveFile(itemId, targetId).catch(loadData)
  }
  const updateItem = (updated: DriveItem) => setItems(i => i.map(x => x.id === updated.id ? updated : x))
  const createFolder = async (name: string) => {
    try {
      await apiCreateFolder(name, section === 'myDrive' ? folderId : null)
      loadData() // reload instead of optimistic to get exact ID
    } catch (e) { console.error(e) }
  }

  
  const processQueue = async () => {
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
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileInput(e.dataTransfer.files)
  }, [folderId])

  const ctxItem = ctx ? items.find(i => i.id === ctx.itemId) : null

  const trashCount = items.filter(i => i.trashed).length

  const navItems: { id: NavSection; icon: React.ComponentType<any>; label: string; count?: number }[] = [
    { id: 'myDrive', icon: Home, label: 'My Drive' },
    { id: 'recent', icon: Clock, label: 'Recent' },
    { id: 'starred', icon: Star, label: 'Starred' },
    { id: 'shared', icon: Users, label: 'Shared with me' },
    { id: 'trash', icon: Trash2, label: 'Trash', count: trashCount || undefined },
  ]

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-gray-50 font-sans overflow-hidden"
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-shrink-0 ${sidebarOpen ? 'w-60' : 'w-0 overflow-hidden'} transition-all duration-200 flex-col bg-white border-r border-gray-100 h-full`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-50">
          <img src={ambaliLogo} alt="Ambali Drive logo" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-gray-900 text-[15px] tracking-tight">Ambali Drive</span>
        </div>

        {/* New button */}
        <div className="hidden md:block px-4 pt-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setNewMenu(!newMenu)}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-[#1054A0] to-[#2563EB] text-white rounded-xl text-sm font-medium hover:shadow-md hover:shadow-blue-200 transition-all"
            >
              <Plus size={16} />
              New
              <ChevronDown size={14} className="ml-auto" />
            </button>
            
      {profileOpen && (
        <ProfileModal 
          user={user} 
          onClose={() => setProfileOpen(false)} 
          onUpdated={(newUser: any) => {
            useAuthStore.setState(state => ({ ...state, user: newUser }));
            useAuthStore.getState().login(newUser, useAuthStore.getState().token!);
          }}
        />
      )}


        {newMenu && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 fade-in">
                <button onClick={() => { setShowNewFolder(true); setNewMenu(false) }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <FolderPlus size={15} className="text-amber-500" />New folder
                </button>
                <div className="h-px bg-gray-100 my-1" />
                <button onClick={() => { setNewMenu(false); fileInputRef.current?.click() }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Upload size={15} className="text-blue-500" />File upload
                </button>
                <button onClick={() => { setNewMenu(false); folderInputRef.current?.click() }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <CloudUpload size={15} className="text-blue-500" />Folder upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-3 space-y-0.5">
          {navItems.map(n => {
            const isActive = section === n.id
            return (
              <button
                key={n.id}
                onClick={() => navigateSection(n.id)}
                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-all ${isActive ? 'bg-blue-50 text-[#1054A0] font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <n.icon size={16} className={isActive ? 'text-[#1054A0]' : 'text-gray-400'} strokeWidth={isActive ? 2 : 1.75} />
                {n.label}
                {n.count && (
                  <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{n.count}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Storage */}
        <div className="px-4 py-4 border-t border-gray-50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-600">Storage</span>
            <span className="text-xs text-gray-400">{fmtBytes(USED_BYTES)} of {fmtBytes(QUOTA)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(USED_BYTES / QUOTA) * 100}%`,
                background: 'linear-gradient(90deg, #1054A0, #3B82F6)'
              }}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {(user?.name?.substring(0,2).toUpperCase() || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{(user?.name || 'User')}</p>
              <p className="text-xs text-gray-400 truncate">{(user?.email || '')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2.5 md:py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <button onClick={() => setSidebarOpen(s => !s)} className="hidden md:block p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
            <List size={18} />
          </button>
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in Drive…"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 focus:bg-white transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600" title="Notifications">
              <Bell size={17} />
            </button>
            <div className="relative">
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600 focus:outline-none" 
                title="Settings"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <Settings size={17} />
              </button>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 overflow-hidden">
                    {user?.role === 'admin' && (
                      <button onClick={() => { setSettingsOpen(false); window.location.href = '/admin'; }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                        <Shield size={16} className="text-gray-400" />
                        Admin Panel
                      </button>
                    )}
                    <button onClick={() => { setSettingsOpen(false); setProfileOpen(true); }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors">
                      <User size={16} className="text-gray-400" />
                      Account Settings
                    </button>
                    <button onClick={() => { setSettingsOpen(false); logout(); }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors">
                      <LogOut size={16} className="text-red-500" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600" title="Help">
              <HelpCircle size={17} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto"
          onClick={() => { setSelected(new Set()); setCtx(null); setNewMenu(false) }}
        >
          <div className="px-4 md:px-6 pt-4 md:pt-5 pb-8">
            {/* Breadcrumb + actions */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {search ? (
                  <span className="text-base font-semibold text-gray-900 truncate">Search results for "{search}"</span>
                ) : section === 'myDrive' ? (
                  <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar flex-nowrap mask-edges max-w-full">
                    {breadcrumb.map((c, i) => (
                      <div key={i} className="flex items-center gap-1 flex-shrink-0">
                        {i > 0 && <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />}
                        <button
                          onClick={e => { e.stopPropagation(); navigateTo(c.id) }}
                          className={`text-sm font-medium rounded-lg px-2 py-1 transition-colors ${i === breadcrumb.length - 1 ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                        >
                          {c.name}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-base font-semibold text-gray-900">
                    {navItems.find(n => n.id === section)?.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {section === 'trash' && trashCount > 0 && (
                  <button onClick={e => { e.stopPropagation(); setShowEmptyTrash(true) }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />Empty trash
                  </button>
                )}
                {section !== 'trash' && section !== 'shared' && !search && (
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="hidden md:flex items-center gap-1.5 px-3 py-2 text-sm text-[#1054A0] border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    <Upload size={14} />Upload
                  </button>
                )}
                <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
                  <button onClick={e => { e.stopPropagation(); setViewMode('grid') }} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                    <LayoutGrid size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setViewMode('list') }} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}>
                    <List size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Access (only on root myDrive, no search) */}
            {section === 'myDrive' && !folderId && !search && (
              <div className="mb-7">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent files</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {recentItems.map(item => (
                    <button
                      key={item.id}
                      onDoubleClick={e => { e.stopPropagation(); setPreviewItem(item) }}
                      className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all text-center"
                    >
                      {item.type === 'image' && item.thumbnailUrl ? (
                        <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full aspect-square rounded-lg flex items-center justify-center" style={{ background: COLORS[item.type] + '18' }}>
                          <FIcon type={item.type} size={24} />
                        </div>
                      )}
                      <span className="text-xs text-gray-600 truncate w-full">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Drag drop overlay hint */}
            {isDragging && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-blue-600/10 border-2 border-dashed border-blue-400 pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-blue-700">
                  <CloudUpload size={48} strokeWidth={1.5} />
                  <p className="text-lg font-semibold">Drop files to upload</p>
                </div>
              </div>
            )}

            {/* File list label */}
            {section === 'myDrive' && !search && (
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {folderId ? (items.find(i => i.id === folderId)?.name ?? '') : 'All files'}
              </h3>
            )}

            {/* Files */}
            {loadingItems ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                <div className="w-8 h-8 border-4 border-[#1054A0]/20 border-t-[#1054A0] rounded-full animate-spin mb-4"></div>
                <p className="font-medium text-gray-500 mb-1">Loading...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                {section === 'trash' ? <Trash2 size={40} strokeWidth={1} className="mb-3" /> :
                  section === 'starred' ? <Star size={40} strokeWidth={1} className="mb-3" /> :
                  search ? <Search size={40} strokeWidth={1} className="mb-3" /> :
                  <Folder size={40} strokeWidth={1} className="mb-3" />}
                <p className="font-medium text-gray-500 mb-1">
                  {section === 'trash' ? 'Trash is empty' :
                    section === 'starred' ? 'No starred files' :
                    search ? 'No results found' : 'This folder is empty'}
                </p>
                <p className="text-sm text-gray-400">
                  {section === 'trash' ? 'Files you delete will appear here' :
                    section === 'starred' ? 'Star files to find them quickly' :
                    search ? `Try a different search term` : 'Upload files or create a folder to get started'}
                </p>
                {!search && section !== 'trash' && section !== 'starred' && section !== 'shared' && (
                  <button
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
                    className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors"
                  >
                    <Upload size={15} /> Upload files
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <FileGrid
                items={filteredItems} selected={selected} section={section}
                onSelect={setSelected} onOpen={(item) => {
                  if (item.type === 'folder') openFolder(item.id, item.name)
                  else setPreviewItem(item)
                }}
                onCtx={(e, id) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, itemId: id }) }}
                onStar={toggleStar} onShare={setShareItem}
              />
            ) : (
              <FileList
                items={filteredItems} selected={selected} section={section}
                onSelect={setSelected} onOpen={(item) => {
                  if (item.type === 'folder') openFolder(item.id, item.name)
                  else setPreviewItem(item)
                }}
                onCtx={(e, id) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, itemId: id }) }}
                onStar={toggleStar} onShare={setShareItem} onTrash={trashItem}
              />
            )}
          </div>
        </main>
      </div>

      {/* Hidden file input */}
      
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { handleFileInput(e.target.files); e.target.value = ''; }} />
      {/* @ts-ignore */}
      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" className="hidden" onChange={e => { handleFolderInput(e.target.files); e.target.value = ''; }} />


      {/* Context Menu */}
      {ctx && ctxItem && (
        <ContextMenu
          ctx={ctx} item={ctxItem} section={section} onClose={() => setCtx(null)}
          onPreview={() => setPreviewItem(ctxItem)}
          onShare={() => setShareItem(ctxItem)}
          onRename={() => setRenameItem(ctxItem)}
          onStar={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected) : [ctxItem.id];
            itemsToProcess.forEach(id => toggleStar(id));
            setCtx(null);
          }}
          onMove={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected).map(id => items.find(i => i.id === id)!) : [ctxItem];
            setMoveItems(itemsToProcess);
            setCtx(null);
          }}
          onTrash={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected) : [ctxItem.id];
            itemsToProcess.forEach(id => trashItem(id));
            setSelected(new Set());
            setCtx(null);
          }}
          onRestore={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected) : [ctxItem.id];
            itemsToProcess.forEach(id => restoreItem(id));
            setSelected(new Set());
            setCtx(null);
          }}
          onDelete={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected) : [ctxItem.id];
            itemsToProcess.forEach(id => deleteItem(id));
            setSelected(new Set());
            setCtx(null);
          }}
          onDownload={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected) : [ctxItem.id];
            itemsToProcess.forEach(id => {
              const it = items.find(i => i.id === id);
              if (it && it.type !== 'folder') downloadFile(id, it.name);
            });
            setSelected(new Set());
            setCtx(null);
          }}
          onCopy={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected).map(id => items.find(i => i.id === id)!) : [ctxItem];
            setClipboard({ action: 'copy', items: itemsToProcess });
            setSelected(new Set());
            setCtx(null);
          }}
          onCut={() => {
            const itemsToProcess = (selected.size > 1 && selected.has(ctxItem.id)) ? Array.from(selected).map(id => items.find(i => i.id === id)!) : [ctxItem];
            setClipboard({ action: 'cut', items: itemsToProcess });
            setSelected(new Set());
            setCtx(null);
          }}
        />
      )}

      {/* Modals */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          siblings={items.filter(i => i.parentId === previewItem.parentId && !i.trashed)}
          onClose={() => setPreviewItem(null)}
          onDownload={downloadFile}
        />
      )}
      {shareItem && (
        <ShareModal item={shareItem} onClose={() => setShareItem(null)} onUpdate={updateItem} />
      )}
      {renameItem && (
        <RenameModal item={renameItem} onClose={() => setRenameItem(null)} onRename={renameItemFn} />
      )}
      {moveItems && (
        <MoveModal items={moveItems} allItems={items} onClose={() => setMoveItems(null)} onMove={moveItemFn} />
      )}
      {showNewFolder && (
        <NewFolderModal onClose={() => setShowNewFolder(false)} onCreate={createFolder} />
      )}
      {showEmptyTrash && (
        <EmptyTrashModal count={trashCount} onClose={() => setShowEmptyTrash(false)} onConfirm={emptyTrash} />
      )}

      
      {/* Clipboard Bar */}
      {clipboard && (
        <div className="fixed bottom-24 md:bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-full shadow-xl px-5 py-3 flex items-center gap-4 slide-up">
          <div className="flex items-center gap-2">
            {clipboard.action === 'copy' ? <Copy size={16} className="text-gray-400" /> : <Scissors size={16} className="text-gray-400" />}
            <span className="text-sm font-medium">{clipboard.items.length} item{clipboard.items.length !== 1 ? 's' : ''} {clipboard.action === 'copy' ? 'copied' : 'cut'}</span>
          </div>
          <div className="w-px h-4 bg-gray-700"></div>
          <button onClick={handlePaste} className="flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
            <Clipboard size={16} />
            Paste here
          </button>
          <button onClick={() => setClipboard(null)} className="p-1 text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload toast */}
      {uploads && (
        <UploadToast files={uploads} onDone={() => setUploads(null)} onCancel={handleCancelUpload} />
      )}

      {/* Mobile Bottom Nav */}
      <div className="md:hidden flex items-center justify-around bg-white border-t border-gray-200 px-2 py-1.5 flex-shrink-0 z-40">
        {navItems.filter(n => n.id !== 'shared').map(n => {
          const isActive = section === n.id
          return (
            <button
              key={n.id}
              onClick={() => navigateSection(n.id)}
              className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[64px] rounded-xl transition-all ${isActive ? 'text-[#1054A0]' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <n.icon size={22} className={isActive ? 'text-[#1054A0] fill-blue-50' : 'text-gray-400'} strokeWidth={isActive ? 2 : 1.75} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#1054A0]' : 'text-gray-500'}`}>{n.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 p-2 min-w-[64px] rounded-xl transition-all ${mobileMenuOpen ? 'text-[#1054A0]' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Menu size={22} className={mobileMenuOpen ? 'text-[#1054A0]' : 'text-gray-400'} strokeWidth={1.75} />
          <span className={`text-[10px] font-medium ${mobileMenuOpen ? 'text-[#1054A0]' : 'text-gray-500'}`}>Menu</span>
        </button>
      </div>

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-[72px] right-4 z-40">
        <button
          onClick={() => setNewMenu(!newMenu)}
          className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-[#1054A0] to-[#2563EB] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
        >
          <Plus size={24} />
        </button>
        {newMenu && (
          <div className="absolute bottom-full right-0 mb-3 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 fade-in overflow-hidden">
            <button onClick={() => { setShowNewFolder(true); setNewMenu(false) }} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <FolderPlus size={18} className="text-amber-500" />New folder
            </button>
            <div className="h-px bg-gray-100 my-0.5" />
            <button onClick={() => { setNewMenu(false); fileInputRef.current?.click() }} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <Upload size={18} className="text-blue-500" />File upload
            </button>
            <button onClick={() => { setNewMenu(false); folderInputRef.current?.click() }} className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <CloudUpload size={18} className="text-blue-500" />Folder upload
            </button>
          </div>
        )}
      </div>

      {/* Mobile Menu Bottom Sheet */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm fade-in" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-white rounded-t-3xl p-6 slide-up w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Account & Storage</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            {/* Storage (copied from sidebar) */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">Storage Used</span>
                <span className="text-xs font-medium text-gray-500">{fmtBytes(USED_BYTES)} of {fmtBytes(QUOTA)}</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(USED_BYTES / QUOTA) * 100}%`,
                    background: 'linear-gradient(90deg, #1054A0, #3B82F6)'
                  }}
                />
              </div>
            </div>

            {/* User Details */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
                {(user?.name?.substring(0,2).toUpperCase() || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-gray-900 truncate">{(user?.name || 'User')}</p>
                <p className="text-sm text-blue-600 truncate">{(user?.email || '')}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button onClick={() => { setMobileMenuOpen(false); setProfileOpen(true); }} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <User size={18} className="text-[#1054A0]" /> Account Settings
              </button>
              {user?.role === 'admin' && (
                <button onClick={() => { setMobileMenuOpen(false); window.location.href = '/admin'; }} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-100 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Shield size={18} className="text-[#1054A0]" /> Admin Panel
                </button>
              )}
              <div className="h-px bg-gray-100 my-1" />
              <button onClick={() => { setMobileMenuOpen(false); logout(); }} className="flex items-center gap-3 px-4 py-3.5 bg-red-50 border border-red-100 rounded-xl text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
                <LogOut size={18} className="text-red-500" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── File Grid ────────────────────────────────────────────────────────────────
function FileGrid({ items, selected, section, onSelect, onOpen, onCtx, onStar, onShare }: {
  items: DriveItem[]; selected: Set<string>; section: NavSection
  onSelect: (s: Set<string>) => void; onOpen: (item: DriveItem) => void
  onCtx: (e: React.MouseEvent, id: string) => void; onStar: (id: string) => void
  onShare: (item: DriveItem) => void;
}) {
  const folders = items.filter(i => i.type === 'folder')
  const files = items.filter(i => i.type !== 'folder')

  const renderItemCard = (item: DriveItem) => {
    const isSelected = selected.has(item.id)
    const isImg = item.type === 'image' && item.thumbnailUrl
    return (
      <div
        key={item.id}
        onContextMenu={e => onCtx(e, item.id)}
        onClick={e => {
          e.stopPropagation();
          if (e.ctrlKey || e.metaKey) {
            const s = new Set(selected);
            if (s.has(item.id)) s.delete(item.id);
            else s.add(item.id);
            onSelect(s);
          } else {
            onSelect(new Set([item.id]));
          }
        }}
        onDoubleClick={e => { e.stopPropagation(); onOpen(item); }}
        className={`group relative rounded-2xl border cursor-pointer transition-all select-none ${isSelected ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}
      >
        {/* Thumbnail or icon area */}
        <div className={`rounded-t-2xl overflow-hidden flex items-center justify-center ${isImg ? 'h-36' : 'h-28 bg-gray-50/60'}`} style={!isImg ? { background: COLORS[item.type] + '0d' } : {}}>
          {isImg ? (
            <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : item.type === 'folder' ? (
            <Folder size={40} color={COLORS.folder} strokeWidth={1.5} />
          ) : (
            <FIcon type={item.type} size={36} />
          )}
        </div>

        {/* Info */}
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-start justify-between gap-1">
            <p className="text-sm font-medium text-gray-800 truncate leading-tight flex-1">{item.name}</p>
            <button onClick={e => { e.stopPropagation(); onCtx(e, item.id); }} className="md:hidden p-1 -mt-1 -mr-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0">
              <MoreVertical size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {item.starred && <Star size={10} fill="#F59E0B" color="#F59E0B" />}
            {item.shareLink && <Globe size={10} className="text-blue-400" />}
            {item.sharedWith.length > 0 && <Users size={10} className="text-gray-400" />}
            <span className="text-xs text-gray-400">{fmtDate(item.modified)}</span>
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {section !== 'trash' && (
            <>
              <button onClick={e => { e.stopPropagation(); onStar(item.id) }} className={`p-1.5 rounded-lg backdrop-blur-sm transition-colors ${item.starred ? 'bg-amber-50/90 text-amber-500' : 'bg-white/90 text-gray-400 hover:text-amber-500'}`}>
                <Star size={12} fill={item.starred ? '#F59E0B' : 'none'} />
              </button>
              <button onClick={e => { e.stopPropagation(); onShare(item) }} className="p-1.5 rounded-lg bg-white/90 text-gray-400 hover:text-blue-500 backdrop-blur-sm transition-colors">
                <Share2 size={12} />
              </button>
            </>
          )}
        </div>

        {/* Selected check */}
        {isSelected && (
          <div className="absolute top-2 left-2 w-5 h-5 bg-[#1054A0] rounded-full flex items-center justify-center">
            <Check size={11} color="white" strokeWidth={3} />
          </div>
        )}

        {/* Shared avatars */}
        {item.sharedWith.length > 0 && (
          <div className="absolute bottom-9 left-3 flex -space-x-1.5">
            {item.sharedWith.slice(0, 3).map(u => (
              <div key={u.id} style={{ background: u.color, width: 18, height: 18, fontSize: 8 }} className="rounded-full border border-white flex items-center justify-center text-white font-semibold">
                {u.initials[0]}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in">
      {folders.length > 0 && (
        <div className="mb-5">
          {files.length > 0 && <h4 className="text-xs font-medium text-gray-400 mb-2.5 uppercase tracking-wide">Folders</h4>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {folders.map(item => renderItemCard(item))}
          </div>
        </div>
      )}
      {files.length > 0 && (
        <div>
          {folders.length > 0 && <h4 className="text-xs font-medium text-gray-400 mb-2.5 uppercase tracking-wide">Files</h4>}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {files.map(item => renderItemCard(item))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── File List ────────────────────────────────────────────────────────────────
function FileList({ items, selected, section, onSelect, onOpen, onCtx, onStar, onShare, onTrash }: {
  items: DriveItem[]; selected: Set<string>; section: NavSection
  onSelect: (s: Set<string>) => void; onOpen: (item: DriveItem) => void
  onCtx: (e: React.MouseEvent, id: string) => void; onStar: (id: string) => void
  onShare: (item: DriveItem) => void; onTrash: (id: string) => void
}) {
  const user = useAuthStore(s => s.user)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden fade-in">
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_80px] md:grid-cols-[minmax(0,1fr)_120px_120px_80px] gap-3 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Name</span>
        <span className="hidden md:block text-xs font-medium text-gray-400 uppercase tracking-wide">Owner</span>
        <span className="hidden md:block text-xs font-medium text-gray-400 uppercase tracking-wide">Modified</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Size</span>
      </div>
      {items.map((item, i) => {
        const isSelected = selected.has(item.id)
        const ownerName = item.owner === user?.id ? user?.name : 'Unknown'
        return (
          <div
            key={item.id}
            onContextMenu={e => onCtx(e, item.id)}
            onClick={e => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                const s = new Set(selected);
                if (s.has(item.id)) s.delete(item.id);
                else s.add(item.id);
                onSelect(s);
              } else {
                onSelect(new Set([item.id]));
              }
            }}
            onDoubleClick={e => { e.stopPropagation(); onOpen(item); }}
            className={`group grid grid-cols-[minmax(0,1fr)_80px] md:grid-cols-[minmax(0,1fr)_160px_120px_100px] gap-3 px-4 py-2.5 items-center cursor-pointer transition-colors select-none ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} ${i < items.length - 1 ? 'border-b border-gray-50' : ''}`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="flex-shrink-0">
                {item.type === 'image' && item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="w-7 h-7 rounded object-cover" />
                ) : (
                  <FIcon type={item.type} size={18} />
                )}
              </div>
              <span className="text-sm text-gray-800 truncate font-medium">{item.name}</span>
              {item.starred && <Star size={11} fill="#F59E0B" color="#F59E0B" className="flex-shrink-0" />}
              {item.sharedWith.length > 0 && <Users size={11} className="flex-shrink-0 text-gray-400" />}
              {item.shareLink && <Globe size={11} className="flex-shrink-0 text-blue-400" />}
              {/* Row actions */}
              {section !== 'trash' && (
                <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); onStar(item.id) }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-amber-500 transition-colors">
                    <Star size={13} fill={item.starred ? '#F59E0B' : 'none'} color={item.starred ? '#F59E0B' : undefined} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onShare(item) }} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors">
                    <Share2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); onTrash(item.id) }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>

            <span className="hidden md:block text-xs text-gray-500 truncate">{ownerName === (user?.name || 'User') ? 'me' : ownerName}</span>
            <span className="hidden md:block text-xs text-gray-500">{fmtDate(item.modified)}</span>
            <div className="text-xs text-gray-500 flex items-center justify-end gap-2">
              <span className="text-right">{item.type === 'folder' ? '—' : fmtBytes(item.size)}</span>
              <button
                onClick={e => { e.stopPropagation(); onCtx(e, item.id); }}
                className="md:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-200 transition-colors"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}


function ProfileModal({ user, onClose, onUpdated }: any) {
  const [name, setName] = useState(user?.name || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'profile'|'sessions'>('profile');
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === 'sessions' && user.role !== 'admin') {
      getSessions().then(setSessions).catch(console.error);
    }
  }, [activeTab, user.role]);

  const handleRevoke = async (id: string) => {
    try {
      await revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } catch (err) {
      alert('Failed to revoke session');
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const updated = await updateProfile(name, oldPassword, newPassword);
      onUpdated(updated);
      onClose();
      alert('Profile updated successfully');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
            <X size={18} />
          </button>
        </div>
        
        {user.role !== 'admin' && (
          <div className="px-6 flex gap-4 border-b border-gray-100">
            <button onClick={() => setActiveTab('profile')} className={`py-3 text-sm font-medium border-b-2 ${activeTab === 'profile' ? 'border-[#1054A0] text-[#1054A0]' : 'border-transparent text-gray-500'}`}>Profile</button>
            <button onClick={() => setActiveTab('sessions')} className={`py-3 text-sm font-medium border-b-2 ${activeTab === 'sessions' ? 'border-[#1054A0] text-[#1054A0]' : 'border-transparent text-gray-500'}`}>Active Sessions</button>
          </div>
        )}

        {activeTab === 'profile' ? (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0] transition-colors"
                  required
                />
              </div>
              
              <div className="pt-2">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Change Password (Optional)</h3>
                <div className="space-y-3">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0] transition-colors"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0a4080] transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
             {sessions.length === 0 ? (
               <p className="text-center text-gray-500 text-sm">No active sessions found.</p>
             ) : sessions.map(s => (
               <div key={s.id} className="p-4 border border-gray-200 rounded-xl flex items-center justify-between">
                 <div>
                   <p className="text-sm font-medium text-gray-900 break-all">{s.device}</p>
                   <p className="text-xs text-gray-500 mt-1">{s.ipAddress} &bull; {s.location}</p>
                   <p className="text-xs text-gray-400 mt-1">Last active: {new Date(s.lastActive).toLocaleString()}</p>
                 </div>
                 <button onClick={() => handleRevoke(s.id)} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium rounded-lg transition-colors ml-4 shrink-0">Revoke</button>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
