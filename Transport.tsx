
import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
}

const Knob: React.FC<KnobProps> = ({ value, onChange, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startVal.current = value;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = startY.current - e.clientY;
      const newVal = Math.max(0, Math.min(127, startVal.current + delta));
      onChange(Math.round(newVal));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const delta = startY.current - e.touches[0].clientY;
      const newVal = Math.max(0, Math.min(127, startVal.current + delta));
      onChange(Math.round(newVal));
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, onChange]);

  const rotation = (value / 127) * 270 - 135;

  const getDisplayValue = () => {
    if (label !== 'PAN') return value;
    if (value === 64) return '0';
    if (value === 0) return '-∞';
    if (value === 127) return '+∞';
    if (value < 64) return `L${Math.round(((64 - value) / 64) * 100)}`;
    return `R${Math.round(((value - 64) / 63) * 100)}`;
  };

  return (
    <div className="flex flex-col items-center gap-1 group touch-none">
      <div 
        className="relative w-10 h-10 lg:w-12 lg:h-12 landscape:w-8 landscape:h-8 rounded-full bg-slate-800 border-2 border-slate-700 cursor-ns-resize shadow-inner flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => onChange(64)}
      >
        <div 
          className="absolute w-1 h-4 landscape:h-3 bg-cyan-400 rounded-full top-1 transition-transform duration-75"
          style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'bottom center', top: '15%' }}
        />
        <div className="w-8 h-8 landscape:w-6 landscape:h-6 rounded-full bg-slate-900 border border-slate-700 shadow-lg"></div>
      </div>
      <span className="text-[9px] landscape:text-[7px] uppercase font-semibold text-slate-400 group-hover:text-cyan-400 transition-colors">{label}</span>
      <span className="text-[8px] landscape:text-[6px] oled-display px-1 rounded">{getDisplayValue()}</span>
    </div>
  );
};

export default Knob;
