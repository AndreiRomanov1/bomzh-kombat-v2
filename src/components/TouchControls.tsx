import { useCallback, useRef, useState } from 'react';
import type { InputState } from '../game/engine';

type Props = {
  onPress: (key: keyof InputState, down: boolean) => void;
};

function useHold(onPress: Props['onPress'], key: keyof InputState) {
  const [active, setActive] = useState(false);
  const idRef = useRef<number | null>(null);

  const down = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    idRef.current = e.pointerId;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setActive(true);
    onPress(key, true);
  }, [key, onPress]);

  const up = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    idRef.current = null;
    setActive(false);
    onPress(key, false);
  }, [key, onPress]);

  return {
    active,
    handlers: {
      onPointerDown: down,
      onPointerUp: up,
      onPointerCancel: up,
      onPointerLeave: up,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
  };
}

function Btn({
  onPress, k, label, sub, className = '', size = 'h-16 w-16',
}: { onPress: Props['onPress']; k: keyof InputState; label: string; sub?: string; className?: string; size?: string }) {
  const { active, handlers } = useHold(onPress, k);
  return (
    <button
      {...handlers}
      className={`touch-btn ${active ? 'pressed' : ''} ${size} ${className} flex select-none flex-col items-center justify-center rounded-full text-[11px] leading-none`}
    >
      <span className="text-[13px]">{label}</span>
      {sub && <span className="mt-0.5 text-[8px] opacity-70">{sub}</span>}
    </button>
  );
}

export default function TouchControls({ onPress }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* D-pad */}
      <div className="pointer-events-auto absolute bottom-3 left-3 grid grid-cols-3 grid-rows-3 gap-1.5 sm:bottom-6 sm:left-6">
        <div />
        <Btn onPress={onPress} k="up" label="▲" sub="ПРЫЖОК" size="h-14 w-14" />
        <div />
        <Btn onPress={onPress} k="left" label="◀" size="h-14 w-14" />
        <Btn onPress={onPress} k="down" label="▼" sub="СЕСТЬ" size="h-14 w-14" />
        <Btn onPress={onPress} k="right" label="▶" size="h-14 w-14" />
        <div />
      </div>

      {/* Action buttons */}
      <div className="pointer-events-auto absolute right-3 bottom-3 grid grid-cols-2 gap-2 sm:right-6 sm:bottom-6">
        <Btn onPress={onPress} k="block" label="БЛОК" size="h-14 w-14" className="text-[10px]" />
        <Btn onPress={onPress} k="special" label="СПЕЦ" size="h-14 w-14" className="text-[10px] !border-amber-300/80" />
        <Btn onPress={onPress} k="punch" label="УДАР" size="h-16 w-16" className="text-[10px]" />
        <Btn onPress={onPress} k="kick" label="НОГА" size="h-16 w-16" className="text-[10px]" />
      </div>
    </div>
  );
}
