
import React, { useMemo } from 'react';
import { PlayerAction } from '../types';

interface PlayerProps {
  state: PlayerAction;
}

const Player: React.FC<PlayerProps> = ({ state }) => {
  
  // -- Coordinate System for Wireframe --
  // ViewBox: 0 -160 150 360 (Expanded top to allow VERY high punches)
  // Base Shoulder positions (Back view)
  const L_SHOULDER = { x: 40, y: 70 };
  const R_SHOULDER = { x: 110, y: 70 };

  // Calculate Dynamic Limb Positions
  const { lHand, rHand, lElbow, rElbow, headPos, torsoTwist } = useMemo(() => {
    // Defaults: GUARD POSITION (Fists up protecting face)
    let lh = { x: 55, y: 50 };
    let rh = { x: 95, y: 50 };
    let le = { x: 25, y: 90 }; // Elbows tucked but slightly out
    let re = { x: 125, y: 90 };
    let hp = { cx: 75, cy: 45 }; // Head center
    let twist = 0; // Torso rotation (simulated by x-shift of spine)

    // Action Overrides
    if (state === PlayerAction.BLOCK) {
      // Tight guard
      lh = { x: 65, y: 45 };
      rh = { x: 85, y: 45 };
      le = { x: 40, y: 80 };
      re = { x: 110, y: 80 };
    }
    else if (state === PlayerAction.PUNCH_LEFT_HEAD) {
      lh = { x: 75, y: -140 }; // AIM HIGH (Face) - Drastically raised
      le = { x: 30, y: -30 }; // Elbow rises high
      twist = 5;
    }
    else if (state === PlayerAction.PUNCH_LEFT_BODY) {
      lh = { x: 80, y: 0 }; // AIM MID (Chest/Stomach) - Lowered from -70
      le = { x: 25, y: 60 }; // Elbow tucked lower
      twist = 8;
    }
    else if (state === PlayerAction.PUNCH_RIGHT_HEAD) {
      rh = { x: 75, y: -140 }; // AIM HIGH (Face) - Drastically raised
      re = { x: 120, y: -30 };
      twist = -5;
    }
    else if (state === PlayerAction.PUNCH_RIGHT_BODY) {
      rh = { x: 70, y: 0 }; // AIM MID (Chest/Stomach) - Lowered from -70
      re = { x: 125, y: 60 }; // Elbow tucked lower
      twist = -8;
    }
    else if (state === PlayerAction.DODGE_LEFT) {
      lh = { x: 45, y: 55 }; rh = { x: 85, y: 55 };
      le = { x: 15, y: 95 }; re = { x: 115, y: 95 };
      hp.cx -= 15;
      twist = -10;
    }
    else if (state === PlayerAction.DODGE_RIGHT) {
      lh = { x: 65, y: 55 }; rh = { x: 105, y: 55 };
      le = { x: 35, y: 95 }; re = { x: 135, y: 95 };
      hp.cx += 15;
      twist = 10;
    }
    else if (state === PlayerAction.KO) {
      // Slumped over
      lh = { x: 30, y: 120 }; // Hands dropped
      rh = { x: 120, y: 120 };
      le = { x: 20, y: 100 };
      re = { x: 130, y: 100 };
      hp.cy = 60; // Head dropped
      hp.cx = 75;
    }

    return { lHand: lh, rHand: rh, lElbow: le, rElbow: re, headPos: hp, torsoTwist: twist };
  }, [state]);

  // CSS Transform for whole body sway
  const containerTransform = useMemo(() => {
    switch (state) {
        case PlayerAction.DODGE_LEFT: return "translate-x-[-40px] rotate-[-10deg]";
        case PlayerAction.DODGE_RIGHT: return "translate-x-[40px] rotate-[10deg]";
        case PlayerAction.BLOCK: return "scale-95 translate-y-[5px]";
        case PlayerAction.PUNCH_LEFT_BODY: 
        case PlayerAction.PUNCH_LEFT_HEAD: return "translate-x-[10px]";
        case PlayerAction.PUNCH_RIGHT_BODY: 
        case PlayerAction.PUNCH_RIGHT_HEAD: return "translate-x-[-10px]";
        case PlayerAction.HIT: return "translate-x-[-5px] opacity-60";
        case PlayerAction.KO: return "translate-y-[200px] rotate-[45deg] opacity-0 transition-all duration-[2000ms] ease-in";
        default: return "";
    }
  }, [state]);

  // Colors
  const isBlocking = state === PlayerAction.BLOCK;
  const isKO = state === PlayerAction.KO;
  const isHit = state === PlayerAction.HIT;
  const gloveFill = isBlocking ? "fill-yellow-600" : isKO ? "fill-slate-600" : "fill-green-600";
  const gloveStroke = isBlocking ? "stroke-yellow-300" : isKO ? "stroke-slate-500" : "stroke-green-400";
  const bodyStroke = isKO ? "stroke-slate-600" : "stroke-green-400";

  return (
    <div className={`relative w-[400px] h-[500px] transition-transform duration-100 ease-out origin-bottom will-change-transform ${containerTransform}`}>
      <svg viewBox="0 -160 150 360" className={`w-full h-full fill-none ${bodyStroke} stroke-2 drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]`}>
        
        {/* -- Wireframe Body -- */}
        
        {/* Head */}
        <g>
            <circle cx={headPos.cx} cy={headPos.cy} r="18" className="fill-slate-900/80 transition-all duration-100 ease-linear" />
            {/* Grid lines on head to show rotation */}
            <path d={`M${headPos.cx-18} ${headPos.cy} Q${headPos.cx} ${headPos.cy+5} ${headPos.cx+18} ${headPos.cy}`} strokeOpacity="0.5" className="transition-all duration-100 ease-linear" />
            <path d={`M${headPos.cx} ${headPos.cy-18} Q${headPos.cx+torsoTwist/2} ${headPos.cy} ${headPos.cx} ${headPos.cy+18}`} strokeOpacity="0.5" className="transition-all duration-100 ease-linear" />
            
            {/* Player Impact Starburst */}
            {isHit && (
                 <g transform={`translate(${headPos.cx}, ${headPos.cy})`}>
                     <path 
                        d="M0 -30 L10 -10 L30 -15 L15 0 L25 20 L0 10 L-25 20 L-15 0 L-30 -15 L-10 -10 Z" 
                        fill="#FEF08A" 
                        stroke="#EF4444" 
                        strokeWidth="2" 
                        className="animate-burst"
                     />
                 </g>
            )}
        </g>

        {/* Torso */}
        {/* Trapezoid shape that twists */}
        <path d={`M${L_SHOULDER.x} ${L_SHOULDER.y} L${R_SHOULDER.x} ${R_SHOULDER.y} L${100 - torsoTwist} 180 L${50 - torsoTwist} 180 Z`} className="fill-slate-900/80 transition-all duration-100 ease-linear" />
        {/* Spine */}
        <path d={`M${75 + torsoTwist} 70 L${75 - torsoTwist} 180`} strokeDasharray="3 3" strokeOpacity="0.5" className="transition-all duration-100 ease-linear" />

        {/* -- Arms (Calculated Paths) -- */}
        {/* Left Arm: Shoulder -> Elbow -> Hand */}
        <path d={`M${L_SHOULDER.x} ${L_SHOULDER.y} Q${lElbow.x} ${lElbow.y} ${lHand.x} ${lHand.y}`} strokeWidth="6" strokeLinecap="round" className="transition-all duration-100 ease-linear" />
        
        {/* Right Arm: Shoulder -> Elbow -> Hand */}
        <path d={`M${R_SHOULDER.x} ${R_SHOULDER.y} Q${rElbow.x} ${rElbow.y} ${rHand.x} ${rHand.y}`} strokeWidth="6" strokeLinecap="round" className="transition-all duration-100 ease-linear" />

        {/* -- Gloves (Rendered last to be on top) -- */}
        <circle cx={lHand.x} cy={lHand.y} r="16" className={`${gloveFill} ${gloveStroke} transition-all duration-100 ease-linear`} />
        <circle cx={rHand.x} cy={rHand.y} r="16" className={`${gloveFill} ${gloveStroke} transition-all duration-100 ease-linear`} />

        {/* -- Visual Feedback: Punch Connect / Impact -- */}
        {state.toString().includes('PUNCH') && (
            // Visual "whoosh" line near the hand
             <path d={`M${state.includes('LEFT') ? lHand.x - 10 : rHand.x + 10} ${lHand.y + 20} L${state.includes('LEFT') ? lHand.x : rHand.x} ${lHand.y}`} stroke="white" strokeWidth="2" strokeOpacity="0.6" />
        )}

      </svg>
    </div>
  );
};

export default Player;
