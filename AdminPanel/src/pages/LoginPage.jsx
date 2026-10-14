import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const { login, verify2FA } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res?.requires2FA) {
        setTwoFactorData(res);
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verify2FA(twoFactorData.tempToken, otpCode);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  if (twoFactorData) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {error && (
            <div className="mb-4 w-full bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <img
            src={twoFactorData.qrCode}
            alt="Authenticator QR Code"
            className="w-56 h-56 border border-gray-200 rounded-2xl p-2 shadow-sm mb-6"
          />

          <form onSubmit={handleVerify2FA} className="w-full space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              required
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] text-3xl font-mono py-3 px-4 border-2 border-gray-300 rounded-xl outline-none focus:border-emerald-600 transition"
            />

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setTwoFactorData(null);
              setOtpCode('');
              setError('');
            }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 overflow-hidden relative">
      {/* Decorative blobs */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-4">
              <ShieldAlert className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight text-center">Superadmin Command</h1>
            <p className="text-slate-400 text-sm text-center mt-1">G-TRASH System Portal</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                  placeholder="admin@gtrash.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 text-white pl-12 pr-4 py-3.5 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>Access Command Center</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-8 font-medium">
          Authorized Personnel Only. Access is logged and monitored.
        </p>
      </div>
    </div>
  );
}
