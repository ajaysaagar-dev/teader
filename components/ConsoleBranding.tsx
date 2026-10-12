'use client';

import { useEffect } from 'react';
import { BUILD_NUMBER } from '@/lib/build-info';

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
    'color: #FFFFFF; font-weight: 900; font-family: monospace; font-size: 13px; line-height: 1.2;'
  );

  console.log(
    `%c TEADER %c ${BUILD_NUMBER} %c High-Velocity Engineering Platform %c ⚡ 0ms Optimistic UI `,
    'background: #FFFFFF; color: #000000; font-weight: 900; font-size: 14px; padding: 4px 10px; border-radius: 4px;',
    'background: #222222; color: #FFFFFF; font-weight: bold; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
    'background: #141414; color: #A0A0A0; font-weight: 600; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
    'background: #000000; color: #FFFFFF; font-family: monospace; font-size: 12px; padding: 4px 8px; border-radius: 4px; border: 1px solid #FFFFFF/30;'
  );

  console.log(
    '%c✦ Unity VCS Branch Splines  ✦ Granular In-Place Diffing  ✦ PostgreSQL Enterprise Storage',
    'color: #FFFFFF; font-family: monospace; font-size: 11px; padding: 3px 0;'
  );

  console.log(
    '%cRepository: https://github.com/ajaysaagar-dev/teader',
    'color: #666666; font-family: monospace; font-size: 10px;'
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
