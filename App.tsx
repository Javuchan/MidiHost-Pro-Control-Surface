
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ControlMode, MidiPort, ChannelData } from './types';
import Fader from './components/Fader';
import Knob from './components/Knob';
import Transport from './components/Transport';

const CHANNELS_COUNT = 8;

const INITIAL_CHANNELS: ChannelData[] = Array.from({ length: CHANNELS_COUNT }, (_, i) => ({
  id: i,
  name: `Track ${i + 1}`,
  fader: 11733, // 0 dB (Calibrated 14-bit for Reaper MCU)
  pan: 64,
  mute: false,
  solo: false,
  rec: false
}));

const App: React.FC = () => {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<MidiPort[]>([]);
  const [outputs, setOutputs] = useState<MidiPort[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const [channels, setChannels] = useState<ChannelData[]>(INITIAL_CHANNELS);
  const [meterLevels, setMeterLevels] = useState<number[]>(new Array(CHANNELS_COUNT).fill(0));
  const [mode, setMode] = useState<ControlMode>(ControlMode.MCU);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  
  const [midiInActive, setMidiInActive] = useState(false);
  const [midiOutActive, setMidiOutActive] = useState(false);
  const [isReaperSynced, setIsReaperSynced] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const [roomCode, setRoomCode] = useState<string>(() => Math.floor(1000 + Math.random() * 9000).toString());
  const [isRemoteMode, setIsRemoteMode] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [showRemoteSetup, setShowRemoteSetup] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const isDragging = useRef<boolean[]>(new Array(CHANNELS_COUNT).fill(false));
  const lastSentValues = useRef<number[]>(new Array(CHANNELS_COUNT).fill(-1));
  const syncTimeout = useRef<any>(null);
  const activityTimeoutIn = useRef<any>(null);
  const activityTimeoutOut = useRef<any>(null);

  const updateChannelRef = useRef<any>(null);
  const handleTransportRef = useRef<any>(null);
  const stateRef = useRef({ channels, meterLevels, isPlaying, isRecording, isRemoteMode, roomCode });

  useEffect(() => {
    stateRef.current = { channels, meterLevels, isPlaying, isRecording, isRemoteMode, roomCode };
  }, [channels, meterLevels, isPlaying, isRecording, isRemoteMode, roomCode]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join-room', stateRef.current.roomCode);
      if (stateRef.current.isRemoteMode) {
        socket.emit('request-state', stateRef.current.roomCode);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('remote-state-update', (state) => {
      if (stateRef.current.isRemoteMode) {
        setChannels(prev => {
          return state.channels.map((ch: ChannelData, i: number) => {
            if (isDragging.current[i]) {
              return { ...ch, fader: prev[i].fader };
            }
            return ch;
          });
        });
        setMeterLevels(state.meterLevels);
        setIsPlaying(state.isPlaying);
        setIsRecording(state.isRecording);
      }
    });

    socket.on('state-requested', () => {
      if (!stateRef.current.isRemoteMode) {
        socket.emit('host-state-update', {
          roomCode: stateRef.current.roomCode,
          state: { 
            channels: stateRef.current.channels, 
            meterLevels: stateRef.current.meterLevels, 
            isPlaying: stateRef.current.isPlaying, 
            isRecording: stateRef.current.isRecording 
          }
        });
      }
    });

    socket.on('host-control-change', (change) => {
      if (!stateRef.current.isRemoteMode) {
        if (change.type === 'channel' && updateChannelRef.current) {
          updateChannelRef.current(change.id, change.updates, true);
        } else if (change.type === 'transport' && handleTransportRef.current) {
          handleTransportRef.current(change.action);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Run once on mount

  const lastBroadcastTime = useRef(0);
  useEffect(() => {
    if (!isRemoteMode && socketRef.current) {
      const now = Date.now();
      if (now - lastBroadcastTime.current > 50) {
        socketRef.current.emit('host-state-update', {
          roomCode,
          state: { channels, meterLevels, isPlaying, isRecording }
        });
        lastBroadcastTime.current = now;
      } else {
        const timer = setTimeout(() => {
          socketRef.current?.emit('host-state-update', {
            roomCode,
            state: { channels, meterLevels, isPlaying, isRecording }
          });
          lastBroadcastTime.current = Date.now();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [channels, meterLevels, isPlaying, isRecording, isRemoteMode, roomCode]);

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: true }).then(
        (access) => {
          setMidiAccess(access);
          updatePorts(access);
          access.onstatechange = () => updatePorts(access);
        },
        () => alert('Error: MIDI no disponible.')
      );
    }
  }, []);

  const updatePorts = (access: MIDIAccess) => {
    const inputPorts: MidiPort[] = [];
    const outputPorts: MidiPort[] = [];
    access.inputs.forEach((p) => inputPorts.push({ id: p.id, name: p.name || 'In', manufacturer: '' }));
    access.outputs.forEach((p) => outputPorts.push({ id: p.id, name: p.name || 'Out', manufacturer: '' }));
    setInputs(inputPorts);
    setOutputs(outputPorts);
  };

  const flashMidiOut = () => {
    setMidiOutActive(true);
    clearTimeout(activityTimeoutOut.current);
    activityTimeoutOut.current = setTimeout(() => setMidiOutActive(false), 50);
  };

  const flashMidiIn = () => {
    setMidiInActive(true);
    clearTimeout(activityTimeoutIn.current);
    activityTimeoutIn.current = setTimeout(() => setMidiInActive(false), 50);
    setIsReaperSynced(true);
    clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => setIsReaperSynced(false), 5000);
  };

  const sendMidi = useCallback((status: number, d1: number, d2: number) => {
    if (!midiAccess || !selectedOutput) return;
    const output = midiAccess.outputs.get(selectedOutput);
    if (output) {
      output.send([status, d1, d2]);
      flashMidiOut();
    }
  }, [midiAccess, selectedOutput]);

  const sendMomentaryButton = useCallback((note: number) => {
    sendMidi(0x90, note, 127); // Press
    setTimeout(() => sendMidi(0x90, note, 0), 50); // Release
  }, [sendMidi]);

  useEffect(() => {
    if (!midiAccess || !selectedInput) {
        setIsReaperSynced(false);
        return;
    }
    const input = midiAccess.inputs.get(selectedInput);
    if (!input) return;

    const onMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 2) return;
      const status = data[0];
      flashMidiIn();

      if (status === 0xF0 && data.length > 7) {
        if (data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x66 && data[5] === 0x12) {
          const offset = data[6];
          const text = String.fromCharCode(...Array.from(data.slice(7, data.length - 1)));
          setChannels(prev => {
            const next = [...prev];
            for (let i = 0; i < CHANNELS_COUNT; i++) {
              const start = i * 7;
              if (offset <= start + 6 && offset + text.length > start) {
                const charStart = Math.max(0, start - offset);
                const charEnd = Math.min(text.length, start + 7 - offset);
                const part = text.substring(charStart, charEnd).trim();
                if (part && part !== next[i].name) next[i] = { ...next[i], name: part };
              }
            }
            return next;
          });
        }
        return;
      }

      const d1 = data[1];
      const d2 = data.length > 2 ? data[2] : 0;
      const type = status & 0xf0;
      const channel = status & 0x0f;

      if (type === 0xD0) {
        if (channel < CHANNELS_COUNT) {
          setMeterLevels(prev => {
            const next = [...prev];
            next[channel] = d1;
            return next;
          });
        }
        return;
      }

      if (type === 0xE0) {
        if (channel < CHANNELS_COUNT && !isDragging.current[channel]) {
          const val14 = (d2 << 7) | d1; // Reconstruct 14-bit value
          setChannels(prev => {
            if (prev[channel].fader === val14) return prev;
            const next = [...prev];
            next[channel] = { ...next[channel], fader: val14 };
            return next;
          });
        }
      }
      
      else if (type === 0x90) {
        if (d1 >= 0x10 && d1 <= 0x17) setChannels(p => p.map((ch, i) => i === (d1 - 0x10) ? { ...ch, mute: d2 > 0 } : ch));
        if (d1 >= 0x08 && d1 <= 0x0F) setChannels(p => p.map((ch, i) => i === (d1 - 0x08) ? { ...ch, solo: d2 > 0 } : ch));
        if (d1 >= 0x00 && d1 <= 0x07) setChannels(p => p.map((ch, i) => i === (d1 - 0x00) ? { ...ch, rec: d2 > 0 } : ch));
        if (d1 === 0x5E) setIsPlaying(d2 > 0);
        if (d1 === 0x5F) setIsRecording(d2 > 0);
      }
    };

    input.onmidimessage = onMessage;
    return () => { input.onmidimessage = null; };
  }, [midiAccess, selectedInput]);

  const updateChannel = useCallback((id: number, updates: Partial<ChannelData>, fromRemote = false) => {
    if (updates.fader !== undefined) {
      if (!fromRemote) isDragging.current[id] = true;
      if (lastSentValues.current[id] !== updates.fader) {
        lastSentValues.current[id] = updates.fader;
        if (!isRemoteMode) {
          const lsb = updates.fader & 0x7F;
          const msb = (updates.fader >> 7) & 0x7F;
          sendMidi(0xE0 + id, lsb, msb);
        }
      }
      if (!fromRemote) {
        const timerId = (window as any)[`fader_timer_${id}`];
        if (timerId) clearTimeout(timerId);
        (window as any)[`fader_timer_${id}`] = setTimeout(() => { isDragging.current[id] = false; }, 200);
      }
    }
    
    if (!isRemoteMode) {
      if (updates.mute !== undefined) sendMomentaryButton(0x10 + id);
      if (updates.solo !== undefined) sendMomentaryButton(0x08 + id);
      if (updates.rec !== undefined) sendMomentaryButton(0x00 + id);
      if (updates.pan !== undefined) sendMidi(0xB0, 16 + id, updates.pan);
    }

    if (updates.fader !== undefined || updates.pan !== undefined || updates.mute !== undefined || updates.solo !== undefined || updates.rec !== undefined) {
        setChannels(prev => prev.map(ch => ch.id === id ? { ...ch, ...updates } : ch));
    }

    if (isRemoteMode && !fromRemote && socketRef.current) {
      socketRef.current.emit('remote-control-change', {
        roomCode,
        change: { type: 'channel', id, updates }
      });
    }
  }, [isRemoteMode, roomCode, sendMidi, sendMomentaryButton]);

  const handleTransport = useCallback((action: string) => {
    if (isRemoteMode) {
      socketRef.current?.emit('remote-control-change', {
        roomCode,
        change: { type: 'transport', action }
      });
      return;
    }

    if (action === 'play') { setIsPlaying(true); sendMomentaryButton(0x5E); }
    if (action === 'stop') { setIsPlaying(false); setIsRecording(false); sendMomentaryButton(0x5D); }
    if (action === 'rec') { setIsRecording(r => !r); sendMomentaryButton(0x5F); }
    if (action === 'prev') sendMomentaryButton(0x5B);
    if (action === 'next') sendMomentaryButton(0x5C);
  }, [isRemoteMode, roomCode, sendMomentaryButton]);

  useEffect(() => {
    updateChannelRef.current = updateChannel;
    handleTransportRef.current = handleTransport;
  }, [updateChannel, handleTransport]);

  const getInPortName = () => inputs.find(p => p.id === selectedInput)?.name || 'off';
  const getOutPortName = () => outputs.find(p => p.id === selectedOutput)?.name || 'off';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0c0c0c] text-slate-200 font-sans">
      <header className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-2 sm:py-3 landscape:py-1 bg-[#181818] border-b border-black shadow-2xl z-10 gap-3 landscape:gap-1">
        <div className="flex items-center gap-3 landscape:gap-2 self-start sm:self-auto">
          <div className="w-10 h-10 landscape:w-8 landscape:h-8 bg-gradient-to-br from-[#526d4f] to-[#1a2b19] rounded-xl flex items-center justify-center text-white shadow-lg border border-[#ffffff10]">
            <i className="fas fa-sliders-h text-lg landscape:text-sm"></i>
          </div>
          <div>
            <h1 className="text-xl landscape:text-lg font-black tracking-tighter uppercase italic leading-none">Reaper<span className="text-[#526d4f]">Host</span></h1>
            <div className="flex items-center gap-2 mt-1 landscape:mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isReaperSynced ? 'bg-cyan-400' : 'bg-zinc-800'}`}></div>
              <p className={`text-[8px] font-black tracking-widest uppercase ${isReaperSynced ? 'text-cyan-400' : 'text-zinc-600'}`}>
                {isReaperSynced ? 'SYNCED' : 'LINK'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end w-full sm:w-auto">
          {!isRemoteMode && (
            <div className="flex gap-2">
              <select className="bg-black text-[10px] p-1.5 landscape:p-1 border border-[#333] rounded-lg w-28 sm:w-36 landscape:w-24 outline-none hover:border-[#526d4f]" value={selectedInput} onChange={e => setSelectedInput(e.target.value)} disabled={isRemoteMode}>
                <option value="">In: (None)</option>
                {inputs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="bg-black text-[10px] p-1.5 landscape:p-1 border border-[#333] rounded-lg w-28 sm:w-36 landscape:w-24 outline-none hover:border-[#526d4f]" value={selectedOutput} onChange={e => setSelectedOutput(e.target.value)} disabled={isRemoteMode}>
                <option value="">Out: (None)</option>
                {outputs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={() => setShowRemoteSetup(true)} className={`p-2 landscape:p-1.5 rounded-lg transition-all border ${isRemoteMode ? 'bg-cyan-900 border-cyan-700 text-cyan-400' : 'bg-[#222] hover:bg-[#333] border-[#333] text-[#526d4f]'}`}>
            <i className="fas fa-mobile-alt landscape:text-sm"></i>
          </button>
          <button onClick={() => setShowHelper(true)} className="bg-[#222] hover:bg-[#333] text-[#526d4f] p-2 landscape:p-1.5 rounded-lg transition-all border border-[#333]">
            <i className="fas fa-info-circle landscape:text-sm"></i>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col landscape:flex-row lg:flex-row p-1 lg:p-3 gap-1 lg:gap-3 overflow-hidden bg-[#080808]">
        <div className="flex-grow flex bg-[#121212] rounded-xl lg:rounded-2xl border border-[#222] shadow-inner overflow-x-auto custom-scrollbar overflow-y-hidden snap-x snap-mandatory">
          {channels.map((ch) => (
            <div key={ch.id} className="min-w-[100px] lg:min-w-[120px] snap-start border-r border-black flex flex-col last:border-0 hover:bg-[#161616] transition-colors relative">
               <div className="p-1.5 lg:p-3 landscape:p-1 bg-black/40 flex flex-col items-center gap-1.5 lg:gap-3 landscape:gap-1 border-b border-black">
                 <Knob label="PAN" value={ch.pan} onChange={v => updateChannel(ch.id, { pan: v })} />
                 <div className="grid grid-cols-2 gap-1.5 landscape:gap-1 w-full">
                   <button onClick={() => updateChannel(ch.id, { solo: !ch.solo })} className={`text-[10px] lg:text-[12px] landscape:text-[8px] font-black py-1 lg:py-2 landscape:py-0.5 rounded-md border transition-all ${ch.solo ? 'bg-yellow-600 border-yellow-400 text-black' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>S</button>
                   <button onClick={() => updateChannel(ch.id, { mute: !ch.mute })} className={`text-[10px] lg:text-[12px] landscape:text-[8px] font-black py-1 lg:py-2 landscape:py-0.5 rounded-md border transition-all ${ch.mute ? 'bg-red-700 border-red-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>M</button>
                 </div>
                 <button onClick={() => updateChannel(ch.id, { rec: !ch.rec })} className={`w-full text-[9px] lg:text-[11px] landscape:text-[7px] font-black py-1.5 lg:py-2.5 landscape:py-0.5 rounded-md border transition-all ${ch.rec ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-[#0a0a0a] border-zinc-800 text-red-900/40'}`}>REC</button>
               </div>
               <div className="flex-grow relative flex">
                 <Fader channelId={ch.id} label={ch.name} value={ch.fader} onChange={v => updateChannel(ch.id, { fader: v })} />
                 <div className="w-1.5 lg:w-2 bg-black absolute right-1 lg:right-1.5 top-8 bottom-8 rounded-full overflow-hidden flex flex-col justify-end">
                    <div className="bg-gradient-to-t from-green-500 via-yellow-500 to-red-500 w-full transition-all duration-75" style={{ height: `${(meterLevels[ch.id] / 127) * 100}%` }}></div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="bg-[#050505] border-t border-[#181818] px-2 lg:px-4 py-2 flex flex-col sm:flex-row justify-between items-center text-[9px] landscape:text-[8px] font-black uppercase z-20 gap-3 lg:gap-4">
        <div className="flex gap-2 lg:gap-4 items-center w-full sm:w-1/3 justify-center sm:justify-start">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">IN:</span>
            <div className={`w-2 h-2 rounded-full ${midiInActive ? 'bg-[#526d4f]' : 'bg-zinc-900'}`}></div>
            <span className="text-zinc-500 font-mono truncate max-w-[60px] lg:max-w-[80px]">{getInPortName()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">OUT:</span>
            <div className={`w-2 h-2 rounded-full ${midiOutActive ? 'bg-cyan-500' : 'bg-zinc-900'}`}></div>
            <span className="text-zinc-500 font-mono truncate max-w-[60px] lg:max-w-[80px]">{getOutPortName()}</span>
          </div>
        </div>

        <div className="w-full sm:w-1/3 flex justify-center order-first sm:order-none">
          <Transport 
            isPlaying={isPlaying} 
            isRecording={isRecording}
            onPlay={() => handleTransport('play')}
            onStop={() => handleTransport('stop')}
            onRec={() => handleTransport('rec')}
            onPrev={() => handleTransport('prev')}
            onNext={() => handleTransport('next')}
          />
        </div>

        <div className="w-full sm:w-1/3 flex justify-center sm:justify-end items-center gap-4">
           {isRemoteMode && (
             <div className="flex items-center gap-2 text-cyan-500 border border-cyan-900/50 bg-cyan-900/20 px-2 py-1 rounded-md">
               <i className="fas fa-wifi"></i>
               <span>REMOTE: {roomCode}</span>
             </div>
           )}
           <div className="flex items-center gap-2" title={isConnected ? "Server Connected" : "Server Disconnected"}>
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <span className="text-zinc-500 hidden lg:inline">SERVER</span>
           </div>
        </div>
      </footer>

      {showRemoteSetup && (
        <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] max-w-md w-full rounded-3xl border border-[#333] shadow-2xl p-6 sm:p-10 relative overflow-hidden">
            <button onClick={() => setShowRemoteSetup(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
            <h2 className="text-2xl font-black text-[#526d4f] mb-6 uppercase italic flex items-center gap-3"><i className="fas fa-wifi"></i> Remote Connect</h2>
            
            <div className="space-y-6">
              {!isRemoteMode ? (
                <div className="bg-black rounded-2xl border border-zinc-800 p-4 lg:p-5 text-center">
                  <div className="hidden md:block">
                    <p className="text-zinc-400 text-sm mb-2">Host Room Code</p>
                    <div className="text-5xl font-black text-white tracking-widest mb-4">{roomCode}</div>
                    <p className="text-xs text-zinc-500">Open this exact same URL on your phone and enter this code to control Reaper remotely.</p>
                  </div>
                  
                  <div className="mt-0 md:mt-6 pt-0 md:pt-6 border-t-0 md:border-t border-zinc-800">
                    <p className="text-zinc-400 text-sm mb-3 hidden md:block">Or connect to another host:</p>
                    <p className="text-zinc-400 text-sm mb-3 md:hidden">Connect to Host:</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        maxLength={4}
                        placeholder="CODE" 
                        className="bg-[#111] border border-zinc-700 rounded-xl px-4 py-3 text-white font-black tracking-widest text-center w-full outline-none focus:border-[#526d4f]"
                        value={joinCodeInput}
                        onChange={e => setJoinCodeInput(e.target.value.replace(/\D/g, ''))}
                      />
                      <button 
                        onClick={() => {
                          if (joinCodeInput.length === 4) {
                            stateRef.current.isRemoteMode = true;
                            stateRef.current.roomCode = joinCodeInput;
                            socketRef.current?.emit('join-room', joinCodeInput);
                            socketRef.current?.emit('request-state', joinCodeInput);
                            setRoomCode(joinCodeInput);
                            setIsRemoteMode(true);
                            setShowRemoteSetup(false);
                          }
                        }}
                        disabled={joinCodeInput.length !== 4}
                        className="bg-[#526d4f] text-white px-6 rounded-xl font-black disabled:opacity-50"
                      >
                        JOIN
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-black rounded-2xl border border-zinc-800 p-5 text-center">
                  <div className="w-16 h-16 bg-cyan-900/30 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-link text-2xl"></i>
                  </div>
                  <p className="text-zinc-400 text-sm mb-2">Connected as Remote to Room</p>
                  <div className="text-4xl font-black text-white tracking-widest mb-6">{roomCode}</div>
                  
                  <button 
                    onClick={() => {
                      const newCode = Math.floor(1000 + Math.random() * 9000).toString();
                      stateRef.current.isRemoteMode = false;
                      stateRef.current.roomCode = newCode;
                      socketRef.current?.emit('join-room', newCode);
                      setRoomCode(newCode);
                      setIsRemoteMode(false);
                    }}
                    className="w-full border border-red-900/50 text-red-500 py-3 rounded-xl font-black uppercase hover:bg-red-900/20 transition-colors"
                  >
                    Disconnect & Become Host
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showHelper && (
        <div className="absolute inset-0 bg-black/98 backdrop-blur-2xl z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] max-w-4xl w-full rounded-3xl border border-[#333] shadow-2xl p-6 sm:p-10 relative overflow-hidden overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowHelper(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><i className="fas fa-times text-2xl"></i></button>
            <h2 className="text-3xl font-black text-[#526d4f] mb-8 uppercase italic flex items-center justify-center gap-3"><i className="fas fa-project-diagram"></i> Setup Guide</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative">
              {/* Connection Lines for Desktop */}
              <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-[#526d4f]/0 via-[#526d4f]/50 to-[#526d4f]/0 z-0"></div>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 rounded-full bg-[#526d4f]/20 text-[#526d4f] flex items-center justify-center text-2xl mb-4 shadow-[0_0_15px_rgba(82,109,79,0.3)]">
                  <i className="fas fa-plug"></i>
                </div>
                <h3 className="text-white font-black text-lg mb-2 uppercase tracking-wide">1. Virtual MIDI</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Install a virtual MIDI cable like <strong>loopMIDI</strong> (Windows) or use <strong>IAC Driver</strong> (Mac).</p>
              </div>
              
              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 rounded-full bg-[#526d4f]/20 text-[#526d4f] flex items-center justify-center text-2xl mb-4 shadow-[0_0_15px_rgba(82,109,79,0.3)]">
                  <i className="fas fa-exchange-alt"></i>
                </div>
                <h3 className="text-white font-black text-lg mb-2 uppercase tracking-wide">2. Select Ports</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">In the top right corner of this app, select your newly created virtual MIDI Input and Output ports.</p>
              </div>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 rounded-full bg-[#526d4f]/20 text-[#526d4f] flex items-center justify-center text-2xl mb-4 shadow-[0_0_15px_rgba(82,109,79,0.3)]">
                  <i className="fas fa-sliders-h"></i>
                </div>
                <h3 className="text-white font-black text-lg mb-2 uppercase tracking-wide">3. Reaper Setup</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">In Reaper: <span className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">Preferences &gt; Control/OSC/Web</span>. Add <span className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">Mackie Control Universal</span>.</p>
              </div>

              <div className="bg-black/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 rounded-full bg-[#526d4f]/20 text-[#526d4f] flex items-center justify-center text-2xl mb-4 shadow-[0_0_15px_rgba(82,109,79,0.3)]">
                  <i className="fas fa-check-circle"></i>
                </div>
                <h3 className="text-white font-black text-lg mb-2 uppercase tracking-wide">4. Match Ports</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Set the MIDI input and output in Reaper's Mackie Control settings to match the ports you selected here.</p>
              </div>
            </div>

            <div className="bg-cyan-900/10 border border-cyan-900/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 mb-8">
              <div className="w-16 h-16 rounded-full bg-cyan-900/30 text-cyan-500 flex items-center justify-center text-2xl flex-shrink-0">
                <i className="fas fa-mobile-alt"></i>
              </div>
              <div>
                <h3 className="text-cyan-400 font-black text-lg mb-1 uppercase tracking-wide">Remote Control</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">Click the mobile icon in the top right to get a room code. Open this app on your phone, click the mobile icon, and enter the code to control Reaper remotely over Wi-Fi.</p>
              </div>
            </div>

            <button onClick={() => setShowHelper(false)} className="w-full bg-[#526d4f] hover:bg-[#63825f] transition-colors py-4 rounded-2xl font-black uppercase tracking-widest text-white shadow-lg text-lg">Start Mixing</button>
          </div>
        </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #526d4f; }`}</style>
    </div>
  );
};

export default App;
