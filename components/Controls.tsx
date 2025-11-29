
import React, { useEffect, useRef } from 'react';
import { PlayerAction } from '../types';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Swords } from 'lucide-react';

interface ControlsProps {
  onAction: (action: PlayerAction) => void;
  onReleaseBlock: () => void;
}

const Controls: React.FC<ControlsProps> = ({ onAction, onReleaseBlock }) => {
  // Use Ref instead of State to avoid re-rendering and listener thrashing for Keyboard
  const pressedKeys = useRef<Set<string>>(new Set());
  
  // Touch State
  const [headMode, setHeadMode] = React.useState(false);

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
        return (isUp || headMode) ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY;
    }
    if (isPunchRight) {
        return (isUp || headMode) ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY;
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
  }, [onAction, onReleaseBlock, headMode]); // Re-bind if headMode changes (though mostly for touch)

  // Gamepad Style Touch Controls
  return (
    <div className="w-full h-full flex justify-between items-center px-2 md:px-12 pb-2 pointer-events-auto select-none">
      {/* Left Side: D-Pad (Movement/Defense/Mod) */}
      <div className="flex flex-col items-center gap-2">
         {/* Up - Head Mod Toggle */}
         <button 
            className={`w-16 h-16 rounded-lg flex items-center justify-center border-2 mb-1 transition-all ${headMode ? 'bg-yellow-600 border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-slate-800/80 border-slate-600'}`}
            onTouchStart={(e) => { e.preventDefault(); setHeadMode(!headMode); }}
         >
            <div className="flex flex-col items-center">
                <ChevronUp className={`w-8 h-8 ${headMode ? 'text-white' : 'text-slate-400'}`}/>
                <span className="text-[10px] font-bold text-slate-300">AIM HEAD</span>
            </div>
         </button>
         
         <div className="flex gap-2">
            <button 
                className="w-16 h-16 bg-slate-800/80 rounded-lg flex items-center justify-center border-2 border-slate-600 active:bg-blue-500/50 active:border-blue-400 active:scale-95 transition-transform"
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_LEFT); }}
            >
                <ChevronLeft className="w-8 h-8 text-slate-300"/>
            </button>
            
            <button 
                className="w-16 h-16 bg-slate-800/80 rounded-lg flex items-center justify-center border-2 border-slate-600 active:bg-blue-500/50 active:border-blue-400 active:scale-95 transition-transform"
                onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.DODGE_RIGHT); }}
            >
                <ChevronRight className="w-8 h-8 text-slate-300"/>
            </button>
         </div>

         <button 
             className="w-32 h-14 bg-slate-800/80 rounded-lg flex items-center justify-center border-2 border-slate-600 active:bg-blue-500/50 active:border-blue-400 active:scale-95 transition-transform mt-1"
             onTouchStart={(e) => { e.preventDefault(); onAction(PlayerAction.BLOCK); }}
             onTouchEnd={(e) => { e.preventDefault(); onReleaseBlock(); }}
         >
             <span className="flex items-center gap-1 text-slate-300 font-bold text-sm"><ChevronDown className="w-5 h-5"/> BLOCK</span>
         </button>
      </div>

      {/* Right Side: Action Buttons */}
      <div className="flex gap-4 items-center pr-2">
         <button 
           className={`w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 active:scale-95 transition-transform shadow-lg ${headMode ? 'bg-red-800 border-red-500' : 'bg-red-900/80 border-red-700'}`}
           onTouchStart={(e) => { e.preventDefault(); onAction(headMode ? PlayerAction.PUNCH_LEFT_HEAD : PlayerAction.PUNCH_LEFT_BODY); }}
         >
           <Swords className="w-8 h-8 rotate-90 text-white"/>
           <span className="text-[10px] font-bold text-red-200">LEFT</span>
         </button>
         
         <button 
            className={`w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 active:scale-95 transition-transform shadow-lg mt-12 ${headMode ? 'bg-red-800 border-red-500' : 'bg-red-900/80 border-red-700'}`}
            onTouchStart={(e) => { e.preventDefault(); onAction(headMode ? PlayerAction.PUNCH_RIGHT_HEAD : PlayerAction.PUNCH_RIGHT_BODY); }}
        >
            <Swords className="w-8 h-8 rotate-90 text-white"/>
            <span className="text-[10px] font-bold text-red-200">RIGHT</span>
        </button>
      </div>
    </div>
  );
};

export default Controls;
