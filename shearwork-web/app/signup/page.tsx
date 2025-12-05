'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { Eye, EyeOff, Mail, Lock, CheckCircle2, Sparkles, TrendingUp, Users, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Landing/Footer';
import { motion } from 'framer-motion';

// Color palette
const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  navBg: '#1b1d1b', 
  surface: 'rgba(37, 37, 37, 0.6)',
  surfaceSolid: '#252525',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
}

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    setLoading(true);
    const { data: userProfile, error } = await supabase.auth.signUp({ email, password });

    const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
        source: userProfile.user?.id,
        action: 'user_signup',
        status: 'success',
        details: `User ${userProfile.user?.email} signed up.`,
    })

    if (insertError) throw insertError

    if (error) toast.error(error.message);
    else {
      toast.success('Check your email to confirm your account!');
      router.push('/pricing');
    }

    setLoading(false);
  };

  const passwordMatch = password && confirmPassword && password === confirmPassword;

  const benefits = [
    { icon: <TrendingUp size={16} />, text: 'Real-time analytics & insights' },
    { icon: <BarChart3 size={16} />, text: 'Automated weekly reports' },
    { icon: <Users size={16} />, text: 'Client retention tracking' },
  ];

  return (
    <>
      <Navbar />
      
      {/* Section indicators at bottom */}
      <div className="fixed bottom-15 left-1/2 -translate-x-1/2 z-50 flex gap-3">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            onClick={() => {
              if (index === 0 || index === 1) {
                window.location.href = '/'
              }
            }}
            className="w-2 h-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor: index === 2 ? '#73aa57' : 'rgba(255, 255, 255, 0.3)',
              transform: index === 2 ? 'scale(1.5)' : 'scale(1)',
              cursor: index === 2 ? 'default' : 'pointer',
            }}
            aria-label={`Go to section ${index + 1}`}
          />
        ))}
      </div>

      <section 
        className="h-screen flex items-center overflow-hidden px-8 relative"
        style={{
          background: `linear-gradient(135deg, #181818 0%, #1a1a1a 30%, #1c1e1c 70%, #181818 100%)`,
          color: COLORS.text,
        }}
        onWheel={(e) => {
          if (e.deltaY < 0) {
            // Scroll up = go back to landing page
            window.location.href = '/'
          }
        }}
      >
        {/* Ambient glow effects */}
        <div 
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: COLORS.greenGlow }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: COLORS.greenGlow }}
        />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="flex gap-12 items-start">
          {/* Left Side: Sign Up Form */}
          <div className="flex-1" style={{ height: '430px' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="rounded-2xl shadow-2xl p-6 backdrop-blur-xl relative overflow-hidden h-full flex flex-col justify-between"
              style={{
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="mb-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                      boxShadow: `0 0 16px ${COLORS.greenGlow}`,
                    }}
                  >
                    <Sparkles size={16} color="#000000" />
                  </div>
                  <h2 className="text-2xl font-bold" style={{ color: COLORS.text }}>
                    Get Started
                  </h2>
                </div>
                <p className="text-sm" style={{ color: COLORS.textMuted }}>
                  Create your account and start growing today
                </p>
              </motion.div>

              <form onSubmit={handleSignUp} className="flex flex-col gap-4 relative z-10">
                {/* Email Input */}
                <div className="relative">
                  <Mail 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: COLORS.textMuted }}
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full p-3 pl-10 rounded-xl border transition-all duration-200 focus:outline-none placeholder:opacity-60 text-sm"
                    style={{
                      backgroundColor: COLORS.surfaceSolid,
                      borderColor: COLORS.glassBorder,
                      color: COLORS.text,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.green
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.greenGlow}`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.glassBorder
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                </div>

                {/* Password Input */}
                <div className="relative">
                  <Lock 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: COLORS.textMuted }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full p-3 pl-10 pr-10 rounded-xl border transition-all duration-200 focus:outline-none placeholder:opacity-60 text-sm"
                    style={{
                      backgroundColor: COLORS.surfaceSolid,
                      borderColor: COLORS.glassBorder,
                      color: COLORS.text,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.green
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.greenGlow}`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.glassBorder
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: COLORS.textMuted }}
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textMuted }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Confirm Password Input */}
                <div className="relative">
                  <Lock 
                    size={18} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: COLORS.textMuted }}
                  />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="w-full p-3 pl-10 pr-10 rounded-xl border transition-all duration-200 focus:outline-none placeholder:opacity-60 text-sm"
                    style={{
                      backgroundColor: COLORS.surfaceSolid,
                      borderColor: confirmPassword
                        ? passwordMatch
                          ? COLORS.green
                          : '#ff4444'
                        : COLORS.glassBorder,
                      color: COLORS.text,
                    }}
                    onFocus={(e) => {
                      if (!confirmPassword || passwordMatch) {
                        e.currentTarget.style.borderColor = COLORS.green
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${COLORS.greenGlow}`
                      }
                    }}
                    onBlur={(e) => {
                      if (confirmPassword) {
                        e.currentTarget.style.borderColor = passwordMatch ? COLORS.green : '#ff4444'
                      } else {
                        e.currentTarget.style.borderColor = COLORS.glassBorder
                      }
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: COLORS.textMuted }}
                    onClick={() => setShowConfirm(!showConfirm)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textMuted }}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {passwordMatch && (
                    <CheckCircle2 
                      size={18} 
                      className="absolute right-10 top-1/2 -translate-y-1/2"
                      style={{ color: COLORS.green }}
                    />
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100 mt-2 relative overflow-hidden group"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                    color: '#000000',
                    boxShadow: `0 8px 32px ${COLORS.greenGlow}`,
                  }}
                >
                  <span className="relative z-10 text-sm">{loading ? 'Creating account...' : 'Create Account'}</span>
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.greenLight} 0%, ${COLORS.green} 100%)`,
                    }}
                  />
                </button>

                <p className="text-center text-xs" style={{ color: COLORS.textMuted }}>
                  By signing up, you agree to our Terms & Privacy Policy
                </p>
              </form>

              {/* Bottom decoration/info */}
              <div 
                className="pt-4 mt-4 border-t flex items-center justify-center gap-2"
                style={{ borderColor: COLORS.glassBorder }}
              >
                <Lock size={14} style={{ color: COLORS.green }} />
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  Your data is encrypted and secure
                </span>
              </div>
            </motion.div>
          </div>

          {/* Vertical Divider */}
          <div 
            className="w-px h-96 rounded-full"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${COLORS.glassBorder} 50%, transparent 100%)`,
            }}
          />

          {/* Right Side: Benefits & Login */}
          <div className="flex-1 flex flex-col justify-between" style={{ height: '430px' }}>
            {/* Welcome Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="rounded-2xl shadow-2xl p-6 backdrop-blur-xl relative overflow-hidden group flex-1 mb-4"
              style={{
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1e221e 100%)`,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <div 
                className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                style={{ background: COLORS.greenGlow }}
              />
              
              <div className="relative z-10">
                <h3 
                  className="text-xl font-bold mb-3 flex items-center gap-2"
                  style={{ color: COLORS.text }}
                >
                  <span>Welcome to</span>
                  <span style={{ color: COLORS.green }}>ShearWork</span>
                </h3>
                <p 
                  className="text-sm leading-relaxed mb-4"
                  style={{ color: COLORS.textMuted }}
                >
                  Join other barbers who are transforming their careers with data-driven insights.
                </p>

                {/* Benefits List */}
                <div className="space-y-2">
                  {benefits.map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                      className="flex items-center gap-2 p-2 rounded-lg transition-all duration-300 hover:-translate-x-1"
                      style={{
                        backgroundColor: 'rgba(115, 170, 87, 0.1)',
                      }}
                    >
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: COLORS.green,
                          boxShadow: `0 4px 12px ${COLORS.greenGlow}`,
                        }}
                      >
                        {benefit.icon}
                      </div>
                      <span className="text-sm font-medium" style={{ color: COLORS.text }}>
                        {benefit.text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Already Have Account Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
              className="rounded-2xl shadow-2xl p-6 backdrop-blur-xl text-center"
              style={{
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <p 
                className="text-sm mb-3 font-medium"
                style={{ color: COLORS.textMuted }}
              >
                Already have an account?
              </p>
              <a
                href="/login"
                className="inline-block w-full py-3 rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] border-2 relative overflow-hidden group"
                style={{
                  borderColor: COLORS.green,
                  color: COLORS.green,
                  backgroundColor: 'transparent',
                }}
              >
                <span className="relative z-10 text-sm">Log In</span>
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                  }}
                />
                <span 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold z-20 text-sm"
                  style={{ color: '#000000' }}
                >
                  Log In
                </span>
              </a>
            </motion.div>
          </div>
        </div>
        </div>
      </section>
      <Footer />
    </>
  );
}