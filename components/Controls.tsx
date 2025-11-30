import React, { useEffect, useRef, useState } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords, Shield, Target } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  const pressedKeys = useRef<Set<string>>(new Set());
  const [headMode, setHeadMode] = useState(false);

  const determineAction = (keys: Set<string>): PlayerAction | null => {
    const isUp = keys.has('ArrowUp') || keys.has('w'); 
    const isDown = keys.has('ArrowDown') || keys.has('s');
    const isLeft = keys.has('ArrowLeft') || keys.has('a');
    const isRight = keys.has('ArrowRight') || keys.has('d');
    const isPunchLeft = keys.has('z') || keys.has('j');
    const isPunchRight = keys.has('x') || keys.has('k');

    if (isDown) return PlayerAction.BLOCK;
    if (isLeft) return PlayerAction.DODGE_LEFT;
    if (isRight) return PlayerAction.DODGE_RIGHT;

    if (isPunchLeft) return (isUp || headMode) ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY;
    if (isPunchRight) return (isUp || headMode) ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY;

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
  }, [onAction, onReleaseBlock, headMode]);

  const btnBase = "relative flex items-center justify-center rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 transition-all border-2 touch-none select-none cursor-pointer";
  const btnGray = "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600";
  const btnRed = "bg-red-800 border-red-600 text-white hover:bg-red-700";
  const btnYellow = "bg-yellow-600 border-yellow-400 text-white hover:bg-yellow-500";
  const btnBlue = "bg-blue-800 border-blue-600 text-white hover:bg-blue-700";

  return (
    <div className="w-full h-full grid grid-cols-2 px-2 pb-2 gap-2 pointer-events-auto select-none touch-none max-w-[600px] mx-auto">
      
      {/* LEFT SIDE: MOVEMENT & DEFENSE */}
      <div className="relative flex flex-col items-center justify-end pb-2 gap-2">
         
         {/* Head Toggle (Top Left of this section) */}
         <button 
            className={`absolute top-0 left-0 w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 shadow-md active:scale-95 transition-all z-10 ${headMode ? 'bg-yellow-600 border-yellow-400 text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-slate-800/80 border-slate-600 text-slate-400'}`}
            onTouchStart={(e) => { e.preventDefault(); setHeadMode(!headMode); }}
         >
            <Target size={24} />
            <span className="text-[8px] font-bold mt-1">HEAD</span>
         </button>

         {/* Dodge Row */}
         <div className="flex gap-3 w-full justify-center items-end mt-10">
            <button 
                className={`${btnBase} ${btnGray} w-[40%] aspect-square max-w-[80px]`}
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_LEFT); }}
            >
                <ChevronLeft size={32}/>
            </button>
            <button 
                className={`${btnBase} ${btnGray} w-[40%] aspect-square max-w-[80px]`}
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_RIGHT); }}
            >
                <ChevronRight size={32}/>
            </button>
         </div>

         {/* Block Button (Wide) */}
         <button 
             className={`${btnBase} ${btnBlue} w-[90%] h-14 mt-1`}
             onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.BLOCK); }}
             onTouchEnd={(e) => { e.preventDefault(); onReleaseBlock(); }}
         >
             <Shield size={20} className="mr-2"/> BLOCK
         </button>
      </div>

      {/* RIGHT SIDE: ATTACKS */}
      <div className="relative flex items-center justify-center pb-2">
         {/* Rotate the container slightly for ergonomic thumb arc */}
         <div className="grid grid-cols-2 gap-4 rotate-6 transform translate-y-2">
             {/* Left Punch */}
             <button 
               className={`${btnBase} ${headMode ? btnYellow : btnRed} w-20 h-20 rounded-full border-4 !rounded-full`}
               onTouchStart={(e) => { e.preventDefault(); onAction(headMode ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY); }}
             >
               <Swords size={28} className="rotate-90"/>
             </button>
             
             {/* Right Punch (Offset down) */}
             <button 
                className={`${btnBase} ${headMode ? btnYellow : btnRed} w-20 h-20 rounded-full border-4 !rounded-full mt-10`}
                onTouchStart={(e) => { e.preventDefault(); onAction(headMode ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY); }}
            >
                <Swords size={28} className="rotate-90 scale-x-[-1]"/>
            </button>
         </div>
      </div>
    </div>
  );
};

export default Controls;