import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Activity, Lock, Search, Ban, CheckCircle, Database, LogOut, Pencil } from 'lucide-react';
import { getAdminUsers, blockUser, getAdminLogs, getAdminStats, changeAdminPassword, updateUserQuota } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'settings'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/drive');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, lRes, sRes] = await Promise.all([
        getAdminUsers(),
        getAdminLogs(),
        getAdminStats()
      ]);
      setUsers(uRes);
      setLogs(lRes);
      setStats(sRes);
    } catch (error) {
      console.error(error);
      alert('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  
  const handleQuotaUpdate = async (id: string, currentQuota: number) => {
    const currentGB = currentQuota / (1024 ** 3);
    const newGBStr = prompt('Enter new storage quota in GB:', currentGB.toString());
    if (newGBStr === null) return; // Cancelled
    
    const newGB = parseFloat(newGBStr);
    if (isNaN(newGB) || newGB < 0) {
      alert('Invalid quota value. Please enter a positive number.');
      return;
    }
    
    const newBytes = newGB * (1024 ** 3);
    try {
      await updateUserQuota(id, newBytes);
      setUsers(users.map(u => u.id === id ? { ...u, storageQuota: newBytes } : u));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBlockToggle = async (id: string, currentlyBlocked: boolean) => {
    try {
      await blockUser(id, !currentlyBlocked);
      setUsers(users.map(u => u.id === id ? { ...u, isBlocked: !currentlyBlocked } : u));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Loading admin panel...</div>;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-64 flex-shrink-0 bg-[#1054A0] text-white p-4 md:p-6 flex flex-col gap-4 md:gap-8">
        <div className="flex items-center justify-between md:justify-start gap-3">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-white" />
            <h1 className="text-xl font-bold tracking-tight">Admin Shield</h1>
          </div>
        </div>
        
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto hide-scrollbar pb-2 md:pb-0">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'users' ? 'bg-white/15 font-semibold' : 'hover:bg-white/5 text-blue-100'}`}
          >
            <Users size={20} />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'logs' ? 'bg-white/15 font-semibold' : 'hover:bg-white/5 text-blue-100'}`}
          >
            <Activity size={20} />
            Audit Logs
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-xl transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === 'settings' ? 'bg-white/15 font-semibold' : 'hover:bg-white/5 text-blue-100'}`}
          >
            <Lock size={20} />
            Security Settings
          </button>

          <div className="md:hidden flex items-center gap-2 ml-4 pl-4 border-l border-white/10 flex-shrink-0">
            <button onClick={() => navigate('/drive')} className="text-sm font-medium text-blue-200 hover:text-white transition-colors whitespace-nowrap px-2">
              Back to Drive
            </button>
            <button onClick={() => useAuthStore.getState().logout()} className="p-2 bg-red-500/20 text-red-200 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </nav>
        
        <div className="hidden md:flex mt-auto pt-6 border-t border-white/10 flex-col gap-3">
          <button onClick={() => navigate('/drive')} className="text-sm text-left text-blue-200 hover:text-white transition-colors">
            &larr; Back to Drive
          </button>
          <button 
            onClick={() => useAuthStore.getState().logout()} 
            className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-lg text-sm font-medium text-red-200 hover:bg-red-500/20 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Logout Account
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-10">
        
        {/* Stats Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#1054A0]">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Users</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <Database size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Storage Used</p>
              <h3 className="text-2xl font-bold text-gray-900">{formatBytes(stats?.totalStorageUsed || 0)}</h3>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Files</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.totalFiles || 0}</h3>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden fade-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">User Management</h2>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search users..." className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0]" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                <tr className="bg-white border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Storage</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{u.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {formatBytes(u.storageUsed)} / {formatBytes(u.storageQuota)}
                      <button 
                        onClick={() => handleQuotaUpdate(u.id, u.storageQuota)}
                        className="ml-2 p-1 text-gray-400 hover:text-[#1054A0] transition-colors rounded hover:bg-blue-50"
                        title="Edit Quota"
                      >
                        <Pencil size={12} />
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      {u.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                          <Ban size={12} /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                          <CheckCircle size={12} /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.role !== 'admin' && (
                        <button 
                          onClick={() => handleBlockToggle(u.id, u.isBlocked)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${u.isBlocked ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                        >
                          {u.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden fade-in">
             <div className="p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-900">Audit Logs (Last 100 actions)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-white border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors text-sm">
                      <td className="px-6 py-4 text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{l.admin.email}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono">{l.action}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{l.ipAddress || 'Unknown'}</td>
                      <td className="px-6 py-4 text-gray-500">{l.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-[#1054A0]">
                  <Lock size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Change Admin Password</h2>
                  <p className="text-gray-500 text-sm mt-1">Ensure your admin account stays secure</p>
                </div>
              </div>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const oldPwd = (form.elements.namedItem('oldPassword') as HTMLInputElement).value;
                const newPwd = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
                try {
                  await changeAdminPassword(oldPwd, newPwd);
                  alert('Password changed successfully!');
                  form.reset();
                } catch (err: any) {
                  alert(err.message);
                }
              }} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input name="oldPassword" type="password" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0] transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input name="newPassword" type="password" required minLength={8} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1054A0]/20 focus:border-[#1054A0] transition-colors" />
                </div>
                <button type="submit" className="w-full py-3 px-4 bg-[#1054A0] hover:bg-[#0D4A8A] text-white font-medium rounded-xl transition-colors shadow-sm">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
