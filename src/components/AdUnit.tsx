import React from 'react';
import { useAds } from '../context/AdsContext';

export function AdUnit({ placement }: { placement: 'feed' | 'search' }) {
  const { settings } = useAds();

  if (!settings || settings.adMode !== 'google') return null;

  if (placement === 'feed') {
    return (
      <div className="h-full w-full bg-zinc-950 flex flex-col items-center justify-center text-center space-y-4 relative">
        <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-[12px] text-[10px] uppercase font-black tracking-widest text-zinc-400 border border-white/10">
          Advertisement
        </div>
        <div className="w-[300px] h-[250px] bg-zinc-900 rounded-3xl flex flex-col items-center justify-center border border-theme-white/10 shadow-2xl">
          <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">
            Google AdSense
            <br />
            <span className="text-[10px] opacity-60">Slot: {settings.googleFeedAdSlot || "Unconfigured"}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-zinc-900/50 border border-theme-white/10 rounded-[32px] p-6 flex flex-col items-center justify-center text-center space-y-4 my-2">
      <div className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
        Advertisement
      </div>
      <div className="w-full h-32 bg-zinc-800 rounded-2xl flex flex-col items-center justify-center">
        <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs">
          Google Ad
          <br />
          <span className="text-[10px] opacity-60">Slot: {settings.googleSearchAdSlot || "Unconfigured"}</span>
        </p>
      </div>
    </div>
  );
}
