'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Background() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-20" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '50px 50px' 
        }}
      />
      
      {/* Floating Hexagons */}
      {[...Array(6)].map((_, i) => {
        const size = Math.random() * 300 + 100;
        const startX = Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000);
        const startY = Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000);
        const endY = Math.random() * -100;
        const duration = Math.random() * 20 + 10;
        const scale = Math.random() * 0.5 + 0.5;
        
        return (
          <motion.div
            key={i}
            className="absolute border border-cyber-primary/20 rounded-full"
            initial={{
              x: startX,
              y: startY,
              scale: scale,
              opacity: 0.1,
            }}
            animate={{
              y: [startY, endY],
              rotate: [0, 360],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{      
              width: size,
              height: size,
            }}
          />
        );
      })}

      {/* Glowing Orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-primary/20 rounded-full blur-[100px]"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-secondary/20 rounded-full blur-[100px]"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.3, 0.2],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
