'use client';

import React from 'react';
import { GameBoard } from '@/components/game';
import { MiniHistory } from '@/components/history';
import { Header } from '@/components/ui/Header';

export default function Home() {
  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col relative">
      <Header />

      {/* Main Content - Full Screen */}
      <main className="flex-1 w-full h-full relative">
        <GameBoard />
        <MiniHistory />
      </main>
    </div>
  );
}
