export interface Player {
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

export interface Bullet {
  id: string;
  ownerId: string;
  teamId: string;
  x: number;
  y: number;
  angle: number;
}

export interface Zone {
  x: number;
  y: number;
  radius: number;
}

export interface GameState {
  players: Record<string, Player>;
  bullets: Bullet[];
  zone: Zone;
}

export type GameMode = 'solo' | 'duo' | 'squad';
