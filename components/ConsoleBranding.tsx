'use client';

import { useEffect } from 'react';

export function printTeaderConsoleBanner() {
  if (typeof window === 'undefined') return;

  const asciiArt = `
  ████████╗███████╗ █████╗ ██████╗ ███████╗██████╗ 
  ╚══██╔══╝██╔════╝██╔══██╗██╔══██╗██╔════╝██╔══██╗
     ██║   █████╗  ███████║██║  ██║█████╗  ██████╔╝
     ██║   ██╔══╝  ██╔══██║██║  ██║██╔══╝  ██╔══██╗
     ██║   ███████╗██║  ██║██████╔╝███████╗██║  ██║
     ╚═╝   ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝
  `;

  console.log(
    `%c${asciiArt}`,
    'color: #DCB001; font-weight: 900; font-family: monospace; font-size: 13px; line-height: 1.2;'
  );

  console.log(
    '%c TEADER %c v2.0 %c High-Velocity Engineering Platform %c ⚡ 0ms Optimistic UI ',
    'background: #DCB001; color: #0A0B0D; font-weight: 900; font-size: 14px; padding: 4px 10px; border-radius: 4px;',
    'background: #2A2C30; color: #DCB001; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
    'background: #181A1F; color: #CFD4DD; font-weight: 600; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
    'background: #101114; color: #22C55E; font-family: monospace; font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #22C55E/30;'
  );

  console.log(
    '%c✦ Unity VCS Branch Splines  ✦ Granular In-Place Diffing  ✦ PostgreSQL Enterprise Storage',
    'color: #06B6D4; font-family: monospace; font-size: 11px; padding: 3px 0;'
  );

  console.log(
    '%cRepository: https://github.com/ajaysaagar-dev/teader',
    'color: #787C83; font-family: monospace; font-size: 10px;'
  );
}

export const ConsoleBranding: React.FC = () => {
  useEffect(() => {
    // Print banner immediately on client load
    printTeaderConsoleBanner();

    // Detect when DevTools console is opened
    let devtoolsOpen = false;
    const threshold = 160;

    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;

      if ((widthDiff || heightDiff) && !devtoolsOpen) {
        devtoolsOpen = true;
        printTeaderConsoleBanner();
      } else if (!widthDiff && !heightDiff) {
        devtoolsOpen = false;
      }
    };

    // Attach getter trick that triggers when console renders/evaluates
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function () {
        printTeaderConsoleBanner();
        return 'teader-devtools-open';
      },
    });

    window.addEventListener('resize', checkDevTools);
    return () => {
      window.removeEventListener('resize', checkDevTools);
    };
  }, []);

  return null;
};
