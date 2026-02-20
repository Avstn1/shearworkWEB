'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { Eye, EyeOff, Mail, Lock, LogIn, TrendingUp, Users, BarChart3 } from 'lucide-react';
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: userProfile, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);

      const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: 'Unauthenticated user',
          action: 'user_login',
          status: 'failed',
          details: `${email} login failed.`,
        })

        if (insertError) throw insertError
    }
    else {
      toast.success('Logged in successfully!');

      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
      }

      const ua = navigator.userAgent;
      const browser = ua.includes('Chrome') ? 'Chrome' : 
                      ua.includes('Safari') ? 'Safari' : 
                      ua.includes('Firefox') ? 'Firefox' : 
                      ua.includes('Edge') ? 'Edge' : 'Browser';
      const os = ua.includes('Mac') ? 'Mac' : 
                ua.includes('Windows') ? 'Windows' : 
                ua.includes('Linux') ? 'Linux' : 'Unknown';

      // Get the actual session UUID using the RPC function
      const { data: sessionId, error: sessionError } = await supabase
        .rpc('get_current_session_id')

      await supabase.from('user_devices').upsert({
        user_id: userProfile.user.id,
        device_type: 'web',
        device_id: deviceId,
        device_name: `${browser} on ${os}`,
        session_id: sessionId || userProfile.session?.access_token, // Use session UUID from RPC
        last_login: new Date().toISOString(),
        last_active: new Date().toISOString(),
        user_agent: navigator.userAgent,
      }, {
        onConflict: 'user_id,device_id'
      });

      router.refresh();
      router.push('/dashboard');
      
      const { data: userData } = await supabase.from('profiles').select('role, full_name').eq('user_id', userProfile.user?.id).single();
      if (userData?.role != 'Admin') {
        const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: `${userData?.full_name}: ${userProfile.user?.id}`,
          action: 'user_login',
          status: 'success',
          details: `${userProfile.user?.email} logged in.`,
        })

        if (insertError) throw insertError
      }
    }

    setLoading(false);
  };

  const benefits = [
    { icon: <TrendingUp size={16} />, text: 'Track your business growth' },
    { icon: <BarChart3 size={16} />, text: 'Review automated reports' },
    { icon: <Users size={16} />, text: 'Monitor client retention' },
  ];

  return (
    <>      
      {/* Section indicators at bottom - hidden on mobile */}
      <div className="hidden lg:flex fixed bottom-15 left-1/2 -translate-x-1/2 z-50 gap-3">
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
        className="h-screen flex items-center overflow-auto lg:overflow-hidden px-4 sm:px-5 lg:px-8 py-4 lg:py-0 relative"
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
          className="absolute top-1/4 left-1/4 w-32 h-32 sm:w-64 sm:h-64 rounded-full blur-3xl opacity-10"
          style={{ background: COLORS.greenGlow }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-32 h-32 sm:w-64 sm:h-64 rounded-full blur-3xl opacity-10"
          style={{ background: COLORS.greenGlow }}
        />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="flex flex-col lg:flex-row gap-2 lg:gap-12 items-stretch">
          {/* Left Side: Login Form */}
          <div className="flex-1 w-full lg:w-auto lg:h-[430px]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="rounded-lg lg:rounded-2xl shadow-2xl p-3 lg:p-6 backdrop-blur-xl relative overflow-hidden h-full flex flex-col justify-between"
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
                className="mb-2 lg:mb-4"
              >
                <div className="flex items-center gap-1.5 lg:gap-2 mb-1 lg:mb-2">
                  <div 
                    className="w-6 h-6 lg:w-8 lg:h-8 rounded-md lg:rounded-lg flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                      boxShadow: `0 0 16px ${COLORS.greenGlow}`,
                    }}
                  >
                    <LogIn size={12} className="lg:w-4 lg:h-4" color="#000000" />
                  </div>
                  <h2 className="text-base lg:text-2xl font-bold" style={{ color: COLORS.text }}>
                    Welcome Back
                  </h2>
                </div>
                <p className="text-[10px] lg:text-sm leading-tight lg:leading-normal" style={{ color: COLORS.textMuted }}>
                  Log in to continue managing your business
                </p>
              </motion.div>

              <form onSubmit={handleLogin} className="flex flex-col gap-1.5 lg:gap-4 relative z-10">
                {/* Email Input */}
                <div className="relative">
                  <Mail 
                    size={14} 
                    className="absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: COLORS.textMuted }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full p-2 lg:p-3 pl-7 lg:pl-10 rounded-md lg:rounded-xl border transition-all duration-200 focus:outline-none placeholder:opacity-60 text-[11px] lg:text-sm"
                    style={{
                      backgroundColor: COLORS.surfaceSolid,
                      borderColor: COLORS.glassBorder,
                      color: COLORS.text,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.green
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${COLORS.greenGlow}`
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
                    size={14} 
                    className="absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: COLORS.textMuted }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full p-2 lg:p-3 pl-7 lg:pl-10 pr-8 lg:pr-10 rounded-md lg:rounded-xl border transition-all duration-200 focus:outline-none placeholder:opacity-60 text-[11px] lg:text-sm"
                    style={{
                      backgroundColor: COLORS.surfaceSolid,
                      borderColor: COLORS.glassBorder,
                      color: COLORS.text,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = COLORS.green
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${COLORS.greenGlow}`
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = COLORS.glassBorder
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: COLORS.textMuted }}
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.textMuted }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 lg:py-3 rounded-md lg:rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100 mt-0.5 lg:mt-2 relative overflow-hidden group"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                    color: '#000000',
                    boxShadow: `0 8px 32px ${COLORS.greenGlow}`,
                  }}
                >
                  <span className="relative z-10 text-[11px] lg:text-sm">{loading ? 'Logging in...' : 'Log In'}</span>
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${COLORS.greenLight} 0%, ${COLORS.green} 100%)`,
                    }}
                  />
                </button>

                <p className="text-center text-[9px] lg:text-xs leading-tight" style={{ color: COLORS.textMuted }}>
                  Secure login protected by encryption
                </p>
                <p
                  className="text-center text-[9px] lg:text-xs leading-tight"
                  style={{ color: COLORS.textMuted }}
                >
                  By signing in, you agree to our{" "}
                  <a
                    href="/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                  >
                    Privacy Policy
                  </a>
                </p>
              </form>

              {/* Bottom decoration/info */}
              <div 
                className="pt-1.5 lg:pt-4 mt-1.5 lg:mt-4 border-t flex items-center justify-center gap-1 lg:gap-2"
                style={{ borderColor: COLORS.glassBorder }}
              >
                <Lock size={10} className="lg:w-3.5 lg:h-3.5" style={{ color: COLORS.green }} />
                <span className="text-[9px] lg:text-xs" style={{ color: COLORS.textMuted }}>
                  Encrypted & secure
                </span>
              </div>
            </motion.div>
          </div>

          {/* Vertical Divider - hidden on mobile */}
          <div 
            className="hidden lg:block w-px h-96 rounded-full"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${COLORS.glassBorder} 50%, transparent 100%)`,
            }}
          />

          {/* Right Side: Welcome Back & Sign Up */}
          <div className="flex-1 w-full lg:w-auto lg:h-[430px] flex flex-col justify-between gap-2 lg:gap-4">
            {/* Welcome Back Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
              className="rounded-lg lg:rounded-2xl shadow-2xl p-3 lg:p-6 backdrop-blur-xl relative overflow-hidden group flex-1"
              style={{
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1e221e 100%)`,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <div 
                className="absolute top-0 right-0 w-16 h-16 lg:w-24 lg:h-24 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"
                style={{ background: COLORS.greenGlow }}
              />
              
              <div className="relative z-10">
                <h3 
                  className="text-sm lg:text-xl font-bold mb-1.5 lg:mb-3 flex items-center gap-1.5 lg:gap-2"
                  style={{ color: COLORS.text }}
                >
                  <span>Welcome back to</span>
                  <span style={{ color: COLORS.green }}>Corva</span>
                </h3>
                <p 
                  className="text-[10px] lg:text-sm leading-tight lg:leading-relaxed mb-2 lg:mb-4"
                  style={{ color: COLORS.textMuted }}
                >
                  Continue growing your business with powerful analytics.
                </p>

                {/* Benefits List */}
                <div className="space-y-1 lg:space-y-2">
                  {benefits.map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                      className="flex items-center gap-1.5 lg:gap-2 p-1 lg:p-2 rounded-md lg:rounded-lg transition-all duration-300 hover:-translate-x-1"
                      style={{
                        backgroundColor: 'rgba(115, 170, 87, 0.1)',
                      }}
                    >
                      <div 
                        className="w-5 h-5 lg:w-7 lg:h-7 rounded-md lg:rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: COLORS.green,
                          boxShadow: `0 2px 8px ${COLORS.greenGlow}`,
                        }}
                      >
                        <div className="scale-75 lg:scale-100">
                          {benefit.icon}
                        </div>
                      </div>
                      <span className="text-[10px] lg:text-sm font-medium leading-tight" style={{ color: COLORS.text }}>
                        {benefit.text}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Don't Have Account Card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
              className="rounded-lg lg:rounded-2xl shadow-2xl p-3 lg:p-6 backdrop-blur-xl text-center"
              style={{
                background: `linear-gradient(135deg, ${COLORS.cardBg} 0%, #1c1e1c 100%)`,
                borderWidth: 1,
                borderColor: COLORS.glassBorder,
              }}
            >
              <p 
                className="text-[10px] lg:text-sm mb-2 lg:mb-3 font-medium"
                style={{ color: COLORS.textMuted }}
              >
                Don&apos;t have an account?
              </p>
              <a
                href="/signup"
                className="inline-block w-full py-2 lg:py-3 rounded-md lg:rounded-xl font-bold transition-all duration-300 hover:scale-[1.02] border-2 relative overflow-hidden group"
                style={{
                  borderColor: COLORS.green,
                  color: COLORS.green,
                  backgroundColor: 'transparent',
                }}
              >
                <span className="relative z-10 text-[11px] lg:text-sm">Sign Up</span>
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(135deg, ${COLORS.green} 0%, ${COLORS.greenLight} 100%)`,
                  }}
                />
                <span 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-bold z-20 text-[11px] lg:text-sm"
                  style={{ color: '#000000' }}
                >
                  Sign Up
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