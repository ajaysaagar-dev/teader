import React from 'react';

export default function Loading() {
  return (
    <div className="flex-1 h-full w-full flex items-center justify-center p-6 select-none">
      <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
    </div>
  );
}
