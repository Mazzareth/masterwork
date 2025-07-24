'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';
import { useIOSPointer } from '../contexts/IOSPointerContext';

interface IOSPointerProps {
  springConfig?: {
    damping: number;
    stiffness: number;
    mass: number;
  };
}

const POINTER_SIZE = 10;
const GHOST_POINTER_SIZE = 24;

/**
 * @description A component that creates an iOS-style pointer that follows the user's cursor and morphs to fit interactive elements.
 * @param {IOSPointerProps} props - The props for the component.
 * @returns {React.ReactElement | null} The rendered component, or null if it's not enabled or mounted.
 */
export default function IOSPointer({
  springConfig = { damping: 25, stiffness: 700, mass: 0.5 },
}: IOSPointerProps) {
  const { isEnabled } = useIOSPointer();
  const [mounted, setMounted] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  // Motion values for the main expanding pointer
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const pointerWidth = useSpring(POINTER_SIZE, springConfig);
  const pointerHeight = useSpring(POINTER_SIZE, springConfig);
  const pointerBorderRadius = useSpring(POINTER_SIZE / 2, springConfig);
  const pointerOpacity = useSpring(0, springConfig);

  // Motion values for the ghost pointer (the dot that follows the cursor)
  const ghostX = useMotionValue(0);
  const ghostY = useMotionValue(0);
  const ghostOpacity = useSpring(0, springConfig);

  useEffect(() => {
    setMounted(true);
    if (!isEnabled) {
      ghostOpacity.set(0);
      pointerOpacity.set(0);
      return;
    }

    const updatePointer = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      ghostX.set(clientX - GHOST_POINTER_SIZE / 2);
      ghostY.set(clientY - GHOST_POINTER_SIZE / 2);

      const interactiveElement =
        (e.target as HTMLElement)?.closest<HTMLElement>(
          'button, a, input, select, textarea, [role="button"], .btn, .interactive-element'
        ) || null;

      if (interactiveElement) {
        const rect = interactiveElement.getBoundingClientRect();
        setTargetElement(interactiveElement);

        // Animate pointer to encase the element
        pointerX.set(rect.left);
        pointerY.set(rect.top);
        pointerWidth.set(rect.width);
        pointerHeight.set(rect.height);
        pointerBorderRadius.set(parseFloat(getComputedStyle(interactiveElement).borderRadius) || 8);
        ghostOpacity.set(0.5);
      } else {
        setTargetElement(null);

        // Animate pointer back to a dot
        pointerX.set(clientX - POINTER_SIZE / 2);
        pointerY.set(clientY - POINTER_SIZE / 2);
        pointerWidth.set(POINTER_SIZE);
        pointerHeight.set(POINTER_SIZE);
        pointerBorderRadius.set(POINTER_SIZE / 2);
        ghostOpacity.set(1);
      }
    };

    const handleMouseEnter = () => {
      pointerOpacity.set(1);
      ghostOpacity.set(1);
    };

    const handleMouseLeave = () => {
      pointerOpacity.set(0);
      ghostOpacity.set(0);
    };

    document.addEventListener('mousemove', updatePointer);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', updatePointer);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isEnabled, ghostOpacity, ghostX, ghostY, pointerBorderRadius, pointerHeight, pointerOpacity, pointerWidth, pointerX, pointerY]);

  useEffect(() => {
    if (targetElement) {
      const handleTransition = () => {
        const rect = targetElement.getBoundingClientRect();
        animate(pointerX, rect.left, { duration: 0.1 });
        animate(pointerY, rect.top, { duration: 0.1 });
        animate(pointerWidth, rect.width, { duration: 0.1 });
        animate(pointerHeight, rect.height, { duration: 0.1 });
      };

      targetElement.addEventListener('transitionend', handleTransition);
      return () => targetElement.removeEventListener('transitionend', handleTransition);
    }
  }, [targetElement, pointerX, pointerY, pointerWidth, pointerHeight]);

  if (!mounted || !isEnabled) {
    return null;
  }

  return (
    <>
      {/* Ghost Pointer (the dot) */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-full bg-primary/50"
        style={{
          x: ghostX,
          y: ghostY,
          width: GHOST_POINTER_SIZE,
          height: GHOST_POINTER_SIZE,
          opacity: ghostOpacity,
        }}
      />

      {/* Main Encasing Pointer */}
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] border-2 border-primary"
        style={{
          x: pointerX,
          y: pointerY,
          width: pointerWidth,
          height: pointerHeight,
          borderRadius: pointerBorderRadius,
          opacity: pointerOpacity,
        }}
      />

      <style jsx global>{`
        *:not(.ios-pointer-disabled *) {
          cursor: none !important;
        }
        .ios-pointer-disabled * {
          cursor: auto !important;
        }
      `}</style>
    </>
  );
}