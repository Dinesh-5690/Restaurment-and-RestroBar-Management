'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { KitchenBatch, KitchenStation } from '@/types';
import { kitchenApi, menuApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import KitchenTicket from '@/components/kitchen/KitchenTicket';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Monitor } from 'lucide-react';
import clsx from 'clsx';

export default function KitchenPage() {
  const [stations, setStations] = useState<string[]>(['ALL']);
  const [queue, setQueue] = useState<KitchenBatch[]>([]);
  const [station, setStation] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const lastAlertAtRef = useRef(0);
  const soundEnabledRef = useRef(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const initializedQueueRef = useRef(false);
  const knownBatchIdsRef = useRef<Set<string>>(new Set());

  const getAudioCtx = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new AudioCtx();
      } catch (e) {
        console.error('Failed to create AudioContext:', e);
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const unlockSound = useCallback(async () => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) {
        soundEnabledRef.current = false;
        return;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      soundEnabledRef.current = true;
    } catch (e) {
      console.error('Sound unlock failed:', e);
      soundEnabledRef.current = false;
    }
  }, [getAudioCtx]);

  const playNewOrderAlert = useCallback(() => {
    if (!soundEnabledRef.current) {
      console.log('[Sound] Disabled');
      return;
    }

    const now = Date.now();
    if (now - lastAlertAtRef.current < 1200) {
      console.log('[Sound] Throttled');
      return;
    }
    lastAlertAtRef.current = now;

    try {
      const ctx = getAudioCtx();
      if (!ctx) {
        console.log('[Sound] No audio context');
        return;
      }
      
      console.log('[Sound] Context state:', ctx.state);
      
      if (ctx.state === 'suspended') {
        console.log('[Sound] Resuming suspended context');
        ctx.resume().then(() => {
          console.log('[Sound] Context resumed');
        }).catch((e) => {
          console.error('[Sound] Resume failed:', e);
        });
        return;
      }

      console.log('[Sound] Playing beep');
      const beep = (freq: number, delay = 0) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.18);
        } catch (e) {
          console.error('[Sound] Beep error:', e);
        }
      };

      beep(880, 0);
      beep(1100, 0.2);
    } catch (e) {
      console.error('[Sound] Alert failed:', e);
    }
  }, [getAudioCtx]);

  useEffect(() => {
    // Browsers often require a user gesture before audio can play.
    const onFirstGesture = () => {
      unlockSound();
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, [unlockSound]);

  useEffect(() => {
    menuApi.stations().then((res) => {
      const activeNames = res.data
        .filter((s: KitchenStation) => s.isActive)
        .map((s: KitchenStation) => s.name);
      setStations(['ALL', ...activeNames]);
    }).catch(() => {
      setStations(['ALL']);
    });
  }, []);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const r = await kitchenApi.queue(station === 'ALL' ? undefined : station);
      setQueue(r.data);

      // Play alert when one or more new batches appear after initial load.
      const currentIds = new Set<string>(r.data.map((b: KitchenBatch) => b.id));
      if (!initializedQueueRef.current) {
        initializedQueueRef.current = true;
      } else {
        const hasNewBatch = [...currentIds].some((id) => !knownBatchIdsRef.current.has(id));
        if (hasNewBatch) {
          playNewOrderAlert();
        }
      }
      knownBatchIdsRef.current = currentIds;
    } finally {
      setLoading(false);
    }
  }, [station, playNewOrderAlert]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Real-time socket events
  useSocket(
    {
      ORDER_FIRED: () => {
        playNewOrderAlert();
        fetchQueue();
      },
      ITEM_COOKING: () => fetchQueue(),
      ITEM_READY: () => fetchQueue(),
      ITEM_SERVED: () => fetchQueue(),
    },
    station === 'ALL' ? ['pos:all'] : ['pos:all', `station:${station}`],
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="p-2 hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Monitor className="w-5 h-5 text-orange-400" />
        <h1 className="font-bold text-lg">Kitchen Display System</h1>

        {/* Station Filter */}
        <div className="flex gap-1.5 ml-4 flex-wrap">
          {stations.map((s) => (
            <button
              key={s}
              onClick={() => setStation(s)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                station === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-400">{queue.length} active batches</span>
          <button
            onClick={fetchQueue}
            className="p-2 hover:bg-gray-700 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {/* Queue Row */}
      <main className="flex-1 p-6">
        {queue.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Monitor className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-xl font-medium">Kitchen is clear</p>
            <p className="text-sm">No active batches{station !== 'ALL' ? ` for ${station}` : ''}</p>
          </div>
        )}

        {queue.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pb-2">
            {queue.map((batch) => (
              <div key={batch.id} className="w-full">
                <KitchenTicket
                  batch={batch}
                  onUpdate={fetchQueue}
                  stationFilter={station === 'ALL' ? undefined : station}
                />
              </div>
            ))}
            {Array.from({ length: Math.max(0, 5 - queue.length) }).map((_, index) => (
              <div key={`placeholder-${index}`} className="w-full p-3 rounded-3xl border border-dashed border-gray-700 bg-gray-800 text-gray-500">
                <div className="h-full flex flex-col justify-center items-center gap-2 text-center">
                  <span className="text-base font-semibold">Waiting for orders</span>
                  <span className="text-[11px] text-gray-400">New batches will appear here</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
