
import React, { useMemo } from 'react';
import { GameState } from '../types';

interface BackgroundProps {
  isPlayerHit: boolean;
  isOpponentHit: boolean;
  gameState: GameState;
}

const Background: React.FC<BackgroundProps> = ({ isPlayerHit, isOpponentHit, gameState }) => {
  
  // Generate a random crowd for the session
  const crowd = useMemo(() => {
      const members = [];
      const colors = ["#475569", "#334155", "#1E293B", "#64748B", "#94A3B8"];
      for (let i = 0; i < 60; i++) {
          members.push({
              x: Math.random() * 100,
              y: Math.random() * 100,
              size: 5 + Math.random() * 8,
              color: colors[Math.floor(Math.random() * colors.length)],
              delay: Math.random() * 2,
              duration: 1 + Math.random(),
          });
      }
      return members;
  }, []);

  const excitementClass = isOpponentHit ? 'animate-bounce' : 'animate-pulse';
  
  // Dynamic Ropes
  const ropeClass = isOpponentHit ? 'translate-y-1 duration-75' : 'translate-y-0 duration-500';

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        
        {/* -- CROWD LAYER -- */}
        {/* Sits far back, pixelated blobs */}
        <div className="absolute top-[15%] w-full h-[25%] bg-slate-900 opacity-80 flex flex-wrap content-end justify-center perspective-500">
            {crowd.map((member, i) => (
                <div 
                    key={i}
                    className={`absolute rounded-full ${excitementClass}`}
                    style={{
                        left: `${member.x}%`,
                        top: `${member.y}%`,
                        width: `${member.size}px`,
                        height: `${member.size}px`,
                        backgroundColor: member.color,
                        animationDelay: `${member.delay}s`,
                        animationDuration: isOpponentHit ? '0.2s' : `${member.duration}s`
                    }}
                >
                    {/* Flashbulbs on hit */}
                    {isOpponentHit && Math.random() > 0.8 && (
                        <div className="absolute inset-0 bg-white rounded-full animate-ping"></div>
                    )}
                </div>
            ))}
        </div>
        
        {/* -- ARENA LIGHTS -- */}
        <div className="absolute top-0 w-full h-full">
             <div className="absolute top-0 left-[20%] w-[100px] h-[600px] bg-blue-500/10 rotate-[20deg] blur-2xl origin-top animate-pulse"></div>
             <div className="absolute top-0 right-[20%] w-[100px] h-[600px] bg-purple-500/10 rotate-[-20deg] blur-2xl origin-top animate-pulse delay-700"></div>
             
             {/* Moving Spotlight */}
             <div className="absolute top-[-50px] left-1/2 w-[200px] h-[800px] bg-white/5 blur-3xl origin-top animate-[spin_8s_infinite_linear_alternate]"></div>
        </div>

        {/* -- BOXING RING -- */}
        <div className="absolute top-[35%] w-full">
             {/* Turnbuckles (Far) */}
             <div className="absolute left-0 top-0 w-8 h-32 bg-slate-800 border-r-2 border-slate-600"></div>
             <div className="absolute right-0 top-0 w-8 h-32 bg-slate-800 border-l-2 border-slate-600"></div>
             
             {/* Ropes (Back) */}
             <div className={`w-full h-2 bg-gradient-to-b from-blue-700 to-blue-900 mb-8 shadow-lg transform ${ropeClass}`}></div>
             <div className={`w-full h-2 bg-gradient-to-b from-white to-slate-300 mb-8 shadow-lg transform ${ropeClass} delay-75`}></div>
             <div className={`w-full h-2 bg-gradient-to-b from-red-700 to-red-900 shadow-lg transform ${ropeClass} delay-100`}></div>
        </div>
    </div>
  );
};

export default Background;
