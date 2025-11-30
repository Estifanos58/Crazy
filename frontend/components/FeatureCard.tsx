'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
}

export default function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-panel p-8 hover:border-cyber-primary/50 transition-colors duration-300 group"
    >
      <div className="mb-6 text-cyber-primary group-hover:text-cyber-accent transition-colors duration-300 transform group-hover:scale-110">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white group-hover:text-cyber-primary transition-colors duration-300">
        {title}
      </h3>
      <p className="text-gray-400 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
