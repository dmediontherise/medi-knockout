import React, { useEffect, useRef, useState } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  const pressedKeys = useRef<Set<string>>(new Set());
  const [isUpHeld, setIsUpHeld] = useState(false);
  const [activeBtn, setActiveBtn] = useState<string | null>(null);

  const determineAction = (keys: Set<string>): PlayerAction | null => {
    const isUp = keys.has('ArrowUp') || keys.has('w') || isUpHeld; 
    const isDown = keys.has('ArrowDown') || keys.has('s');
    const isLeft = keys.has('ArrowLeft') || keys.has('a');
    const isRight = keys.has('ArrowRight') || keys.has('d');
    const isDuck = keys.has('c') || keys.has('Control') || keys.has('Duck');
    const isStar = keys.has(' ') || keys.has('Enter') || keys.has('Star');
    const isPunchLeft = keys.has('z') || keys.has('j');
    const isPunchRight = keys.has('x') || keys.has('k');

    if (isStar) return PlayerAction.STAR_PUNCH;
    if (isDuck) return PlayerAction.DUCK;
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

  // NES Style Constants
  const dpadBase = "absolute bg-slate-800 flex items-center justify-center active:bg-slate-700 transition-colors";
  const actionBtnBase = "w-14 h-14 md:w-16 md:h-16 rounded-full border-b-4 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center shadow-lg";
  
  return (
    <div className="w-full h-full flex justify-center items-center px-2 select-none touch-none">
        {/* NES Controller Container */}
        <div className="relative w-full max-w-[700px] h-full max-h-[160px] md:max-h-[180px] bg-gray-200 border-t-4 border-l-4 border-white border-b-4 border-r-4 border-gray-400 rounded-lg flex justify-between items-center px-4 md:px-12 shadow-2xl">
            
            {/* LEFT SIDE: D-PAD (CROSS) */}
            <div className="relative w-28 h-28 md:w-32 md:h-32 flex-shrink-0">
                {/* Center Block (Filler) */}
                <div className="absolute top-1/3 left-1/3 w-1/3 h-1/3 bg-slate-800 z-10"></div>

                {/* UP (Head Aim) */}
                <button 
                    className={`${dpadBase} top-0 left-1/3 w-1/3 h-1/3 rounded-t-lg border-t-2 border-l-2 border-r-2 border-slate-600 ${isUpHeld ? 'bg-yellow-600' : ''}`}
                    onTouchStart={(e) => { e.preventDefault(); setIsUpHeld(true); }}
                    onTouchEnd={(e) => { e.preventDefault(); setIsUpHeld(false); }}
                >
                    <ChevronUp className="text-slate-400" size={20}/>
                    <span className="absolute -top-3 text-[8px] font-bold text-slate-500">HEAD</span>
                </button>

                {/* LEFT (Dodge) */}
                <button 
                    className={`${dpadBase} top-1/3 left-0 w-1/3 h-1/3 rounded-l-lg border-t-2 border-l-2 border-b-2 border-slate-600`}
                    onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_LEFT); }}
                >
                    <ChevronLeft className="text-slate-400" size={20}/>
                </button>

                {/* RIGHT (Dodge) */}
                <button 
                    className={`${dpadBase} top-1/3 right-0 w-1/3 h-1/3 rounded-r-lg border-t-2 border-r-2 border-b-2 border-slate-600`}
                    onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_RIGHT); }}
                >
                    <ChevronRight className="text-slate-400" size={20}/>
                </button>

                {/* DOWN (Block) */}
                <button 
                    className={`${dpadBase} bottom-0 left-1/3 w-1/3 h-1/3 rounded-b-lg border-l-2 border-r-2 border-b-2 border-slate-600`}
                    onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.BLOCK); }}
                    onTouchEnd={(e) => { e.preventDefault(); onReleaseBlock(); }}
                >
                    <ChevronDown className="text-slate-400" size={20}/>
                    <span className="absolute -bottom-3 text-[8px] font-bold text-slate-500">BLOCK</span>
                </button>
            </div>

            {/* MIDDLE: SELECT (DUCK) / START (STAR PUNCH) */}
            <div className="flex gap-4">
                <button 
                    className="flex flex-col items-center gap-1 active:opacity-75 focus:outline-none"
                    onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DUCK); }}
                    onClick={() => onAction(PlayerAction.DUCK)}
                >
                    <div className="w-10 h-3 md:w-12 md:h-4 bg-slate-400 rounded-full border-2 border-slate-500 transform rotate-12 active:bg-slate-300"></div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Duck</span>
                </button>
                <button 
                    className="flex flex-col items-center gap-1 active:opacity-75 focus:outline-none"
                    onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.STAR_PUNCH); }}
                    onClick={() => onAction(PlayerAction.STAR_PUNCH)}
                >
                    <div className="w-10 h-3 md:w-12 md:h-4 bg-yellow-500 rounded-full border-2 border-yellow-600 transform rotate-12 active:bg-yellow-400"></div>
                    <span className="text-[8px] font-bold text-yellow-600 uppercase tracking-widest">Star</span>
                </button>
            </div>

            {/* RIGHT SIDE: ACTION BUTTONS (B/A Style) */}
            <div className="relative flex items-center justify-end gap-3 md:gap-5 pr-2">
                {/* Button B (Left Punch) */}
                <div className="flex flex-col items-center">
                     <button 
                        className={`${actionBtnBase} bg-red-600 border-red-800 active:bg-red-700`}
                        onTouchStart={(e) => { e.preventDefault(); onAction(isUpHeld ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY); }}
                    >
                        <span className="text-white font-bold text-lg opacity-60">L</span>
                    </button>
                    <span className="font-bold text-slate-500 mt-1 text-xs">B</span>
                </div>

                {/* Button A (Right Punch) */}
                <div className="flex flex-col items-center">
                    <button 
                        className={`${actionBtnBase} bg-red-600 border-red-800 active:bg-red-700`}
                        onTouchStart={(e) => { e.preventDefault(); onAction(isUpHeld ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY); }}
                    >
                        <span className="text-white font-bold text-lg opacity-60">R</span>
                    </button>
                    <span className="font-bold text-slate-500 mt-1 text-xs">A</span>
                </div>
            </div>

        </div>
    </div>
  );
};

export default Controls;
