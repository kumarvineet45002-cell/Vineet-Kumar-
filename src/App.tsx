import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Stage, Layer, Circle, Rect, Text, Group, Line } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, User, Shield, Target, Map as MapIcon, Skull } from 'lucide-react';
import type { Player, GameState, GameMode } from './types';

const MAP_SIZE = 2000;

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('solo');
  const [inGame, setInGame] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const joinGame = () => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('init', ({ id, gameState }) => {
      setMyId(id);
      setGameState(gameState);
      setInGame(true);
    });

    newSocket.on('gameStateUpdate', (newState: GameState) => {
      setGameState(newState);
    });

    newSocket.emit('join', { name: playerName || 'Player', mode: gameMode });
  };

  if (!inGame) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#151619] border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="flex items-center justify-center mb-8">
            <div className="bg-emerald-500 p-3 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold ml-4 tracking-tight italic">BATTLEGROUND</h1>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Survivor Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter name..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Select Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {(['solo', 'duo', 'squad'] as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGameMode(mode)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                      gameMode === mode 
                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : 'bg-black/40 border-white/5 text-white/60 hover:border-white/20'
                    }`}
                  >
                    {mode === 'solo' && <User className="w-5 h-5 mb-2" />}
                    {mode === 'duo' && <Users className="w-5 h-5 mb-2" />}
                    {mode === 'squad' && <Shield className="w-5 h-5 mb-2" />}
                    <span className="text-xs font-bold uppercase tracking-tighter">{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={joinGame}
              className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest"
            >
              Deploy to Arena
            </button>
          </div>
        </motion.div>

        <div className="mt-8 text-white/20 text-[10px] uppercase tracking-[0.3em] font-mono">
          Global Servers: North America (NA)
        </div>
      </div>
    );
  }

  return <GameView socket={socket!} myId={myId!} gameState={gameState!} windowSize={windowSize} />;
}

function GameView({ socket, myId, gameState, windowSize }: { socket: Socket, myId: string, gameState: GameState, windowSize: { width: number, height: number } }) {
  const me = gameState.players[myId];
  const stageRef = useRef<any>(null);

  // Movement handling
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const moveInterval = setInterval(() => {
      if (!me || me.isDead) return;
      let dx = 0;
      let dy = 0;
      const speed = 5;
      if (keys['w'] || keys['arrowup']) dy -= speed;
      if (keys['s'] || keys['arrowdown']) dy += speed;
      if (keys['a'] || keys['arrowleft']) dx -= speed;
      if (keys['d'] || keys['arrowright']) dx += speed;

      if (dx !== 0 || dy !== 0) {
        socket.emit('move', { x: me.x + dx, y: me.y + dy, angle: me.angle });
      }
    }, 1000 / 60);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveInterval);
    };
  }, [me, socket]);

  // Mouse handling for aiming and shooting
  const handleMouseMove = (e: any) => {
    if (!me || me.isDead) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const centerX = windowSize.width / 2;
    const centerY = windowSize.height / 2;
    const angle = Math.atan2(pointer.y - centerY, pointer.x - centerX);
    socket.emit('move', { x: me.x, y: me.y, angle });
  };

  const handleClick = () => {
    if (!me || me.isDead) return;
    socket.emit('shoot', {});
  };

  if (!me) return null;

  const cameraX = windowSize.width / 2 - me.x;
  const cameraY = windowSize.height / 2 - me.y;

  const aliveCount = Object.values(gameState.players).filter(p => !p.isDead).length;

  return (
    <div className="fixed inset-0 bg-[#0f1115] overflow-hidden cursor-crosshair select-none">
      <Stage
        width={windowSize.width}
        height={windowSize.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        ref={stageRef}
      >
        <Layer x={cameraX} y={cameraY}>
          {/* Map Background */}
          <Rect
            x={0}
            y={0}
            width={MAP_SIZE}
            height={MAP_SIZE}
            fill="#1a1c23"
            stroke="#2a2d37"
            strokeWidth={10}
          />
          
          {/* Grid Lines */}
          {Array.from({ length: 21 }).map((_, i) => (
            <React.Fragment key={i}>
              <Line points={[i * 100, 0, i * 100, MAP_SIZE]} stroke="#ffffff05" strokeWidth={1} />
              <Line points={[0, i * 100, MAP_SIZE, i * 100]} stroke="#ffffff05" strokeWidth={1} />
            </React.Fragment>
          ))}

          {/* Zone */}
          <Circle
            x={gameState.zone.x}
            y={gameState.zone.y}
            radius={gameState.zone.radius}
            stroke="#ef4444"
            strokeWidth={4}
            dash={[10, 10]}
          />
          <Rect
            x={-5000}
            y={-5000}
            width={12000}
            height={12000}
            fill="#ef444410"
            listening={false}
          />
          <Circle
            x={gameState.zone.x}
            y={gameState.zone.y}
            radius={gameState.zone.radius}
            fill="#1a1c23"
            globalCompositeOperation="destination-out"
            listening={false}
          />

          {/* Bullets */}
          {gameState.bullets.map((b) => (
            <Circle
              key={b.id}
              x={b.x}
              y={b.y}
              radius={4}
              fill="#fbbf24"
              shadowBlur={10}
              shadowColor="#fbbf24"
            />
          ))}

          {/* Players */}
          {Object.values(gameState.players).map((p) => (
            <Group key={p.id} x={p.x} y={p.y} opacity={p.isDead ? 0.3 : 1}>
              {/* Player Body */}
              <Circle
                radius={20}
                fill={p.id === myId ? '#10b981' : (p.teamId === me.teamId ? '#3b82f6' : '#ef4444')}
                stroke="#ffffff20"
                strokeWidth={2}
              />
              {/* Aim Indicator */}
              {!p.isDead && (
                <Rect
                  x={15}
                  y={-5}
                  width={15}
                  height={10}
                  fill="#ffffff40"
                  rotation={p.angle * (180 / Math.PI)}
                />
              )}
              {/* Name & Health */}
              <Text
                text={p.name}
                y={-40}
                align="center"
                width={100}
                x={-50}
                fill="white"
                fontSize={12}
                fontStyle="bold"
              />
              {!p.isDead && (
                <Rect
                  x={-20}
                  y={-25}
                  width={40}
                  height={4}
                  fill="#000000"
                  cornerRadius={2}
                />
              )}
              {!p.isDead && (
                <Rect
                  x={-20}
                  y={-25}
                  width={(p.health / 100) * 40}
                  height={4}
                  fill={p.health > 50 ? '#10b981' : '#ef4444'}
                  cornerRadius={2}
                />
              )}
              {p.isDead && <Skull x={-10} y={-10} size={20} color="white" />}
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* HUD */}
      <div className="absolute top-6 left-6 flex items-center gap-4">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Health</span>
            <div className="w-48 h-3 bg-white/10 rounded-full mt-1 overflow-hidden">
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: `${me.health}%` }}
                className={`h-full ${me.health > 50 ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Kills</span>
            <span className="text-xl font-black text-white">{me.kills}</span>
          </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-3">
          <Users className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-bold text-white uppercase tracking-widest">
            {aliveCount} <span className="text-white/40 ml-1">Alive</span>
          </span>
        </div>
        <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2">
          <MapIcon className="w-3 h-3 text-white/40" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">NA Server</span>
        </div>
      </div>

      {/* Death Overlay */}
      <AnimatePresence>
        {me.isDead && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <Skull className="w-20 h-20 text-red-500 mx-auto mb-6" />
              <h2 className="text-5xl font-black text-white mb-2 uppercase tracking-tighter italic">Eliminated</h2>
              <p className="text-white/40 uppercase tracking-[0.3em] text-xs mb-8">Better luck next time, survivor</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="block text-[10px] text-white/40 uppercase tracking-widest mb-1">Rank</span>
                  <span className="text-2xl font-black text-white">#{aliveCount + 1}</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <span className="block text-[10px] text-white/40 uppercase tracking-widest mb-1">Kills</span>
                  <span className="text-2xl font-black text-white">{me.kills}</span>
                </div>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white text-black font-black px-12 py-4 rounded-2xl hover:bg-emerald-400 transition-all uppercase tracking-widest"
              >
                Return to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimap */}
      <div className="absolute bottom-6 right-6 w-48 h-48 bg-black/60 backdrop-blur-md border-2 border-white/10 rounded-2xl overflow-hidden">
        <div className="relative w-full h-full">
          {/* Zone on minimap */}
          <div 
            className="absolute border border-red-500/50 rounded-full"
            style={{
              left: `${(gameState.zone.x / MAP_SIZE) * 100}%`,
              top: `${(gameState.zone.y / MAP_SIZE) * 100}%`,
              width: `${(gameState.zone.radius / MAP_SIZE) * 200}%`,
              height: `${(gameState.zone.radius / MAP_SIZE) * 200}%`,
              transform: 'translate(-50%, -50%)'
            }}
          />
          {/* Players on minimap */}
          {Object.values(gameState.players).map(p => (
            <div 
              key={p.id}
              className={`absolute w-1 h-1 rounded-full ${p.id === myId ? 'bg-emerald-500' : (p.teamId === me.teamId ? 'bg-blue-500' : 'bg-red-500')}`}
              style={{
                left: `${(p.x / MAP_SIZE) * 100}%`,
                top: `${(p.y / MAP_SIZE) * 100}%`,
                opacity: p.isDead ? 0 : 1
              }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-white/20 uppercase tracking-widest">
        WASD to Move • Click to Shoot • Mouse to Aim
      </div>
    </div>
  );
}
