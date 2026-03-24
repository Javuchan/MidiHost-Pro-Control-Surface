
import React from 'react';

interface TransportProps {
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRec: () => void;
  onPrev: () => void;
  onNext: () => void;
}

const Transport: React.FC<TransportProps> = ({ 
  isPlaying, isRecording, onPlay, onStop, onRec, onPrev, onNext 
}) => {
  return (
    <div className="flex items-center gap-2 lg:gap-4 bg-black/40 px-2 lg:px-4 py-1 lg:py-1.5 rounded-xl border border-white/5 shadow-2xl justify-center">
      <div className="py-1 px-2 lg:px-3 bg-black/60 rounded-md border border-white/5 text-center shadow-inner flex-none">
        <div className="text-[5px] lg:text-[6px] text-zinc-600 uppercase font-black tracking-widest mb-0.5">Timecode</div>
        <div className="oled-display text-[10px] lg:text-[12px] font-mono text-cyan-500/80">00:01:24:12</div>
      </div>
      
      <div className="flex items-center gap-1 lg:gap-2">
        <button onClick={onPrev} className="w-8 h-8 lg:w-10 lg:h-10 rounded-md bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-800 transition-colors"><i className="fas fa-backward text-[10px] lg:text-xs"></i></button>
        <button onClick={onStop} className="w-8 h-8 lg:w-10 lg:h-10 rounded-md bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-300 border border-zinc-800 transition-colors"><i className="fas fa-stop text-[10px] lg:text-xs"></i></button>
        <button onClick={onPlay} className={`w-10 h-10 lg:w-12 lg:h-12 rounded-md flex items-center justify-center border transition-all ${isPlaying ? 'bg-green-600 border-green-400 text-white shadow-lg shadow-green-900/40' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-green-500'}`}><i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xs lg:text-sm`}></i></button>
        <button onClick={onRec} className={`w-8 h-8 lg:w-10 lg:h-10 rounded-md flex items-center justify-center border transition-all ${isRecording ? 'bg-red-600 border-red-400 text-white animate-pulse shadow-lg shadow-red-900/40' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-red-500'}`}><i className="fas fa-circle text-[8px] lg:text-[10px]"></i></button>
        <button onClick={onNext} className="w-8 h-8 lg:w-10 lg:h-10 rounded-md bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-800 transition-colors"><i className="fas fa-forward text-[10px] lg:text-xs"></i></button>
      </div>
    </div>
  );
};

export default Transport;
