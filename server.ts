import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import { nanoid } from "nanoid";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
  teamId: string;
  kills: number;
  isDead: boolean;
  angle: number;
}

interface GameState {
  players: Record<string, Player>;
  bullets: any[];
  zone: {
    x: number;
    y: number;
    radius: number;
    targetRadius: number;
  };
}

const MAP_SIZE = 2000;
const INITIAL_ZONE_RADIUS = 1200;

const games: Record<string, GameState> = {};

// Simple room management
// For this demo, we'll have a few global rooms for Solo, Duo, Squad
const rooms = {
  solo: { id: 'solo-room', mode: 'solo', players: [] as string[] },
  duo: { id: 'duo-room', mode: 'duo', players: [] as string[] },
  squad: { id: 'squad-room', mode: 'squad', players: [] as string[] },
};

const gameState: GameState = {
  players: {},
  bullets: [],
  zone: {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    radius: INITIAL_ZONE_RADIUS,
    targetRadius: INITIAL_ZONE_RADIUS,
  },
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ name, mode }) => {
    const teamId = mode === 'solo' ? socket.id : (mode === 'duo' ? `team-d-${Math.floor(Object.keys(gameState.players).length / 2)}` : `team-s-${Math.floor(Object.keys(gameState.players).length / 4)}`);
    
    gameState.players[socket.id] = {
      id: socket.id,
      name: name || "Player",
      x: Math.random() * MAP_SIZE,
      y: Math.random() * MAP_SIZE,
      health: 100,
      teamId,
      kills: 0,
      isDead: false,
      angle: 0,
    };

    socket.emit("init", { id: socket.id, gameState, mapSize: MAP_SIZE });
    io.emit("playerJoined", gameState.players[socket.id]);
  });

  socket.on("move", (data) => {
    const player = gameState.players[socket.id];
    if (player && !player.isDead) {
      player.x = Math.max(0, Math.min(MAP_SIZE, data.x));
      player.y = Math.max(0, Math.min(MAP_SIZE, data.y));
      player.angle = data.angle;
    }
  });

  socket.on("shoot", (data) => {
    const player = gameState.players[socket.id];
    if (player && !player.isDead) {
      gameState.bullets.push({
        id: nanoid(),
        ownerId: socket.id,
        teamId: player.teamId,
        x: player.x,
        y: player.y,
        angle: player.angle,
        speed: 15,
        distance: 0,
        maxDistance: 600,
      });
    }
  });

  socket.on("disconnect", () => {
    delete gameState.players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

// Game Loop
setInterval(() => {
  // Update Bullets
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;
    b.distance += b.speed;

    if (b.distance > b.maxDistance) {
      gameState.bullets.splice(i, 1);
      continue;
    }

    // Collision detection
    for (const pid in gameState.players) {
      const p = gameState.players[pid];
      if (p.id !== b.ownerId && p.teamId !== b.teamId && !p.isDead) {
        const dist = Math.sqrt((p.x - b.x) ** 2 + (p.y - b.y) ** 2);
        if (dist < 20) {
          p.health -= 20;
          gameState.bullets.splice(i, 1);
          
          if (p.health <= 0) {
            p.isDead = true;
            const killer = gameState.players[b.ownerId];
            if (killer) killer.kills++;
            io.emit("playerKilled", { victim: p.id, killer: b.ownerId });
          }
          break;
        }
      }
    }
  }

  // Update Zone
  if (gameState.zone.radius > 50) {
    gameState.zone.radius -= 0.1;
  }

  // Zone Damage
  for (const pid in gameState.players) {
    const p = gameState.players[pid];
    if (!p.isDead) {
      const distToCenter = Math.sqrt((p.x - gameState.zone.x) ** 2 + (p.y - gameState.zone.y) ** 2);
      if (distToCenter > gameState.zone.radius) {
        p.health -= 0.5;
        if (p.health <= 0) {
          p.isDead = true;
          io.emit("playerKilled", { victim: p.id, killer: "ZONE" });
        }
      }
    }
  }

  io.emit("gameStateUpdate", gameState);
}, 1000 / 30);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
