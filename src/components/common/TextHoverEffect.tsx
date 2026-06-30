"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export const TextHoverEffect = ({ text }: { text: string }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  // --- 1. MOTION VALUES (For the spotlight effect) ---
  const mouseX = useMotionValue("50%");
  const mouseY = useMotionValue("50%");

  // --- 2. SPRING PHYSICS (Smooth follow) ---
  const springConfig = { damping: 30, stiffness: 400, mass: 0.5 };
  // We type these as 'any' to bypass strict TS checks on motion values for gradients
  const cx: any = useSpring(mouseX, springConfig);
  const cy: any = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const xPerc = ((e.clientX - svgRect.left) / svgRect.width) * 100;
      const yPerc = ((e.clientY - svgRect.top) / svgRect.height) * 100;
      
      mouseX.set(`${xPerc}%`);
      mouseY.set(`${yPerc}%`);
    }
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMouseMove}
      className="select-none cursor-pointer"
    >
      <defs>
        {/* 1. VIBRANT MULTICOLOR GRADIENT (Exact match to old project) */}
        <linearGradient
          id="strokeGradient"
          gradientUnits="userSpaceOnUse"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor="#6366f1" />   {/* Indigo */}
          <stop offset="25%" stopColor="#a855f7" />  {/* Purple */}
          <stop offset="50%" stopColor="#ec4899" />  {/* Pink */}
          <stop offset="75%" stopColor="#06b6d4" />  {/* Cyan */}
          <stop offset="100%" stopColor="#8b5cf6" /> {/* Violet */}
        </linearGradient>

        {/* 2. SPOTLIGHT MASK (Linked to spring values) */}
        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          cx={cx}
          cy={cy}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>

        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>

      {/* Layer 1: GHOST TEXT (Background Trace) */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="font-[helvetica] font-bold stroke-neutral-800 dark:stroke-neutral-800 fill-transparent text-7xl opacity-30"
      >
        {text}
      </text>

      {/* Layer 2: ANIMATED DRAWING (Multicolor Stroke) */}
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.4"
        className="font-[helvetica] font-bold fill-transparent text-7xl"
        stroke="url(#strokeGradient)"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>

      {/* Layer 3: HOVER SPOTLIGHT (The Reveal) */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#strokeGradient)"
        strokeWidth="1"
        fill="url(#strokeGradient)"
        fillOpacity="0.15" 
        mask="url(#textMask)"
        className="font-[helvetica] font-bold text-7xl"
      >
        {text}
      </text>
    </svg>
  );
};