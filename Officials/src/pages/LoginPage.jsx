import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Shield,
  Star,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import ContactAdminModal from "../components/ContactAdminModal";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.error || "Login failed. Check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* ================= LEFT COLUMN: G-TRASH HERO & BRAND (Reference Left Half) ================= */}
      <div
        className="w-full lg:w-1/2 min-h-[420px] lg:min-h-screen relative flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white overflow-hidden"
        style={{
          background:
            "linear-gradient(rgba(10, 26, 20, 0.78), rgba(6, 44, 30, 0.88)), url('https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1920&q=80') center/cover no-repeat",
        }}
      >
        {/* Subtle Decorative Ambient Glow */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Spacer / Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-300/80 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15">
            Smart Waste Management
          </span>
          <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">
            Cebu City Command
          </span>
        </div>

        {/* Center Floating Content Block (Matching Reference Center Display) */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center text-center">
          {/* Brand Logo & Name */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md p-3 flex items-center justify-center border border-white/25 shadow-xl mb-3">
              <img src={logo} alt="G-TRASH Logo" className="w-10 h-10 object-contain drop-shadow" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              G-TRASH
            </h1>
            <p className="text-xs font-semibold text-emerald-300 tracking-wider uppercase mt-0.5">
              Officials Portal
            </p>
          </div>

          {/* Hero Headline */}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3 max-w-md">
            Your City, Clean &amp; Connected
          </h2>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed max-w-md mb-8 font-normal">
            Securely access collection routes, monitor truck fleets, and resolve community waste reports in one centralized dashboard.
          </p>

          {/* Frosted Glass Floating Cards (Side-by-side like reference) */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
              <Shield className="w-5 h-5 text-emerald-300 mb-2" />
              <span className="text-sm font-bold text-white tracking-wide">R.A. 10173</span>
              <span className="text-[11px] text-slate-300 font-medium">Compliant</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg transition-transform hover:scale-[1.02]">
              <Star className="w-5 h-5 text-amber-300 mb-2" />
              <span className="text-sm font-bold text-white tracking-wide">80+ LGUs</span>
              <span className="text-[11px] text-slate-300 font-medium">Cebu Barangays</span>
            </div>
          </div>
        </div>

        {/* Bottom Pinned Security Note */}
        <div className="relative z-10 flex items-center justify-center gap-2 text-xs text-slate-300/80 pt-4">
          <Lock className="w-3.5 h-3.5 text-emerald-300" />
          <span>Enterprise-grade security &amp; encryption</span>
        </div>
      </div>

      {/* ================= RIGHT COLUMN: OFFICIALS LOGIN (Reference Right Half) ================= */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto py-6">
          {/* Back to Home Link */}
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-8 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Home
          </button>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Welcome Back
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
              Sign in to your official dashboard
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Address */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="official@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white placeholder-slate-400 transition-all font-normal"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full px-4 pr-11 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 bg-white placeholder-slate-400 transition-all font-normal"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {showPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "Password assistance is managed by your Barangay IT or City Waste Administrator.",
                  )
                }
                className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button (Matching Reference Accent Button) */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#006A3B] hover:bg-[#00552F] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-800/15 flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Signing in…" : "Access Dashboard"}
            </button>
          </form>

          {/* Divider with Centered Label (Matches "PATIENT PORTAL" in Reference) */}
          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-white px-3 text-slate-400 font-bold">
                Official Portal
              </span>
            </div>
          </div>

          {/* New Official / Account Link */}
          <div className="text-center text-xs text-slate-600 mb-8">
            New official?{" "}
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="text-emerald-700 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
            >
              Contact administrator
            </button>
          </div>

          {/* Bottom Trust Badges (Matches Bottom of Reference) */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>R.A. 10173 Compliant &amp; Secure</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>Authorized by Local Government Units</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Feature Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />

      {/* Contact Administrator / Request Access Modal */}
      <ContactAdminModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        defaultEmail={email}
      />
    </div>
  );
}
