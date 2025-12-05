'use client';

import { motion, useReducedMotion } from 'framer-motion';

export default function HolographicCard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative w-64 h-96 perspective-1000">
      <motion.div
        className="w-full h-full relative preserve-3d will-change-transform"
        animate={shouldReduceMotion ? {} : {
          rotateY: [0, 360],
          y: [0, -20, 0],
        }}
        transition={{
          rotateY: {
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          },
          y: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }
        }}
      >
        {/* Card Front */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyber-dark to-cyber-black border border-cyber-primary/50 shadow-[0_0_30px_rgba(0,243,255,0.2)] backdrop-blur-sm flex items-center justify-center overflow-hidden">
          {/* Holographic Shine */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50" />
          
          {/* Card Content */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-6xl mb-4 text-cyber-primary drop-shadow-[0_0_10px_rgba(0,243,255,0.8)]">♠</div>
            <div className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">A</div>
          </div>

          {/* Tech Lines */}
          <div className="absolute top-0 left-0 w-full h-full opacity-30">
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyber-primary" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyber-primary" />
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyber-primary/20" />
            <div className="absolute left-1/2 top-0 w-[1px] h-full bg-cyber-primary/20" />
          </div>
        </div>

        {/* Card Back (Optional, for 3D effect) */}
        <div 
          className="absolute inset-0 rounded-xl bg-cyber-dark border border-cyber-secondary/50 backface-hidden"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="w-full h-full flex items-center justify-center bg-[url('/pattern.svg')] opacity-20">
            <div className="w-20 h-20 border-2 border-cyber-secondary rounded-full flex items-center justify-center">
              <div className="w-16 h-16 bg-cyber-secondary/20 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* Floating Elements around card - Hidden on reduced motion */}
      {!shouldReduceMotion && (
        <>
          <motion.div
            className="absolute -top-10 -right-10 w-20 h-20 border border-cyber-secondary/30 rounded-full will-change-transform"
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute -bottom-5 -left-5 w-16 h-16 border border-cyber-primary/30 rotate-45 will-change-transform"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}
    </div>
  );
}
