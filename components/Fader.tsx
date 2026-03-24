
import React from 'react';

interface FaderProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  channelId: number;
}

const REAPER_FADER_POINTS = [
  { x: 0, y: -150 },
  { x: 108, y: -128.7 },
  { x: 193, y: -109.7 },
  { x: 611, y: -79.8 },
  { x: 1212, y: -61.9 },
  { x: 2626, y: -41.6 },
  { x: 4587, y: -27 },
  { x: 5145, y: -24 },
  { x: 6261, y: -18.6 },
  { x: 6385, y: -18 },
  { x: 6831, y: -16.1 },
  { x: 8524, y: -10.7 },
  { x: 8881, y: -8.66 },
  { x: 9653, y: -6.17 },
  { x: 11733, y: 0 },
  { x: 12508, y: 2.11 },
  { x: 13025, y: 3.54 },
  { x: 13283, y: 4.2 },
  { x: 14368, y: 7.03 },
  { x: 15995, y: 11.1 },
  { x: 16383, y: 12 }
];

const getReaperDb = (val: number) => {
  if (val <= 0) return '-∞';
  
  for (let i = 0; i < REAPER_FADER_POINTS.length - 1; i++) {
    const p1 = REAPER_FADER_POINTS[i];
    const p2 = REAPER_FADER_POINTS[i + 1];
    
    if (val >= p1.x && val <= p2.x) {
      const t = (val - p1.x) / (p2.x - p1.x);
      const db = p1.y + t * (p2.y - p1.y);
      if (db < -140) return '-∞';
      // Use 2 decimal places for better precision as requested
      return db.toFixed(2);
    }
  }
  return '12.00';
};

const Fader: React.FC<FaderProps> = ({ value, onChange, label, channelId }) => {
  return (
    <div className="flex flex-col items-center h-full w-full bg-gradient-to-b from-zinc-900/50 to-black p-1 lg:p-2">
      {/* Label simplificado sin OLED ni números */}
      <div className="w-full text-center py-2 mb-1 lg:mb-4 landscape:mb-1">
        <div className="font-black truncate px-1 text-zinc-500 text-[9px] lg:text-[11px] landscape:text-[8px] tracking-tight uppercase">
          {label}
        </div>
      </div>

      <div className="relative flex-grow flex justify-center items-center w-full py-2 lg:py-4 landscape:py-1 touch-none">
        {/* dB Scale Minimalista - Calibrada con interpolación real de Reaper */}
        <div className="absolute left-0.5 lg:left-1.5 h-[calc(100%-48px)] sm:h-[calc(100%-38px)] top-[24px] sm:top-[19px] w-4 text-[5px] lg:text-[6px] text-zinc-700 pointer-events-none font-bold opacity-50">
          <span className="absolute right-0" style={{ top: '0%' }}>+12</span>
          <span className="absolute right-0" style={{ top: '28.4%' }}>0</span>
          <span className="absolute right-0" style={{ top: '50.1%' }}>-12</span>
          <span className="absolute right-0" style={{ top: '68.6%' }}>-24</span>
          <span className="absolute right-0" style={{ top: '86%' }}>-48</span>
          <span className="absolute right-0" style={{ top: '100%' }}>-∞</span>
        </div>

        <div className="fader-track rounded-full"></div>
        <input
          type="range"
          min="0"
          max="16383"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          onDoubleClick={() => onChange(11733)}
          className="absolute appearance-none bg-transparent h-full w-16 lg:w-14 cursor-pointer z-10 touch-pan-y"
          style={{ 
            writingMode: 'vertical-lr', 
            direction: 'rtl',
            WebkitAppearance: 'none'
          }}
        />
      </div>
      
      <div className="mt-1 lg:mt-2 landscape:mt-0.5 w-full grid grid-cols-2 gap-1">
        <button className="bg-zinc-900 hover:bg-zinc-800 text-[7px] lg:text-[8px] landscape:text-[6px] font-black py-1 lg:py-2 landscape:py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase">SEL</button>
        <button className="bg-zinc-900 hover:bg-zinc-800 text-[7px] lg:text-[8px] landscape:text-[6px] font-black py-1 lg:py-2 landscape:py-0.5 rounded border border-zinc-800 text-zinc-500 uppercase">CLR</button>
      </div>
    </div>
  );
};

export default Fader;
