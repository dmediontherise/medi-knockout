
import React, { useEffect, useRef } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  // Use Ref instead of State to avoid re-rendering and listener thrashing
  const pressedKeys = useRef<Set<string>>(new Set());

  // Helper to determine action based on key combos
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

    if (isPunchLeft) {
        return isUp ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY;
    }
    if (isPunchRight) {
        return isUp ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY;
    }

    return null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.repeat) return; // Ignore hold-repeat to prevent spamming actions via OS key repeat

      pressedKeys.current.add(e.key);

      const action = determineAction(pressedKeys.current);
      if (action) {
        onAction(action);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.key);

      // Release block logic
      if (e.key === 'ArrowDown' || e.key === 's') {
        onReleaseBlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // Cleanup listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onAction, onReleaseBlock]); // Dependencies are stable callbacks

  // Gamepad Style Touch Controls
  return (
    <div className="absolute bottom-4 left-0 right-0 p-4 flex justify-between pointer-events-auto select-none md:opacity-0 md:pointer-events-none transition-opacity">
      {/* Left Side: D-Pad (Movement/Defense/Mod) */}
      <div className="flex flex-col items-center gap-1">
         {/* Up - Head Mod Visual */}
         <div className="w-14 h-14 bg-slate-800/80 rounded flex items-center justify-center border-2 border-slate-600 mb-1">
            <ChevronUp className="w-6 h-6 text-slate-400"/>
         </div>
         
         <div className="flex gap-1">
            <button 
                className="w-14 h-14 bg-slate-800/80 rounded flex items-center justify-center border-2 border-slate-600 active:bg-blue-500/50"
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_LEFT); }}
            >
                <ChevronLeft className="w-6 h-6"/>
            </button>
            <div className="w-14 h-14"></div> {/* Middle Spacer */}
            <button 
                className="w-14 h-14 bg-slate-800/80 rounded flex items-center justify-center border-2 border-slate-600 active:bg-blue-500/50"
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_RIGHT); }}
            >
                <ChevronRight className="w-6 h-6"/>
            </button>
         </div>

         <button 
             className="w-14 h-14 bg-slate-800/80 rounded flex items-center justify-center border-2 border-slate-600 active:bg-yellow-500/50 mt-1"
             onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.BLOCK); }}
             onTouchEnd={(e) => { e.preventDefault(); onReleaseBlock(); }}
         >
             <ChevronDown className="w-6 h-6"/>
         </button>
      </div>

      {/* Right Side: Action Buttons */}
      <div className="flex gap-4 items-end mb-4">
         <button 
           className="w-20 h-20 bg-red-900/80 rounded-full flex flex-col items-center justify-center border-4 border-red-700 active:bg-red-500 shadow-lg"
           onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.PUNCH_LEFT_BODY); }}
         >
           <Swords className="w-6 h-6 rotate-90"/>
           <span className="text-[10px] font-bold">L.PUNCH</span>
         </button>
         
         <button 
            className="w-20 h-20 bg-red-900/80 rounded-full flex flex-col items-center justify-center border-4 border-red-700 active:bg-red-500 shadow-lg mb-8"
            onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.PUNCH_RIGHT_BODY); }}
        >
            <Swords className="w-6 h-6 rotate-90"/>
            <span className="text-[10px] font-bold">R.PUNCH</span>
        </button>
      </div>
    </div>
  );
};

export default Controls;
