import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Film, Lock, Mail, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email.trim() || !formData.username.trim() || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      await register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        display_name: formData.displayName || undefined,
      });
      navigate('/');
    } catch (error) {
      // Error is handled by the store
    }
  };

  return (
    <>
      <Helmet>
        <title>Sign Up - NebulaStream</title>
      </Helmet>

      <div className="min-h-screen bg-dark-950 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-48 -right-20 w-[520px] h-[520px] bg-nebula-500/20 blur-[140px]" />
          <div className="absolute bottom-0 left-0 w-[520px] h-[520px] bg-accent-500/20 blur-[150px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
        </div>

        <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
          <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
            <div>
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-nebula-500/20 border border-nebula-500/40 flex items-center justify-center">
                  <Film className="w-6 h-6 text-nebula-500" />
                </div>
                <div className="leading-tight">
                  <span className="text-white font-display text-2xl">NebulaStream</span>
                  <span className="block text-[11px] uppercase tracking-[0.4em] text-white/50">
                    Join Us
                  </span>
                </div>
              </Link>
            </div>

            <div className="space-y-6">
              <span className="badge-pill">Member Access</span>
              <h1 className="text-4xl font-display font-bold text-white leading-tight">
                Stream smarter.
                <span className="block text-white/70 mt-2">
                  Build your list and never miss a premiere.
                </span>
              </h1>
              <p className="text-white/60 text-lg max-w-md">
                Create your profile, track your watch history, and unlock curated recommendations.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-white/60">
                <span className="px-3 py-1 rounded-full bg-white/10">Personalized Picks</span>
                <span className="px-3 py-1 rounded-full bg-white/10">Watch History</span>
                <span className="px-3 py-1 rounded-full bg-white/10">Smart Lists</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md glass-panel rounded-3xl p-8">
              <div className="text-center mb-8">
                <Link to="/" className="inline-flex items-center space-x-2">
                  <Film className="w-10 h-10 text-nebula-500" />
                  <span className="text-2xl font-display font-bold text-white">NebulaStream</span>
                </Link>
                <h2 className="mt-6 text-3xl font-display font-bold text-white">
                  Create an account
                </h2>
                <p className="mt-2 text-white/60">Start your streaming journey today</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="input-field pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium text-white/70 mb-1"
                    >
                      Username *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        id="username"
                        name="username"
                        type="text"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Choose a username"
                        className="input-field pl-10"
                        required
                        minLength={3}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="displayName"
                      className="block text-sm font-medium text-white/70 mb-1"
                    >
                      Display Name (optional)
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        id="displayName"
                        name="displayName"
                        type="text"
                        value={formData.displayName}
                        onChange={handleChange}
                        placeholder="How should we call you?"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-white/70 mb-1"
                    >
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Create a password (min 6 characters)"
                        className="input-field pl-10 pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-white/70 mb-1"
                    >
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm your password"
                        className="input-field pl-10 pr-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-dark-950 text-white/40">Or</span>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-white/60">
                    Already have an account?{' '}
                    <Link to="/login" className="text-nebula-400 hover:text-nebula-300 font-medium">
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>

              <div className="text-center mt-6">
                <Link to="/" className="text-white/40 hover:text-white/70 text-sm">
                  ← Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
