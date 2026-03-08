/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { 
  FileText, Search, Download, File, Image as ImageIcon, 
  Video, FileArchive, FileSpreadsheet, FileAudio, Folder, 
  ArrowRight, X, ZoomIn, ZoomOut, RotateCw, Lock, Unlock, Settings, Users, ShieldAlert, Plus, Minus, Copy, Trash2, ArrowUp, ArrowDown, CheckCircle, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime: string;
  iconLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  isLocked?: boolean;
  cost?: number;
  unlocked?: boolean;
}

interface FolderPath {
  id: string | null; // null means root
  name: string;
}

interface UserInfo {
  name: string;
  email: string;
  picture: string;
  points: number;
  isAdmin: boolean;
}

function NumberInput({ value, onChange, className }: { value: number, onChange: (val: number) => void, className?: string }) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleBlur = () => {
    const parsed = parseInt(localValue);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    } else {
      setLocalValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input 
      type="number" 
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
}

function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState('');
  const [newFolderCost, setNewFolderCost] = useState('');
  
  const [userSearch, setUserSearch] = useState('');
  const [folderSearch, setFolderSearch] = useState('');

  const [sortField, setSortField] = useState<'name' | 'email' | 'points'>('points');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, foldersRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/folders')
      ]);
      if (!usersRes.ok || !foldersRes.ok) throw new Error('Failed to fetch admin data');
      setUsers(await usersRes.json());
      setFolders(await foldersRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePoints = async (email: string, points: number) => {
    try {
      const res = await fetch('/api/admin/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, points })
      });
      if (!res.ok) throw new Error('Failed to update points');
      fetchData();
      showToast('Points updated successfully');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const bulkAddPoints = async () => {
    const pointsStr = prompt('Enter points to add to ALL users (can be negative):', '10');
    if (!pointsStr) return;
    const points = parseInt(pointsStr);
    if (isNaN(points)) return showToast('Invalid number', 'error');

    try {
      const res = await fetch('/api/admin/points/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, action: 'add' })
      });
      if (!res.ok) throw new Error('Failed to add points');
      fetchData();
      showToast(`Added ${points} points to all users`);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const deleteUser = async (email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete user');
      fetchData();
      showToast('User deleted successfully');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const updateFolder = async (folderId: string, cost: number | null) => {
    try {
      const res = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId, cost })
      });
      if (!res.ok) throw new Error('Failed to update folder');
      setNewFolderId('');
      setNewFolderCost('');
      fetchData();
      showToast(cost === null ? 'Folder lock removed' : 'Folder lock added');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSort = (field: 'name' | 'email' | 'points') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'points' ? 'desc' : 'asc');
    }
  };

  const filteredUsers = users
    .filter(u => 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(userSearch.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'points') {
        comparison = a.points - b.points;
      } else {
        comparison = a[sortField].localeCompare(b[sortField]);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const filteredFolders = folders.filter(f => 
    f.id.toLowerCase().includes(folderSearch.toLowerCase())
  );

  const totalPoints = users.reduce((acc, u) => acc + u.points, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex-1 flex flex-col max-w-5xl w-full overflow-y-auto custom-scrollbar pr-4 -mr-4 pb-10 relative"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border font-mono text-xs uppercase tracking-widest ${
              toast.type === 'success' ? 'bg-white border-[var(--color-my-blue)]/20 text-[var(--color-my-blue)]' : 'bg-white border-[var(--color-my-red)]/20 text-[var(--color-my-red)]'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-8">
        <h1 className="font-serif text-4xl md:text-5xl tracking-tight text-[var(--color-my-blue)] font-medium mb-3">Admin Panel</h1>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-my-ink)]/50">Manage Users & Access Control</p>
      </header>

      <div className="flex flex-col gap-10">
        {loading ? (
          <div className="font-mono text-xs uppercase tracking-widest animate-pulse py-10 text-[var(--color-my-ink)]/50">Loading admin data...</div>
        ) : error ? (
          <div className="text-[var(--color-my-red)] font-mono text-xs uppercase tracking-widest py-10 bg-[var(--color-my-red)]/5 px-6 rounded-xl border border-[var(--color-my-red)]/10">Error: {error}</div>
        ) : (
          <>
            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 flex flex-col gap-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/50 flex items-center gap-2"><Users size={14} /> Total Users</div>
                <div className="font-serif text-3xl text-[var(--color-my-blue)]">{users.length}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 flex flex-col gap-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/50 flex items-center gap-2"><Plus size={14} /> Total Points</div>
                <div className="font-serif text-3xl text-[var(--color-my-blue)]">{totalPoints}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 flex flex-col gap-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/50 flex items-center gap-2"><Lock size={14} /> Locked Folders</div>
                <div className="font-serif text-3xl text-[var(--color-my-blue)]">{folders.length}</div>
              </div>
            </div>

            {/* Users Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="font-serif text-2xl flex items-center gap-3 text-[var(--color-my-ink)]"><Users size={24} className="text-[var(--color-my-blue)]" /> Users & Points</h3>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button onClick={bulkAddPoints} className="shrink-0 bg-white border border-[var(--color-my-ink)]/10 text-[var(--color-my-ink)]/70 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--color-my-ink)]/[0.02] hover:text-[var(--color-my-ink)] transition-colors flex items-center gap-2">
                    <Plus size={14} /> Bulk Add Points
                  </button>
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-my-ink)]/40" />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-[var(--color-my-ink)]/10 rounded-lg font-mono text-xs focus:outline-none focus:border-[var(--color-my-blue)] focus:ring-1 focus:ring-[var(--color-my-blue)] transition-all"
                    />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-5 border-b border-[var(--color-my-ink)]/5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/50 bg-[var(--color-my-ink)]/5">
                  <div className="col-span-3 cursor-pointer hover:text-[var(--color-my-ink)] flex items-center gap-1" onClick={() => handleSort('name')}>
                    User {sortField === 'name' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                  <div className="col-span-4 cursor-pointer hover:text-[var(--color-my-ink)] flex items-center gap-1" onClick={() => handleSort('email')}>
                    Email {sortField === 'email' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                  <div className="col-span-4 text-right cursor-pointer hover:text-[var(--color-my-ink)] flex items-center justify-end gap-1" onClick={() => handleSort('points')}>
                    {sortField === 'points' && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)} Points
                  </div>
                  <div className="col-span-1 text-right"></div>
                </div>
                {filteredUsers.map(u => (
                  <div key={u.email} className="grid grid-cols-12 gap-4 p-5 border-b border-[var(--color-my-ink)]/5 items-center hover:bg-[var(--color-my-ink)]/[0.02] transition-colors">
                    <div className="col-span-3 font-serif text-base truncate">{u.name}</div>
                    <div className="col-span-4 font-mono text-[11px] truncate text-[var(--color-my-ink)]/60">{u.email}</div>
                    <div className="col-span-4 flex items-center justify-end gap-2 sm:gap-4">
                      <button onClick={() => updatePoints(u.email, Math.max(0, u.points - 10))} className="p-1.5 hover:bg-[var(--color-my-ink)]/10 rounded-md text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-ink)] transition-colors"><Minus size={14} /></button>
                      <NumberInput 
                        value={u.points}
                        onChange={(val) => updatePoints(u.email, val)}
                        className="font-mono text-sm font-bold w-16 text-center text-[var(--color-my-blue)] bg-transparent border-b border-transparent hover:border-[var(--color-my-ink)]/20 focus:border-[var(--color-my-blue)] focus:outline-none transition-colors"
                      />
                      <button onClick={() => updatePoints(u.email, u.points + 10)} className="p-1.5 hover:bg-[var(--color-my-ink)]/10 rounded-md text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-ink)] transition-colors"><Plus size={14} /></button>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => deleteUser(u.email)} className="p-1.5 hover:bg-[var(--color-my-red)]/10 rounded-md text-[var(--color-my-ink)]/40 hover:text-[var(--color-my-red)] transition-colors" title="Delete User">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && <div className="p-8 text-center font-mono text-xs text-[var(--color-my-ink)]/40 uppercase tracking-widest">No users found</div>}
              </div>
            </section>

            {/* Folders Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="font-serif text-2xl flex items-center gap-3 text-[var(--color-my-ink)]"><Lock size={24} className="text-[var(--color-my-blue)]" /> Locked Folders</h3>
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-my-ink)]/40" />
                  <input 
                    type="text" 
                    placeholder="Search folders..." 
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-[var(--color-my-ink)]/10 rounded-lg font-mono text-xs focus:outline-none focus:border-[var(--color-my-blue)] focus:ring-1 focus:ring-[var(--color-my-blue)] transition-all"
                  />
                </div>
              </div>
              
              <form 
                onSubmit={(e) => { e.preventDefault(); updateFolder(newFolderId, parseInt(newFolderCost)); }}
                className="flex flex-col sm:flex-row gap-4 items-end bg-white p-6 rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 mb-6"
              >
                <div className="flex-1 w-full">
                  <label className="block font-mono text-[10px] uppercase tracking-widest mb-2 text-[var(--color-my-ink)]/60">Folder ID</label>
                  <input type="text" value={newFolderId} onChange={e => setNewFolderId(e.target.value)} required className="w-full border border-[var(--color-my-ink)]/10 rounded-lg px-4 py-3 font-mono text-xs focus:outline-none focus:border-[var(--color-my-blue)] focus:ring-1 focus:ring-[var(--color-my-blue)] transition-all bg-[var(--color-my-ink)]/[0.02]" placeholder="e.g. 1A2b3C..." />
                </div>
                <div className="w-full sm:w-40">
                  <label className="block font-mono text-[10px] uppercase tracking-widest mb-2 text-[var(--color-my-ink)]/60">Cost (Points)</label>
                  <input type="number" value={newFolderCost} onChange={e => setNewFolderCost(e.target.value)} required min="0" className="w-full border border-[var(--color-my-ink)]/10 rounded-lg px-4 py-3 font-mono text-xs focus:outline-none focus:border-[var(--color-my-blue)] focus:ring-1 focus:ring-[var(--color-my-blue)] transition-all bg-[var(--color-my-ink)]/[0.02]" placeholder="e.g. 50" />
                </div>
                <button type="submit" className="w-full sm:w-auto bg-[var(--color-my-blue)] text-white px-8 py-3 rounded-lg font-mono text-xs uppercase tracking-widest hover:bg-[#001854] transition-colors h-[42px] flex items-center justify-center">
                  Add Lock
                </button>
              </form>

              <div className="bg-white rounded-2xl shadow-sm border border-[var(--color-my-ink)]/5 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 p-5 border-b border-[var(--color-my-ink)]/5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/50 bg-[var(--color-my-ink)]/5">
                  <div className="col-span-8">Folder ID</div>
                  <div className="col-span-4 text-right">Cost (Points)</div>
                </div>
                {filteredFolders.map(f => (
                  <div key={f.id} className="grid grid-cols-12 gap-4 p-5 border-b border-[var(--color-my-ink)]/5 items-center hover:bg-[var(--color-my-ink)]/[0.02] transition-colors">
                    <div className="col-span-8 font-mono text-[11px] truncate text-[var(--color-my-ink)]/80">{f.id}</div>
                    <div className="col-span-4 flex items-center justify-end gap-4">
                      <NumberInput 
                        value={f.cost}
                        onChange={(val) => updateFolder(f.id, val)}
                        className="font-mono text-sm font-bold w-16 text-right text-[var(--color-my-blue)] bg-transparent border-b border-transparent hover:border-[var(--color-my-ink)]/20 focus:border-[var(--color-my-blue)] focus:outline-none transition-colors"
                      />
                      <button onClick={() => updateFolder(f.id, null)} className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-my-red)]/70 hover:text-[var(--color-my-red)] transition-colors">Remove</button>
                    </div>
                  </div>
                ))}
                {filteredFolders.length === 0 && <div className="p-8 text-center font-mono text-xs text-[var(--color-my-ink)]/40 uppercase tracking-widest">No locked folders found</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function App() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [path, setPath] = useState<FolderPath[]>([{ id: null, name: 'Archive' }]);
  const [error, setError] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfScale, setPdfScale] = useState(0.7);
  const [pdfRotation, setPdfRotation] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number, total?: number } | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  const [currentView, setCurrentView] = useState<'explorer' | 'admin'>('explorer');
  const [unlockingFolder, setUnlockingFolder] = useState<DriveFile | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const currentFolderId = path[path.length - 1].id;

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsLoggedIn(data.loggedIn);
      setUser(data.user || null);
    } catch (err) {
      console.error('Auth status error:', err);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuthStatus();
        setPath([{ id: null, name: 'Archive' }]);
        fetchFiles('', null, null);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    fetchFiles('', null, currentFolderId);
    setSelectedFiles(new Set());
  }, [currentFolderId]);

  const fetchFiles = async (query = '', pageToken: string | null = null, folderId: string | null = null) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/drive/files', window.location.origin);
      if (query) url.searchParams.append('q', query);
      if (pageToken) url.searchParams.append('pageToken', pageToken);
      if (folderId) url.searchParams.append('folderId', folderId);

      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }
      
      if (pageToken) {
        setFiles(prev => [...prev, ...(data.files || [])]);
      } else {
        setFiles(data.files || []);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    fetchFiles(searchQuery, null, currentFolderId);
  };

  const handleLogin = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const res = await fetch(`/api/auth/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      const data = await res.json();
      
      const authWindow = window.open(
        data.url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
      }
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setUser(null);
      setPath([{ id: null, name: 'Archive' }]);
      fetchFiles('', null, null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleDownload = (e: MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    window.open(`/api/drive/download/${file.id}`, '_blank');
  };

  const handleRowClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      if (file.isLocked && !file.unlocked) {
        setUnlockingFolder(file);
        setUnlockError(null);
        return;
      }
      setPath(prev => [...prev, { id: file.id, name: file.name }]);
      setSearchQuery('');
    } else {
      openPreview(file);
    }
  };

  const handleUnlock = async () => {
    if (!unlockingFolder) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch('/api/folder/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: unlockingFolder.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock');
      
      // Update user points
      setUser(prev => prev ? { ...prev, points: data.points } : prev);
      
      // Update file status
      setFiles(prev => prev.map(f => f.id === unlockingFolder.id ? { ...f, unlocked: true } : f));
      
      setUnlockingFolder(null);
      
      // Navigate to the folder
      setPath(prev => [...prev, { id: unlockingFolder.id, name: unlockingFolder.name }]);
      setSearchQuery('');
    } catch (err: any) {
      setUnlockError(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  const openPreview = async (file: DriveFile) => {
    setPreviewFile(file);
    setPreviewContent(null);
    setPreviewError(null);
    setNumPages(undefined);
    setPageNumber(1);
    setPdfScale(0.7);
    setPdfRotation(0);
    
    // Check if it's a text-like file
    if (file.mimeType.startsWith('text/') || 
        file.mimeType === 'application/json' || 
        file.mimeType === 'application/javascript' || 
        file.mimeType === 'application/xml') {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/drive/download/${file.id}`);
        if (!res.ok) throw new Error('Failed to load text content');
        const text = await res.text();
        setPreviewContent(text);
      } catch (err: any) {
        setPreviewError(err.message);
      } finally {
        setPreviewLoading(false);
      }
    } else if (file.mimeType === 'application/pdf') {
      setPreviewContent(`/api/drive/download/${file.id}?inline=true`);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewContent(null);
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const navigateToPath = (index: number) => {
    setPath(prev => prev.slice(0, index + 1));
    setSearchQuery('');
  };

  const formatSize = (bytes?: string | number) => {
    if (bytes === undefined || bytes === null || bytes === '') return '--';
    const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(size) || size === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={20} strokeWidth={1} />;
    if (mimeType.includes('image')) return <ImageIcon size={20} strokeWidth={1} />;
    if (mimeType.includes('video')) return <Video size={20} strokeWidth={1} />;
    if (mimeType.includes('audio')) return <FileAudio size={20} strokeWidth={1} />;
    if (mimeType.includes('pdf')) return <FileText size={20} strokeWidth={1} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return <FileSpreadsheet size={20} strokeWidth={1} />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return <FileArchive size={20} strokeWidth={1} />;
    return <File size={20} strokeWidth={1} />;
  };

  const toggleSelection = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.size === 0) return;
    setIsBatchDownloading(true);
    setDownloadProgress({ loaded: 0 });
    try {
      const res = await fetch('/api/drive/download-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles) })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download files');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Failed to start download stream');

      const contentLength = res.headers.get('Content-Length') || res.headers.get('X-Estimated-Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : undefined;

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          setDownloadProgress({ loaded: receivedLength, total });
        }
      }

      const blob = new Blob(chunks, { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'archive.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSelectedFiles(new Set());
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsBatchDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col md:flex-row bg-[var(--color-my-white)] text-[var(--color-my-ink)] selection:bg-[var(--color-my-blue)] selection:text-white">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-[var(--color-my-blue)] text-white p-4 flex items-center justify-between shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-my-yellow)] text-[var(--color-my-blue)] flex items-center justify-center font-serif font-bold text-xs">
            JD
          </div>
          <span className="font-mono text-[10px] tracking-widest uppercase">Explorer</span>
        </div>
        
        <div className="flex items-center gap-4">
          {user?.isAdmin && (
            <button onClick={() => setCurrentView(currentView === 'admin' ? 'explorer' : 'admin')} className="text-white/80 hover:text-white transition-colors">
              {currentView === 'admin' ? <Folder size={18} /> : <ShieldAlert size={18} />}
            </button>
          )}
          {isLoggedIn && user ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-[var(--color-my-yellow)]">{user.points} PTS</span>
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" onClick={handleLogout} />
            </div>
          ) : (
            <button onClick={handleLogin} className="font-mono text-[10px] uppercase tracking-widest text-white/80 hover:text-white transition-colors">
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Left Sidebar - Distinctive Editorial Element */}
      <aside className="w-64 bg-[var(--color-my-blue)] text-white flex flex-col shrink-0 hidden md:flex shadow-2xl z-20 relative">
        <div className="p-8 flex flex-col h-full">
          <div className="mb-12">
            <div className="w-12 h-12 rounded-full bg-[var(--color-my-yellow)] text-[var(--color-my-blue)] flex items-center justify-center font-serif font-bold text-xl shadow-md mb-6">
              JD
            </div>
            <div className="font-mono text-[10px] text-white/50 tracking-[0.2em] uppercase leading-relaxed">
              Google Drive<br/>Explorer
            </div>
          </div>

          <nav className="flex flex-col gap-6 flex-1">
            <button 
              onClick={() => setCurrentView('explorer')} 
              className={`flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest transition-colors ${currentView === 'explorer' ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
            >
              <Folder size={18} strokeWidth={1.5} />
              <span>Explorer</span>
            </button>
            
            {user?.isAdmin && (
              <button 
                onClick={() => setCurrentView('admin')} 
                className={`flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest transition-colors ${currentView === 'admin' ? 'text-white' : 'text-white/40 hover:text-white/80'}`}
              >
                <ShieldAlert size={18} strokeWidth={1.5} />
                <span>Admin Panel</span>
              </button>
            )}
          </nav>

          <div className="mt-auto pt-8 border-t border-white/10">
            {isLoggedIn && user ? (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full border border-white/20 shadow-sm" referrerPolicy="no-referrer" />
                  <div className="min-w-0">
                    <div className="font-serif text-sm text-white truncate">{user.name}</div>
                    <div className="font-mono text-[10px] text-[var(--color-my-yellow)] mt-0.5">{user.points} PTS</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-left font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-colors flex items-center gap-2">
                  <ArrowRight size={12} /> Sign Out
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 bg-white/10 text-white px-4 py-3 rounded-lg font-mono text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5">
                <Users size={14} /> Sign In
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 md:p-8 lg:p-10 overflow-hidden relative">
        {currentView === 'admin' ? (
          <AdminPanel />
        ) : (
          <>
            {/* Breadcrumbs */}
            <nav className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-[var(--color-my-ink)]/50 mb-4 sm:mb-6 flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
              {path.map((p, i) => (
                <span key={p.id || 'root'} className="flex items-center gap-2 whitespace-nowrap">
                  {i > 0 && <span>/</span>}
                  <button 
                    onClick={() => navigateToPath(i)} 
                    className={`hover:text-[var(--color-my-blue)] transition-colors ${i === path.length - 1 ? 'text-[var(--color-my-blue)] font-bold' : ''}`}
                  >
                    {p.name}
                  </button>
                </span>
              ))}
            </nav>

            {/* Massive Serif Header */}
            <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <motion.h1
                key={currentFolderId || 'root'}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-serif text-3xl sm:text-5xl md:text-6xl tracking-tight leading-[1.1] break-words text-[var(--color-my-blue)] font-medium"
              >
                {path[path.length - 1].name}
              </motion.h1>
            </header>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6 sm:mb-8 border-b-2 border-[var(--color-my-ink)]/10 pb-4 flex items-center gap-4 group focus-within:border-[var(--color-my-blue)] transition-colors">
          <Search size={18} className="text-[var(--color-my-ink)]/40 group-focus-within:text-[var(--color-my-blue)] transition-colors" />
          <input
            type="text"
            placeholder="Search archives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent font-serif text-lg sm:text-2xl italic placeholder:text-[var(--color-my-ink)]/20 focus:outline-none text-[var(--color-my-ink)]"
          />
        </form>

        {error ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[var(--color-my-red)]/10 text-[var(--color-my-red)] p-4 border border-[var(--color-my-red)]/20 mb-8 font-mono text-xs uppercase tracking-widest rounded-lg"
          >
            ERROR: {error}
          </motion.div>
        ) : null}

        {/* File List */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Action Bar */}
          <AnimatePresence>
            {selectedFiles.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 flex items-center justify-between bg-[var(--color-my-blue)] text-white px-5 py-3 rounded-xl shadow-lg border border-white/10"
              >
                <span className="font-mono text-xs uppercase tracking-widest">
                  {selectedFiles.size} selected
                </span>
                <button
                  onClick={handleBatchDownload}
                  disabled={isBatchDownloading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full font-mono text-[10px] uppercase tracking-widest transition-all ${
                    isBatchDownloading 
                      ? 'bg-[var(--color-my-yellow)] text-[var(--color-my-blue)] cursor-not-allowed font-bold' 
                      : 'bg-[var(--color-my-yellow)] text-[var(--color-my-blue)] hover:bg-white hover:text-[var(--color-my-blue)] font-bold'
                  }`}
                >
                  {isBatchDownloading ? (
                    <div className="flex items-center gap-3">
                      <span className={downloadProgress ? 'font-bold' : 'animate-pulse font-bold'}>
                        {downloadProgress?.total 
                          ? `Downloading... ${Math.round((downloadProgress.loaded / downloadProgress.total) * 100)}%` 
                          : downloadProgress 
                            ? `Downloading... ${formatSize(downloadProgress.loaded)}` 
                            : 'Packaging...'}
                      </span>
                      {downloadProgress?.total && (
                        <div className="w-20 h-1.5 bg-black/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.round((downloadProgress.loaded / downloadProgress.total) * 100))}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Download ZIP</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header Row */}
          <div className="data-row pb-3 mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-my-ink)]/40 border-b border-[var(--color-my-ink)]/10">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={files.length > 0 && selectedFiles.size === files.length}
                onChange={toggleSelectAll}
                className="custom-checkbox"
              />
            </div>
            <div>TYPE</div>
            <div>TITLE</div>
            <div className="hide-mobile">DATE</div>
            <div className="hide-mobile">SIZE</div>
            <div className="text-right">ACTION</div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-10 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {files.map((file, i) => {
              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  onClick={() => handleRowClick(file)}
                  className={`group data-row py-3 sm:py-4 cursor-pointer rounded-lg px-2 -mx-2 ${selectedFiles.has(file.id) ? 'bg-white shadow-sm border border-[var(--color-my-ink)]/5' : ''}`}
                >
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={(e) => toggleSelection(e as any, file.id)}
                      className="custom-checkbox"
                    />
                  </div>
                  <div className="text-[var(--color-my-ink)]/40 group-hover:text-[var(--color-my-red)] transition-colors">
                    {getFileIcon(file.mimeType)}
                  </div>
                  
                  <div className={`font-serif text-lg sm:text-xl font-medium line-clamp-2 break-words pr-2 sm:pr-6 transition-all duration-300 flex items-center gap-2 ${isFolder ? 'group-hover:text-[var(--color-my-blue)]' : ''}`}>
                    {file.name}
                    {file.isLocked && (
                      <span className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${file.unlocked ? 'border-[var(--color-my-blue)] text-[var(--color-my-blue)]' : 'border-[var(--color-my-red)] text-[var(--color-my-red)]'}`}>
                        {file.unlocked ? <Unlock size={10} /> : <Lock size={10} />}
                        {file.unlocked ? 'Unlocked' : `${file.cost} PTS`}
                      </span>
                    )}
                    {user?.isAdmin && isFolder && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(file.id);
                          // Could add a small toast here, but simple alert is fine for admin
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--color-my-ink)]/10 rounded text-[var(--color-my-ink)]/40 hover:text-[var(--color-my-blue)] transition-all"
                        title="Copy Folder ID"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
                  
                  <div className="hide-mobile font-mono text-[11px] text-[var(--color-my-ink)]/50">
                    {format(new Date(file.modifiedTime), 'MMM dd, yyyy')}
                  </div>
                  
                  <div className="hide-mobile font-mono text-[11px] text-[var(--color-my-ink)]/50">
                    {formatSize(file.size)}
                  </div>
                  
                  <div className="text-right flex justify-end">
                    {!isFolder ? (
                      <button
                        onClick={(e) => handleDownload(e, file)}
                        className="flex items-center justify-center gap-2 bg-transparent border border-[var(--color-my-ink)]/20 text-[var(--color-my-ink)] rounded-full px-4 py-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-widest hover:bg-[var(--color-my-blue)] hover:text-white hover:border-[var(--color-my-blue)] transition-all shadow-sm"
                      >
                        <Download size={14} />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    ) : (
                      <button className={`flex items-center justify-center gap-2 border border-[var(--color-my-ink)]/20 text-[var(--color-my-ink)] rounded-full px-4 py-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-widest transition-colors ${file.isLocked && !file.unlocked ? 'group-hover:border-[var(--color-my-red)] group-hover:text-[var(--color-my-red)]' : 'group-hover:border-[var(--color-my-blue)] group-hover:text-[var(--color-my-blue)]'}`}>
                        <span className="hidden sm:inline">{file.isLocked && !file.unlocked ? 'Unlock' : 'Open'}</span>
                        {file.isLocked && !file.unlocked ? <Lock size={14} /> : <ArrowRight size={14} />}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {files.length === 0 && !loading && !error && (
            <div className="py-24 text-center border-b border-[var(--color-my-ink)]/10">
              <div className="flex flex-col items-center justify-center text-[var(--color-my-ink)]/30">
                <Folder size={48} strokeWidth={0.5} className="mb-6" />
                <p className="font-serif italic text-2xl text-[var(--color-my-ink)]/50">Empty Archive</p>
                <p className="font-mono text-[11px] mt-4 uppercase tracking-widest">No files found here</p>
              </div>
            </div>
          )}
          
          {loading && (
            <div className="py-16 flex justify-center border-b border-[var(--color-my-ink)]/10">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-my-ink)]/50 animate-pulse">
                Retrieving records...
              </div>
            </div>
          )}
          
          {nextPageToken && !loading && (
            <div className="py-12 flex justify-center">
              <button
                onClick={() => fetchFiles(searchQuery, nextPageToken, currentFolderId)}
                className="px-6 py-2.5 text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-my-ink)] border border-[var(--color-my-ink)]/20 hover:bg-[var(--color-my-blue)] hover:text-white hover:border-[var(--color-my-blue)] rounded-full transition-all"
              >
                Load More
              </button>
            </div>
          )}
          </div>
          </div>
          </>
        )}
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-my-ink)]/90 backdrop-blur-sm"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-my-white)] w-full h-full shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3 sm:p-6 border-b border-[var(--color-my-ink)]/10 shrink-0 bg-white">
                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                  <div className="text-[var(--color-my-blue)] shrink-0">
                    {getFileIcon(previewFile.mimeType)}
                  </div>
                  <h2 className="font-serif text-base sm:text-2xl font-medium line-clamp-2 break-words pr-2 sm:pr-4 text-[var(--color-my-ink)]">{previewFile.name}</h2>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {previewFile.mimeType === 'application/pdf' && (
                    <>
                      <button
                        onClick={() => setPdfScale(prev => Math.max(0.5, prev - 0.25))}
                        className="p-1.5 sm:p-2 hover:bg-[var(--color-my-ink)]/5 rounded-full transition-colors text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-blue)]"
                        title="Zoom Out"
                      >
                        <ZoomOut size={18} className="sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={() => setPdfScale(prev => Math.min(3, prev + 0.25))}
                        className="p-1.5 sm:p-2 hover:bg-[var(--color-my-ink)]/5 rounded-full transition-colors text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-blue)]"
                        title="Zoom In"
                      >
                        <ZoomIn size={18} className="sm:w-5 sm:h-5" />
                      </button>
                      <button
                        onClick={() => setPdfRotation(prev => (prev + 90) % 360)}
                        className="p-1.5 sm:p-2 hover:bg-[var(--color-my-ink)]/5 rounded-full transition-colors text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-blue)]"
                        title="Rotate"
                      >
                        <RotateCw size={18} className="sm:w-5 sm:h-5" />
                      </button>
                      <div className="w-px h-4 sm:h-6 bg-[var(--color-my-ink)]/20 mx-0.5 sm:mx-1"></div>
                    </>
                  )}
                  <button
                    onClick={(e) => handleDownload(e, previewFile)}
                    className="p-1.5 sm:p-2 hover:bg-[var(--color-my-ink)]/5 rounded-full transition-colors text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-blue)]"
                    title="Download"
                  >
                    <Download size={18} className="sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={closePreview}
                    className="p-1.5 sm:p-2 hover:bg-[var(--color-my-ink)]/5 rounded-full transition-colors text-[var(--color-my-ink)]/60 hover:text-[var(--color-my-red)]"
                    title="Close"
                  >
                    <X size={18} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[var(--color-my-white)]">
                {previewFile.mimeType.startsWith('image/') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={`/api/drive/download/${previewFile.id}?inline=true`} 
                      alt={previewFile.name}
                      className="max-w-full max-h-full object-contain shadow-xl rounded-lg"
                    />
                  </div>
                ) : previewFile.mimeType === 'application/pdf' ? (
                  previewContent ? (
                    <div className="w-full flex flex-col items-center py-4">
                      <Document
                        file={previewContent}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="font-mono text-xs uppercase tracking-widest animate-pulse text-[var(--color-my-ink)]/50 my-10">Loading PDF...</div>}
                        error={<div className="text-[var(--color-my-red)] font-mono text-xs uppercase tracking-widest my-10">Error loading PDF</div>}
                        className="flex flex-col items-center gap-4"
                      >
                        {Array.from(new Array(numPages || 0), (el, index) => (
                          <div key={`page_${index + 1}`} className="shadow-2xl bg-white mb-4 rounded-sm overflow-hidden">
                            <Page
                              pageNumber={index + 1}
                              renderTextLayer={true}
                              renderAnnotationLayer={true}
                              scale={pdfScale}
                              rotate={pdfRotation}
                              width={Math.min(window.innerWidth * 0.95, 1200)}
                            />
                          </div>
                        ))}
                      </Document>
                    </div>
                  ) : null
                ) : previewFile.mimeType.startsWith('text/') || 
                    previewFile.mimeType === 'application/json' || 
                    previewFile.mimeType === 'application/javascript' || 
                    previewFile.mimeType === 'application/xml' ? (
                  previewLoading ? (
                    <div className="w-full h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest animate-pulse text-[var(--color-my-ink)]/50">Loading text...</div>
                  ) : previewError ? (
                    <div className="w-full h-full flex items-center justify-center text-[var(--color-my-red)] font-mono text-xs uppercase tracking-widest">Error: {previewError}</div>
                  ) : (
                    <div className="w-full h-full bg-white p-6 rounded-xl shadow-sm overflow-auto border border-[var(--color-my-ink)]/5">
                      <pre className="font-mono text-xs sm:text-sm whitespace-pre-wrap break-words text-[var(--color-my-ink)]">
                        {previewContent}
                      </pre>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-[var(--color-my-ink)]/50">
                    <File size={48} strokeWidth={1} className="text-[var(--color-my-blue)]/50" />
                    <p className="font-serif italic text-xl">Preview not available</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest">Please download to view this file</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unlock Modal */}
      <AnimatePresence>
        {unlockingFolder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-my-ink)]/90 backdrop-blur-sm p-4"
            onClick={() => setUnlockingFolder(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-my-white)] w-full max-w-md shadow-2xl flex flex-col overflow-hidden rounded-2xl"
            >
              <div className="p-8 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[var(--color-my-red)]/10 text-[var(--color-my-red)] rounded-full flex items-center justify-center mb-6">
                  <Lock size={32} />
                </div>
                <h2 className="font-serif text-3xl font-medium text-[var(--color-my-ink)] mb-2">Locked Folder</h2>
                <p className="font-serif text-lg text-[var(--color-my-ink)]/60 mb-8">"{unlockingFolder.name}"</p>
                
                <div className="bg-white w-full p-6 rounded-xl border border-[var(--color-my-ink)]/10 mb-8 shadow-sm">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-[var(--color-my-ink)]/10">
                    <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-my-ink)]/50">Required</span>
                    <span className="font-mono text-lg font-bold text-[var(--color-my-red)]">{unlockingFolder.cost} PTS</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-my-ink)]/50">Your Balance</span>
                    <span className="font-mono text-lg font-bold text-[var(--color-my-blue)]">{user?.points || 0} PTS</span>
                  </div>
                </div>

                {unlockError && (
                  <div className="w-full bg-[var(--color-my-red)]/10 text-[var(--color-my-red)] p-3 rounded text-xs font-mono mb-6">
                    {unlockError}
                  </div>
                )}

                <div className="flex gap-4 w-full">
                  <button 
                    onClick={() => setUnlockingFolder(null)}
                    className="flex-1 py-3 rounded-full font-mono text-xs uppercase tracking-widest border border-[var(--color-my-ink)]/20 hover:bg-[var(--color-my-ink)]/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUnlock}
                    disabled={unlocking || !user || user.points < (unlockingFolder.cost || 0)}
                    className="flex-1 py-3 rounded-full font-mono text-xs uppercase tracking-widest bg-[var(--color-my-blue)] text-white hover:bg-[#001854] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {unlocking ? 'Unlocking...' : (
                      <>
                        <Unlock size={14} />
                        Unlock Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



