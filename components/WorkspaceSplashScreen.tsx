'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const WorkspaceSplashScreen: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
      className="fixed inset-0 top-0 left-0 w-screen h-screen min-h-[100dvh] z-[999999] flex flex-col items-center justify-center bg-[#0C0D0E] select-none overflow-hidden m-0 p-0"
    >
      {/* Background Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#DCB001]/12 via-[#0C0D0E]/90 to-[#0C0D0E] pointer-events-none" />

      {/* Minimal TEADER Branding Text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center justify-center space-y-4"
      >
        <div className="relative flex items-center justify-center">
          {/* Subtle Glow Behind Text */}
          <div className="absolute -inset-4 bg-[#DCB001]/20 blur-2xl rounded-full pointer-events-none" />

          {/* TEADER Bold Text */}
          <h1 className="relative text-4xl sm:text-5xl md:text-6xl font-black tracking-[0.3em] pl-[0.3em] font-mono text-transparent bg-clip-text bg-gradient-to-b from-white via-[#F3E5AB] to-[#DCB001] drop-shadow-2xl">
            TEADER
          </h1>
        </div>

        {/* Minimal Animated Loading Line */}
        <div className="w-24 h-0.5 bg-[#1B1C20] rounded-full overflow-hidden">
          <motion.div
            className="w-full h-full bg-[#DCB001]"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

