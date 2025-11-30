import React, { useEffect, useRef, useState } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  const pressedKeys = useRef<Set<string>>(new Set());
  // We still need a way to toggle Head mode if the user holds UP, 
  // but since we are bringing back arrow keys, we can map the UP button to a toggle or hold state.
  const [isUpHeld, setIsUpHeld] = useState(false);

  const determineAction = (keys: Set<string>): PlayerAction | null => {
    const isUp = keys.has('ArrowUp') || keys.has('w') || isUpHeld; 
    const isDown = keys.has('ArrowDown') || keys.has('s');
    const isLeft = keys.has('ArrowLeft') || keys.has('a');
    const isRight = keys.has('ArrowRight') || keys.has('d');
    const isPunchLeft = keys.has('z') || keys.has('j');
    const isPunchRight = keys.has('x') || keys.has('k');

    if (isDown) return PlayerAction.BLOCK;
    if (isLeft) return PlayerAction.DODGE_LEFT;
    if (isRight) return PlayerAction.DODGE_RIGHT;

    // Note: Up itself doesn't trigger an action, it modifies punches.
    // But if we just press Up, maybe we want to visualize it? 
    // For now, logic stays: Up + Punch = Head Punch.

    if (isPunchLeft) return isUp ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY;
    if (isPunchRight) return isUp ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY;

    return null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      pressedKeys.current.add(e.key);
      const action = determineAction(pressedKeys.current);
      if (action) onAction(action);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.key);
      if (e.key === 'ArrowDown' || e.key === 's') onReleaseBlock();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onAction, onReleaseBlock, isUpHeld]);

  // Prevent default touch behavior helper
  const prevent = (e: React.TouchEvent) => {
    // e.preventDefault(); // We handle this in individual handlers now to be safe
  };

  const btnBase = "relative flex items-center justify-center rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 transition-all border-2 touch-none select-none cursor-pointer active:bg-opacity-80";
  const btnGray = "bg-slate-700 border-slate-600 text-slate-200";
  const btnRed = "bg-red-800 border-red-600 text-white";
  
  // Dynamic styling for UP button to show it's active (Head Mode)
  const btnUpStyle = isUpHeld 
    ? "bg-yellow-600 border-yellow-400 text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
    : btnGray;

  return (
    <div className="w-full h-full flex justify-between items-end px-4 pb-4 gap-8 pointer-events-auto select-none touch-none max-w-[800px] mx-auto">
      
      {/* LEFT SIDE: WIDE D-PAD */}
      <div className="relative w-48 h-48 flex items-center justify-center">
         {/* UP (Head Aim) */}
         <button 
            className={`${btnBase} ${btnUpStyle} w-16 h-16 absolute top-0 left-1/2 -translate-x-1/2`}
            onTouchStart={(e) => { e.preventDefault(); setIsUpHeld(true); }}
            onTouchEnd={(e) => { e.preventDefault(); setIsUpHeld(false); }}
            onMouseDown={() => setIsUpHeld(true)}
            onMouseUp={() => setIsUpHeld(false)}
            onMouseLeave={() => setIsUpHeld(false)}
         >
            <ChevronUp size={32} />
            <span className="absolute -top-4 text-[8px] font-bold text-yellow-400 tracking-widest">HEAD</span>
         </button>

         {/* LEFT (Dodge) - Moved further left for "Wider" feel */}
         <button 
            className={`${btnBase} ${btnGray} w-16 h-16 absolute left-0 top-1/2 -translate-y-1/2`}
            onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_LEFT); }}
         >
            <ChevronLeft size={32}/>
         </button>

         {/* RIGHT (Dodge) - Moved further right */}
         <button 
            className={`${btnBase} ${btnGray} w-16 h-16 absolute right-0 top-1/2 -translate-y-1/2`}
            onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_RIGHT); }}
         >
            <ChevronRight size={32}/>
         </button>

         {/* DOWN (Block) */}
         <button 
            className={`${btnBase} ${btnGray} w-16 h-16 absolute bottom-0 left-1/2 -translate-x-1/2`}
            onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.BLOCK); }}
            onTouchEnd={(e) => { e.preventDefault(); onReleaseBlock(); }}
         >
             <ChevronDown size={32}/>
             <span className="absolute -bottom-4 text-[8px] font-bold text-blue-400 tracking-widest">BLOCK</span>
         </button>
         
         {/* Center D-Pad Decor */}
         <div className="w-6 h-6 bg-slate-800 rounded-full absolute z-[-1]"></div>
      </div>

      {/* RIGHT SIDE: ATTACKS */}
      <div className="relative w-40 h-40 flex items-center justify-center rotate-12">
         {/* Left Punch (Left Top) */}
         <button 
           className={`${btnBase} ${btnRed} w-20 h-20 rounded-full absolute left-0 top-2 border-4`}
           onTouchStart={(e) => { e.preventDefault(); onAction(isUpHeld ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY); }}
         >
           <Swords size={28} className="rotate-90"/>
           <span className="absolute bottom-2 text-[8px] font-bold opacity-70">L</span>
         </button>
         
         {/* Right Punch (Right Bottom) */}
         <button 
            className={`${btnBase} ${btnRed} w-20 h-20 rounded-full absolute right-0 bottom-2 border-4`}
            onTouchStart={(e) => { e.preventDefault(); onAction(isUpHeld ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY); }}
        >
            <Swords size={28} className="rotate-90 scale-x-[-1]"/>
            <span className="absolute bottom-2 text-[8px] font-bold opacity-70">R</span>
        </button>
      </div>
    </div>
  );
};

export default Controls;
