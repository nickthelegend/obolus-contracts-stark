'use client';

import React, { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

let tvScriptLoadingPromise: Promise<void> | null = null;

export const TradingViewChart: React.FC = () => {
    const onLoadScriptRef = useRef<(() => void) | null>(null);
    const selectedAsset = useStore((state) => state.selectedAsset);

    useEffect(() => {
        onLoadScriptRef.current = createWidget;

        if (!tvScriptLoadingPromise) {
            tvScriptLoadingPromise = new Promise((resolve) => {
                const script = document.createElement('script');
                script.id = 'tradingview-widget-loading-script';
                script.src = 'https://s3.tradingview.com/tv.js';
                script.type = 'text/javascript';
                script.onload = () => resolve();
                document.head.appendChild(script);
            });
        }

        tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current());

        return () => {
            onLoadScriptRef.current = null;
        };

        function createWidget() {
            if (document.getElementById('tradingview_perp') && 'TradingView' in window) {
                new (window as any).TradingView.widget({
                    autosize: true,
                    symbol: `BINANCE:${selectedAsset}USDT`,
                    interval: '1',
                    timezone: 'Etc/UTC',
                    theme: 'dark',
                    style: '1',
                    locale: 'en',
                    toolbar_bg: '#f1f3f6',
                    enable_publishing: false,
                    hide_side_toolbar: false,
                    allow_symbol_change: true,
                    container_id: 'tradingview_perp',
                    backgroundColor: '#02040A',
                    gridColor: 'rgba(255, 255, 255, 0.05)',
                    loading_screen: { backgroundColor: '#02040A' },
                });
            }
        }
    }, [selectedAsset]);

    return (
        <div className="w-full h-full bg-[#050507] rounded-2xl overflow-hidden border border-white/5">
            <div id="tradingview_perp" className="w-full h-full" />
        </div>
    );
};
