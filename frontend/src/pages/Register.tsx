import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ambaliLogo from '@/imports/ambalilogocrop-removebg-preview.png';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) {
      navigate('/drive');
    }
  }, [token, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');
      
      login(data.user, data.token);
      navigate('/drive');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden slide-up">
        <div className="px-8 pt-8 pb-6 text-center">
          <img src={ambaliLogo} alt="Ambali Drive" className="h-10 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Create an account</h2>
          <p className="text-sm text-gray-500 mt-2">Join Ambali Drive to manage your files</p>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1054A0]/30 focus:border-[#1054A0] bg-gray-50/50 transition-all"
                  placeholder="John Doe"
                  required
                />
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1054A0]/30 focus:border-[#1054A0] bg-gray-50/50 transition-all"
                  placeholder="name@ambali.io"
                  required
                />
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1054A0]/30 focus:border-[#1054A0] bg-gray-50/50 transition-all"
                  placeholder="••••••••"
                  required
                />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1054A0] text-white text-sm font-medium rounded-xl hover:bg-[#0D4A8A] transition-colors disabled:opacity-70"
            >
              <UserPlus size={16} />
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Already have an account? <span className="text-[#1054A0] font-medium cursor-pointer hover:underline" onClick={() => navigate('/login')}>Sign in</span>
          </p>
        </div>
      </div>
    </div>
  );
}
