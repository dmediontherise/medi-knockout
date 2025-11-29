
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


  // -- Character Art Assets (SVG Puppets) --
  const renderCharacterArt = () => {
    // Torso transforms
    const tTrans = `translate(0, ${pose.legs.hipsY + pose.torso.y})`;

    let charSVG = null;
    let neckColor = "#A97142"; // Default Skin

    switch(character.id) {
        case 'medi_jinx': 
            neckColor = "#60A5FA";
            charSVG = (
                <g transform={tTrans} className="transition-transform duration-150 ease-out">
                   {renderLegs("#DC2626", "white", "tights")}
                   <rect x="-15" y="10" width="30" height="40" fill={neckColor} /> {/* Neck */}
                   <rect x="-40" y="40" width="80" height="60" fill="#DC2626" rx="10" /> 
                   <text x="0" y="75" fontSize="20" textAnchor="middle" fill="black" fontWeight="bold" transform="rotate(-10)">28-3</text>
                   
                   <g transform={`translate(${pose.head.x}, ${pose.head.y}) rotate(${pose.head.r})`}>
                       <circle cx="0" cy="0" r="40" fill="#60A5FA" />
                       <g transform={isHit ? "translate(0, -30) rotate(-20)" : ""}>
                            <path d="M-40 0 Q0 10 40 0 V-45 H-40 Z" fill="#1F2937" /> 
                       </g>
                       {isHit ? (
                           <g>
                               <circle cx="-15" cy="5" r="14" fill="white" stroke="black" /> <circle cx="-15" cy="5" r="3" fill="black" />
                               <circle cx="15" cy="5" r="14" fill="white" stroke="black" /> <circle cx="15" cy="5" r="3" fill="black" />
                               <ellipse cx="0" cy="25" rx="10" ry="15" fill="black" />
                           </g>
                       ) : (
                           <g>
                                <circle cx="-15" cy="5" r="9" fill="white" /> <circle cx="-15" cy="5" r="2" fill="black" />
                                <circle cx="15" cy="5" r="9" fill="white" /> <circle cx="15" cy="5" r="2" fill="black" />
                                <path d="M-25 25 Q0 40 25 25" stroke="white" strokeWidth="5" fill="none" /> 
                           </g>
                       )}
                       {isKO && <text x="0" y="10" fontSize="35" textAnchor="middle" fill="black">XX</text>}
                   </g>
                </g>
            );
            break;
        case 'dj_tito': 
            neckColor = "#A97142";
            charSVG = (
                <g transform={tTrans}>
                    {renderLegs("#111827", "#FBBF24", "long")}
                    <rect x="-15" y="10" width="30" height="40" fill={neckColor} /> {/* Neck */}
                    <path d="M-45 40 L45 40 L40 100 L-40 100 Z" fill="#1F2937" />
                    <circle cx="0" cy="65" r="12" fill="#FBBF24" opacity="0.5" />
                    <g transform={`translate(${pose.head.x}, ${pose.head.y}) rotate(${pose.head.r})`}>
                        <circle cx="0" cy="0" r="38" fill="#A97142" />
                        <g transform={isHit ? "translate(-20, -10) rotate(-30)" : ""}>
                             <rect x="-48" y="-15" width="12" height="35" fill="#9CA3AF" rx="2" />
                        </g>
                        <g transform={isHit ? "translate(20, -10) rotate(30)" : ""}>
                             <rect x="36" y="-15" width="12" height="35" fill="#9CA3AF" rx="2" />
                        </g>
                        {!isHit && <path d="M-40 -10 L40 -10" stroke="#374151" strokeWidth="22" strokeLinecap="round" />}
                        <g transform={isHit ? "rotate(20)" : ""}>
                             <rect x="-25" y="-5" width="50" height="18" fill="black" rx="2" />
                        </g>
                        {isHit && <ellipse cx="0" cy="28" rx="8" ry="12" fill="black" />}
                        {isKO && <text x="0" y="25" fontSize="20" textAnchor="middle" fill="white">RIP</text>}
                    </g>
                </g>
            );
            break;
        case 'mr_yankee': 
            neckColor = "#E2E8F0";
            charSVG = (
                <g transform={tTrans}>
                    {renderLegs("#F8FAFC", "#1E293B", "long")}
                    <path d="M-20 120 L-20 200" stroke="#1E293B" strokeWidth="2" opacity="0.3" />
                    <path d="M20 120 L20 200" stroke="#1E293B" strokeWidth="2" opacity="0.3" />
                    <rect x="-18" y="10" width="36" height="40" fill={neckColor} /> {/* Neck */}
                    <rect x="-50" y="40" width="100" height="80" fill="#F8FAFC" stroke="#1E293B" strokeWidth="2"/>
                    <path d="M-30 40 V120 M-10 40 V120 M10 40 V120 M30 40 V120" stroke="#1E293B" strokeWidth="2" />
                    <g transform={`translate(${pose.head.x}, ${pose.head.y}) rotate(${pose.head.r})`}>
                        <circle cx="0" cy="0" r="45" fill="white" stroke="#CBD5E1" strokeWidth="1"/>
                        <path d="M-28 -28 Q0 -5 28 -28" stroke="#EF4444" strokeWidth={isHit ? 6 : 3} fill="none" strokeDasharray={isHit ? "10 5" : "4 2"}/>
                        <path d="M-28 28 Q0 5 28 28" stroke="#EF4444" strokeWidth={isHit ? 6 : 3} fill="none" strokeDasharray={isHit ? "10 5" : "4 2"}/>
                        {isHit ? (
                             <g>
                                 <path d="M-20 -10 L-10 0 M-10 -10 L-20 0" stroke="black" strokeWidth="3" />
                                 <path d="M20 -10 L10 0 M10 -10 L20 0" stroke="black" strokeWidth="3" />
                                 <path d="M-15 20 Q0 5 15 20" stroke="black" strokeWidth="3" fill="none"/>
                             </g>
                        ) : (
                             <g>
                                 <circle cx="-18" cy="-5" r="5" fill="black" />
                                 <circle cx="18" cy="-5" r="5" fill="black" />
                                 <path d="M-12 15 Q0 20 12 15" stroke="black" strokeWidth="3" fill="none"/>
                             </g>
                        )}
                        {isKO && <path d="M-25 -10 L25 10 M25 -10 L-25 10" stroke="red" strokeWidth="5" />}
                    </g>
                </g>
            );
            break;
        case 'maga_man': 
            neckColor = "#FB923C";
            charSVG = (
                <g transform={tTrans}>
                    {renderLegs("#1E3A8A", "black", "long")}
                    <rect x="-15" y="10" width="30" height="40" fill={neckColor} /> {/* Neck */}
                    <path d="M-50 40 L50 40 L45 120 L-45 120 Z" fill="#1E3A8A" />
                    <path d="M0 40 L0 120" stroke="white" strokeWidth="25" />
                    <path d="M0 40 L8 110 L0 120 L-8 110 Z" fill="#DC2626" />
                    <g transform={`translate(${pose.head.x}, ${pose.head.y}) rotate(${pose.head.r})`}>
                        <circle cx="0" cy="0" r="40" fill={isHit ? "#EF4444" : "#FB923C"} />
                        <g transform={isHit ? "rotate(-45) translate(-10,-10)" : ""}>
                            <path d="M-40 -15 L40 -15 L35 -40 L-35 -40 Z" fill="#DC2626" />
                            <rect x="-42" y="-15" width="84" height="6" fill="#DC2626" />
                            <text x="0" y="-22" fontSize="10" textAnchor="middle" fill="white">MAGA</text>
                        </g>
                        {isHit ? (
                             <g>
                                 <circle cx="-12" cy="5" r="2" fill="black" /> <circle cx="12" cy="5" r="2" fill="black" />
                                 <circle cx="0" cy="25" r="10" fill="black" />
                             </g>
                        ) : (
                             <g>
                                 <circle cx="-12" cy="5" r="3" fill="black" /> <circle cx="12" cy="5" r="3" fill="black" />
                                 <path d="M-8 25 Q0 20 8 25" stroke="black" strokeWidth="2" fill="none" />
                             </g>
                        )}
                        {isKO && <text x="0" y="10" fontSize="30" textAnchor="middle" fill="black">XX</text>}
                    </g>
                </g>
            );
            break;
        default: // AINT MAN
            neckColor = "#1F2937";
            charSVG = (
                 <g transform={tTrans}>
                    {renderLegs("black", "#FBBF24", "tights")}
                    <rect x="-35" y="140" width="10" height="30" fill="#FBBF24" />
                    <rect x="25" y="140" width="10" height="30" fill="#FBBF24" />
                    
                    <rect x="-15" y="10" width="30" height="40" fill={neckColor} /> {/* Neck */}
                    
                    <path d="M-50 40 L50 40 L40 110 L-40 110 Z" fill="#000000" />
                    <path d="M-40 40 L0 110 L40 40" fill="none" stroke="#FBBF24" strokeWidth="5" />
                    <g transform={`translate(${pose.head.x}, ${pose.head.y}) rotate(${pose.head.r})`}>
                        <circle cx="0" cy="0" r="40" fill="#A97142" />
                        <g transform={isHit ? "rotate(10) translate(0, -5)" : ""}>
                             <rect x="-40" y="-35" width="80" height="25" fill="#FBBF24" rx="5" />
                             <rect x="-6" y="-35" width="12" height="25" fill="black" />
                        </g>
                        {isHit ? (
                             <g>
                                <path d="M-15 -5 L-5 5 M-5 -5 L-15 5" stroke="black" strokeWidth="2" />
                                <path d="M15 -5 L5 5 M5 -5 L15 5" stroke="black" strokeWidth="2" />
                                <rect x="-12" y="18" width="24" height="12" fill="black" rx="5" />
                             </g>
                        ) : (
                             <g>
                                <circle cx="-14" cy="0" r="4" fill="black" /> <circle cx="14" cy="0" r="4" fill="black" />
                                <rect x="-12" y="18" width="24" height="6" fill="black" rx="2" />
                             </g>
                        )}
                        {isKO && <text x="0" y="0" fontSize="30" textAnchor="middle" fill="black">XX</text>}
                    </g>
                </g>
            );
            break;
    }

    return (
        <g>
            {renderArm('left', pose.lArm)}
            {renderArm('right', pose.rArm)}
            
            <g transform={`rotate(${pose.torso.r})`}>
                 {charSVG}
            </g>

            {/* Starburst */}
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
         <g transform={`translate(${transform.x}, ${transform.y}) rotate(${transform.r}) scale(${transform.s})`} className="transition-transform duration-100 ease-linear">
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
      if (isHit) return "translate-x-[5px] skew-x-3 brightness-125 duration-75 ease-in"; // Snappier hit
      if (isStunned) return "translate-y-[5px] rotate-2 duration-200";
      if (isTelegraphing) return "scale-105 brightness-125 sepia duration-150"; // Smooth telegraph
      return "animate-idle duration-300"; // Smooth idle return
  }, [state, isKO, isHit, isStunned, isTelegraphing]);

  return (
    <div className={`relative flex justify-center items-end transition-all ease-out ${containerClass}`}>
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
