
import React, { useMemo } from 'react';
import { OpponentAction, OpponentCharacter, HitType } from '../types';

interface OpponentProps {
  state: OpponentAction;
  character: OpponentCharacter;
  lastHitType: HitType;
}

const Opponent: React.FC<OpponentProps> = ({ state, character, lastHitType }) => {
  const isTelegraphing = state.toString().startsWith('TELEGRAPH');
  const isPunching = state.toString().startsWith('PUNCH');
  const isStunned = state === OpponentAction.STUNNED;
  const isHit = state === OpponentAction.HIT;
  const isBlocking = state.toString().startsWith('BLOCK');
  const isKO = state === OpponentAction.KO;

  // -- Animation State Logic --
  const pose = useMemo(() => {
    // Default Upper Body
    let lArm = { x: -60, y: 40, r: 0, s: 1 };
    let rArm = { x: 60, y: 40, r: 0, s: 1 };
    let head = { x: 0, y: 0, r: 0 };
    let torso = { r: 0, y: 0 };
    
    // Legs / Hips (Updated for Shorter, Stockier look)
    // Hip Y is relative to Torso bottom (~90). 
    // Knees and Feet Y coordinates reduced to make legs shorter.
    let legs = {
        lKnee: { x: -45, y: 140 }, 
        rKnee: { x: 45, y: 140 },
        lFoot: { x: -55, y: 200 }, 
        rFoot: { x: 55, y: 200 },
        hipsY: 0
    };

    // --- UPPER BODY LOGIC ---
    if (isBlocking) {
      if (state === OpponentAction.BLOCK_HIGH) {
         lArm = { x: -30, y: -20, r: 45, s: 1 };
         rArm = { x: 30, y: -20, r: -45, s: 1 };
      } else {
         lArm = { x: -30, y: 60, r: 20, s: 1 };
         rArm = { x: 30, y: 60, r: -20, s: 1 };
      }
    } 
    else if (state === OpponentAction.TELEGRAPH_JAB_LEFT) {
       lArm = { x: -80, y: 30, r: -20, s: 1.1 }; 
       torso = { r: 5, y: 15 }; // Squat deeper
       legs.hipsY = 15;
       legs.lKnee = { x: -50, y: 150 }; legs.rKnee = { x: 50, y: 150 };
    }
    else if (state === OpponentAction.PUNCH_JAB_LEFT) {
       // Aim DOWN at player (y: 120)
       lArm = { x: -10, y: 120, r: 10, s: 2.5 };
       torso = { r: 15, y: 5 };
       // Lunge Left
       legs.lFoot = { x: -70, y: 210 };
       legs.lKnee = { x: -55, y: 160 };
    }
    else if (state === OpponentAction.TELEGRAPH_JAB_RIGHT) {
       rArm = { x: 80, y: 30, r: 20, s: 1.1 };
       torso = { r: -5, y: 15 };
       legs.hipsY = 15;
       legs.lKnee = { x: -50, y: 150 }; legs.rKnee = { x: 50, y: 150 };
    }
    else if (state === OpponentAction.PUNCH_JAB_RIGHT) {
       // Aim DOWN at player (y: 120)
       rArm = { x: 10, y: 120, r: -10, s: 2.5 };
       torso = { r: -15, y: 5 };
       legs.rFoot = { x: 70, y: 210 };
       legs.rKnee = { x: 55, y: 160 };
    }
    else if (state.includes('HOOK')) {
       if (state.includes('LEFT')) {
          if (isTelegraphing) { 
              lArm = { x: -90, y: 40, r: -45, s: 1 }; torso = { r: -20, y: 10 }; 
              legs.hipsY = 20; 
              legs.lKnee.x -= 15;
          }
          else { 
              // Aim Down/In
              lArm = { x: 20, y: 90, r: 80, s: 2.0 }; torso = { r: 30, y: 0 }; 
              legs.lFoot.x += 20; // Pivot
          }
       } else {
          if (isTelegraphing) { 
              rArm = { x: 90, y: 40, r: 45, s: 1 }; torso = { r: 20, y: 10 }; 
              legs.hipsY = 20;
              legs.rKnee.x += 15;
          }
          else { 
              // Aim Down/In
              rArm = { x: -20, y: 90, r: -80, s: 2.0 }; torso = { r: -30, y: 0 }; 
              legs.rFoot.x -= 20;
          }
       }
    }
    else if (state.includes('UPPERCUT')) {
       if (isTelegraphing) {
           torso.y = 30; // Low crouch
           legs.hipsY = 30;
           legs.lKnee.y = 160; legs.rKnee.y = 160;
       } else {
           torso.y = -30; // Spring up
           legs.hipsY = -20;
           legs.lKnee.y = 130; legs.rKnee.y = 130;
           // Comes UP but lands lower in view
           if (state.includes('LEFT')) lArm = { x: 0, y: 40, r: 0, s: 2.2 };
           else rArm = { x: 0, y: 40, r: 0, s: 2.2 };
       }
    }
    else if (isHit) {
        if (lastHitType === 'BODY') {
            // BODY BLOW REACTION: CRUNCH
            head.y = 30; // Head Tuck
            head.r = Math.random() > 0.5 ? 10 : -10;
            
            torso.r = (Math.random() > 0.5 ? 10 : -10);
            torso.y = 20; // Hunch over
            legs.hipsY = 20;

            // Clutch Stomach
            lArm = { x: -20, y: 80, r: 80, s: 1 };
            rArm = { x: 20, y: 80, r: -80, s: 1 };
        } 
        else {
            // HEAD SHOT REACTION: SNAP BACK
            head.y = -80; // Pop head up VERY high
            head.x = Math.random() > 0.5 ? 10 : -10;
            head.r = Math.random() > 0.5 ? 35 : -35;
            
            torso.r = (Math.random() > 0.5 ? 15 : -15);
            torso.y = -10;
            
            // Arms flail out wildly
            lArm = { x: -100, y: -40, r: -80, s: 1 };
            rArm = { x: 100, y: -40, r: 80, s: 1 };
        }
        
        // Knees knock together regardless of hit type
        legs.lKnee.x = -15; 
        legs.rKnee.x = 15;
        legs.lKnee.y = 160;
        legs.rKnee.y = 160;
    }
    else if (isKO) {
        head.y = 20;
        lArm = { x: -80, y: 60, r: -90, s: 1 };
        rArm = { x: 80, y: 60, r: 90, s: 1 };
        legs.lKnee = { x: -20, y: 160 }; legs.rKnee = { x: 20, y: 160 }; // Legs together
        legs.lFoot = { x: -30, y: 220 }; legs.rFoot = { x: 30, y: 220 };
    }

    return { lArm, rArm, head, torso, legs };
  }, [state, isBlocking, isTelegraphing, isHit, isKO, lastHitType]);


  // -- Helpers --
  const rotatePoint = (x: number, y: number, angleDeg: number) => {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
  };

  const renderLegs = (color: string, shoeColor: string, pantsType: 'shorts'|'long'|'tights' = 'long') => {
      const { lKnee, rKnee, lFoot, rFoot, hipsY } = pose.legs;
      const hipLX = -30; const hipRX = 30; 
      const hipY = 90 + hipsY;
      const strokeW = 28;
      
      return (
          <g>
              <path d={`M${hipLX} ${hipY} Q${lKnee.x} ${lKnee.y} ${lFoot.x} ${lFoot.y}`} stroke={color} strokeWidth={strokeW} fill="none" strokeLinecap="round" />
              <path d={`M${hipRX} ${hipY} Q${rKnee.x} ${rKnee.y} ${rFoot.x} ${rFoot.y}`} stroke={color} strokeWidth={strokeW} fill="none" strokeLinecap="round" />
              
              <path d={`M${lFoot.x-15} ${lFoot.y} L${lFoot.x+15} ${lFoot.y} L${lFoot.x+15} ${lFoot.y+15} L${lFoot.x-15} ${lFoot.y+15} Z`} fill={shoeColor} />
              <path d={`M${rFoot.x-15} ${rFoot.y} L${rFoot.x+15} ${rFoot.y} L${rFoot.x+15} ${rFoot.y+15} L${rFoot.x-15} ${rFoot.y+15} Z`} fill={shoeColor} />

              {pantsType === 'shorts' && (
                  <path d={`M-45 ${hipY} L45 ${hipY} L55 ${hipY+35} L-55 ${hipY+35} Z`} fill={color} />
              )}
          </g>
      );
  }

  const renderArm = (side: 'left' | 'right', glovePose: {x:number, y:number, s:number}) => {
      let armColor = "#A97142"; // Default Skin
      if (character.id === 'medi_jinx') armColor = "#60A5FA"; // Blue Skin
      if (character.id === 'mr_yankee') armColor = "#F8FAFC"; // White Pinstripe
      if (character.id === 'maga_man') armColor = "#1E3A8A"; // Blue Suit
      if (character.id === 'aint_man') armColor = "#1F2937"; // Black Armor

      // Calculate Shoulder Position relative to center
      // Torso top is ~40 relative to group origin (which is hipsY + torso.y)
      // Shoulder offsets from center
      const baseX = side === 'left' ? -45 : 45;
      const baseY = 45; // Down from top of torso

      // Apply Torso Rotation to Shoulder
      const shoulderLocal = rotatePoint(baseX, baseY, pose.torso.r);
      
      // Transform to Global (inside SVG)
      // Group translation is: 0, hipsY + torso.y
      const groupY = pose.legs.hipsY + pose.torso.y;
      
      const shoulderX = shoulderLocal.x;
      const shoulderY = shoulderLocal.y + groupY;

      // Glove Position is already in Global
      // Draw tapered path from shoulder to glove
      // Perpendicular vector for thickness
      const dx = glovePose.x - shoulderX;
      const dy = glovePose.y - shoulderY;
      const len = Math.sqrt(dx*dx + dy*dy);
      const nx = -dy / len;
      const ny = dx / len;

      const shoulderWidth = 18;
      const wristWidth = 12 * glovePose.s; // Scale wrist with glove

      return (
          <path 
            d={`
                M ${shoulderX + nx*shoulderWidth} ${shoulderY + ny*shoulderWidth}
                L ${glovePose.x + nx*wristWidth} ${glovePose.y + ny*wristWidth}
                L ${glovePose.x - nx*wristWidth} ${glovePose.y - ny*wristWidth}
                L ${shoulderX - nx*shoulderWidth} ${shoulderY - ny*shoulderWidth}
                Z
            `}
            fill={armColor}
            stroke="black"
            strokeWidth="1"
            opacity="0.95"
          />
      );
  };


  // -- Character Art Assets (Replaced with Image Sprite) --
  const renderCharacterArt = () => {
    // Torso transforms for bobbing effect
    const tTransY = pose.legs.hipsY + pose.torso.y;
    
    return (
        <g transform={`translate(0, ${tTransY})`}>
            {/* Shadow */}
            <ellipse cx="0" cy="380" rx="80" ry="20" fill="black" opacity="0.4" />
            
            {/* Character Sprite (CSS Animation) */}
            <foreignObject x="-150" y="-50" width="300" height="450">
                <div 
                    style={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${character.spriteConfig.sheetUrl})`,
                        backgroundSize: '400% 100%', // Assume 4 frames in a row
                        backgroundPosition: (() => {
                            if (isKO) return '100% 0';
                            if (isHit) return '66% 0';
                            if (isPunching) return '33% 0';
                            return '0% 0';
                        })(),
                        backgroundRepeat: 'no-repeat',
                        transformOrigin: 'center bottom',
                        transform: `rotate(${pose.torso.r}deg) ${isHit ? 'scale(0.95)' : 'scale(1)'}`,
                        filter: isHit ? 'brightness(1.5) sepia(0.5) hue-rotate(-30deg)' : 'none',
                        transition: 'background-position 0.1s steps(1), transform 0.1s ease-out',
                        imageRendering: 'pixelated'
                    }}
                />
            </foreignObject>

            {/* Hit Effects */}
            {isHit && (
                <g transform={`translate(${pose.head.x}, ${pose.head.y})`}>
                    <path 
                        d="M0 -70 L20 -30 L60 -40 L30 0 L50 40 L0 25 L-50 40 L-30 0 L-60 -40 L-20 -30 Z" 
                        fill="#FEF08A" 
                        stroke="#EA580C" 
                        strokeWidth="4" 
                        className="animate-burst"
                    />
                    <path 
                        d="M0 -70 L20 -30 L60 -40 L30 0 L50 40 L0 25 L-50 40 L-30 0 L-60 -40 L-20 -30 Z" 
                        fill="white" 
                        className="animate-burst scale-75"
                    />
                </g>
            )}
        </g>
    )
  };

  // -- Render Glove --
  const renderGlove = (side: 'left'|'right', transform: {x:number, y:number, r:number, s:number}) => {
     let gloveColor = "#DC2626";
     if (character.id === 'aint_man') gloveColor = "#FBBF24";
     if (character.id === 'mr_yankee') gloveColor = "#FFFFFF";
     if (character.id === 'maga_man') gloveColor = "#1E3A8A";

     return (
         <g transform={`translate(${transform.x}, ${transform.y}) rotate(${transform.r}) scale(${transform.s})`}>
             <circle cx="0" cy="0" r="22" fill={gloveColor} stroke="black" strokeWidth="2" />
             <path d="M-10 -5 Q0 -15 10 -5" stroke="black" strokeWidth="2" fill="none" opacity="0.5"/>
             {transform.s > 1.5 && (
                <path d="M-15 10 L-25 30 M15 10 L25 30" stroke="white" strokeWidth="2" opacity="0.6" />
             )}
         </g>
     );
  };

  const containerClass = useMemo(() => {
      if (isKO) return "animate-knockout-fall pointer-events-none grayscale";
      if (isHit) return "translate-x-[5px] skew-x-3 brightness-125"; 
      if (isStunned) return "translate-y-[5px] rotate-2";
      if (isTelegraphing) return "animate-telegraph brightness-125 sepia";
      return "animate-idle";
  }, [state, isKO, isHit, isStunned, isTelegraphing]);

  return (
    <div className={`relative flex justify-center items-end transition-all duration-100 ${containerClass}`}>
       <div className={`absolute bottom-0 w-[500px] h-[700px] opacity-10 pointer-events-none mix-blend-screen transition-all duration-1000 ${isKO ? 'opacity-0' : ''}`}>
          <svg viewBox="0 0 200 400" className="w-full h-full fill-none stroke-pink-500 stroke-1">
             <path d="M50 150 L150 150 L140 350 L60 350 Z" />
          </svg>
       </div>

       <div className="relative z-10 w-[400px] h-[600px]">
          <svg viewBox="-140 -120 280 480" className="w-full h-full overflow-visible drop-shadow-xl">
              {renderCharacterArt()}
              {renderGlove('left', pose.lArm)}
              {renderGlove('right', pose.rArm)}
          </svg>
       </div>

       {isStunned && (
           <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-4 -mt-24 z-20">
               <span className="text-yellow-400 text-6xl animate-spin">★</span>
               <span className="text-yellow-400 text-6xl animate-spin delay-100">★</span>
           </div>
       )}
    </div>
  );
};

export default Opponent;
