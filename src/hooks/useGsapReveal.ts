import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface RevealOptions {
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  delay?: number;
  duration?: number;
  stagger?: number;
  ease?: string;
  once?: boolean;
}

/**
 * Custom hook for GSAP scroll-triggered reveal animations.
 * Apply the returned ref to a container, and its children with [data-reveal] will animate in.
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions = {}
) {
  const containerRef = useRef<T>(null);

  const {
    direction = 'up',
    distance = 40,
    delay = 0,
    duration = 0.8,
    stagger = 0.1,
    ease = 'power3.out',
    once = true,
  } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = container.querySelectorAll('[data-reveal]');
    if (elements.length === 0) return;

    const fromVars: gsap.TweenVars = { opacity: 0 };

    switch (direction) {
      case 'up':
        fromVars.y = distance;
        break;
      case 'down':
        fromVars.y = -distance;
        break;
      case 'left':
        fromVars.x = distance;
        break;
      case 'right':
        fromVars.x = -distance;
        break;
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top 85%',
        once,
      },
    });

    tl.fromTo(
      elements,
      fromVars,
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration,
        delay,
        stagger,
        ease,
      }
    );

    return () => {
      tl.kill();
    };
  }, [direction, distance, delay, duration, stagger, ease, once]);

  return containerRef;
}

/**
 * GSAP counter animation hook — animates a number from 0 to target.
 */
export function useGsapCounter(
  target: number,
  options: { duration?: number; delay?: number; suffix?: string } = {}
) {
  const ref = useRef<HTMLSpanElement>(null);
  const { duration = 2, delay = 0 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obj = { val: 0 };

    const tween = gsap.to(obj, {
      val: target,
      duration,
      delay,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        once: true,
      },
      onUpdate: () => {
        if (el) {
          el.textContent = Math.round(obj.val).toLocaleString();
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [target, duration, delay]);

  return ref;
}

/**
 * Simple GSAP entrance animation (no scroll trigger).
 */
export function useGsapEntrance<T extends HTMLElement = HTMLDivElement>(
  options: { delay?: number; duration?: number; y?: number; stagger?: number } = {}
) {
  const ref = useRef<T>(null);
  const { delay = 0, duration = 0.7, y = 30, stagger = 0.08 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = el.querySelectorAll('[data-entrance]');
    const targets = children.length > 0 ? children : [el];

    gsap.fromTo(
      targets,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        stagger,
        ease: 'power3.out',
      }
    );
  }, [delay, duration, y, stagger]);

  return ref;
}
