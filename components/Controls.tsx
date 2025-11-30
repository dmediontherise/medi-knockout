import React, { useEffect, useRef, useState } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  const pressedKeys = useRef<Set<string>>(new Set());
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

  // Helper to prevent default touch actions
  const handleTouch = (e: React.TouchEvent, action: () => void) => {
    if (e.cancelable) e.preventDefault();
    action();
  };

  const btnBase = "relative flex items-center justify-center rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 transition-all border-2 touch-none select-none cursor-pointer active:bg-opacity-80";
  const btnGray = "bg-slate-700 border-slate-500 text-slate-200";
  const btnRed = "bg-red-800 border-red-600 text-white";
  
  const btnUpStyle = isUpHeld 
    ? "bg-yellow-600 border-yellow-400 text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]" 
    : btnGray;

  // Responsive sizes using VW for optimal mobile portrait fit
  // D-Pad Area: ~50% width
  // Action Area: ~45% width
  // Buttons: ~16-18vw (approx 60-70px on generic phone)
  
  return (
    <div className="w-full h-full flex justify-between items-end px-2 pb-4 pointer-events-auto select-none touch-none max-w-[800px] mx-auto">
      
      {/* LEFT SIDE: EXPANDED D-PAD */}
      {/* Using explicit dimensions to ensure spacing */}
      <div className="relative w-[50vw] h-[50vw] max-w-[240px] max-h-[240px] flex-shrink-0">
         {/* UP (Head Aim) */}
         <button 
            className={`${btnBase} ${btnUpStyle} w-[16vw] h-[16vw] max-w-[80px] max-h-[80px] absolute top-0 left-1/2 -translate-x-1/2`}
            onTouchStart={(e) => handleTouch(e, () => setIsUpHeld(true))}
            onTouchEnd={(e) => handleTouch(e, () => setIsUpHeld(false))}
            onMouseDown={() => setIsUpHeld(true)}
            onMouseUp={() => setIsUpHeld(false)}
            onMouseLeave={() => setIsUpHeld(false)}
         >
            <ChevronUp className="w-8 h-8 md:w-10 md:h-10" />
            <span className="absolute -top-5 text-[10px] font-bold text-yellow-400 tracking-widest drop-shadow-md">HEAD</span>
         </button>

         {/* LEFT (Dodge) */}
         <button 
            className={`${btnBase} ${btnGray} w-[16vw] h-[16vw] max-w-[80px] max-h-[80px] absolute left-0 top-1/2 -translate-y-1/2`}
            onTouchStart={(e) => handleTouch(e, () => onAction(PlayerAction.DODGE_LEFT))}
         >
            <ChevronLeft className="w-8 h-8 md:w-10 md:h-10"/>
         </button>

         {/* RIGHT (Dodge) */}
         <button 
            className={`${btnBase} ${btnGray} w-[16vw] h-[16vw] max-w-[80px] max-h-[80px] absolute right-0 top-1/2 -translate-y-1/2`}
            onTouchStart={(e) => handleTouch(e, () => onAction(PlayerAction.DODGE_RIGHT))}
         >
            <ChevronRight className="w-8 h-8 md:w-10 md:h-10"/>
         </button>

         {/* DOWN (Block) */}
         <button 
            className={`${btnBase} ${btnGray} w-[16vw] h-[16vw] max-w-[80px] max-h-[80px] absolute bottom-0 left-1/2 -translate-x-1/2`}
            onTouchStart={(e) => handleTouch(e, () => onAction(PlayerAction.BLOCK))}
            onTouchEnd={(e) => handleTouch(e, () => onReleaseBlock())}
         >
             <ChevronDown className="w-8 h-8 md:w-10 md:h-10"/>
             <span className="absolute -bottom-5 text-[10px] font-bold text-blue-400 tracking-widest drop-shadow-md">BLOCK</span>
         </button>
         
         {/* Center Decor */}
         <div className="w-4 h-4 bg-slate-800/50 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      </div>

      {/* RIGHT SIDE: LARGE ACTION BUTTONS */}
      <div className="relative w-[42vw] h-[42vw] max-w-[200px] max-h-[200px] flex-shrink-0 rotate-6 mb-4 mr-2">
         {/* Left Punch (Top Left) */}
         <button 
           className={`${btnBase} ${btnRed} w-[20vw] h-[20vw] max-w-[90px] max-h-[90px] rounded-full absolute left-0 top-0 border-4`}
           onTouchStart={(e) => handleTouch(e, () => onAction(isUpHeld ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY))}
         >
           <Swords className="w-8 h-8 md:w-12 md:h-12 rotate-90"/>
           <span className="absolute bottom-3 text-[10px] font-bold opacity-80">L</span>
         </button>
         
         {/* Right Punch (Bottom Right) */}
         <button 
            className={`${btnBase} ${btnRed} w-[20vw] h-[20vw] max-w-[90px] max-h-[90px] rounded-full absolute right-0 bottom-0 border-4`}
            onTouchStart={(e) => handleTouch(e, () => onAction(isUpHeld ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY))}
        >
            <Swords className="w-8 h-8 md:w-12 md:h-12 rotate-90 scale-x-[-1]"/>
            <span className="absolute bottom-3 text-[10px] font-bold opacity-80">R</span>
        </button>
      </div>
    </div>
  );
};

export default Controls;