import React from 'react';
import { useStore } from '@/lib/store';

export const WalletConnect: React.FC = () => {
  const address = useStore((state) => state.address);
  const setConnectModalOpen = useStore((state) => state.setConnectModalOpen);
  const disconnect = useStore((state) => state.disconnect);

  const shortenAddress = (addr: string) => {
    if (!addr) return '...';
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const isConnected = !!address;

  return (
    <div className="flex items-center gap-3">
      {!isConnected ? (
        <button
          onClick={() => setConnectModalOpen(true)}
          data-tour="connect-button"
          className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all active:scale-95"
        >
          Connect KasWare
        </button>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-2.5">
            <div className="w-4 h-4 shrink-0">
              <img
                src="/logos/kaspa-logo.png"
                alt="Kaspa"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[8px] text-[#70C7BA] font-bold uppercase tracking-tighter">
                KASPA
              </span>
              <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                {shortenAddress(address)}
              </span>
            </div>
          </div>

          <button
            onClick={() => disconnect()}
            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
            title="Disconnect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
