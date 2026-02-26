import { Server } from 'socket.io';

interface Player {
	id: string;
	x: number;
	y: number;
	color: string;
	inputs: {
		up: boolean;
		down: boolean;
		left: boolean;
		right: boolean;
	};
}

interface Obstacle {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface GameState {
	players: Record<string, Player>;
	box: { x: number; y: number; width: number; height: number; vx: number; vy: number };
	goal: { x: number; y: number; width: number; height: number };
	obstacles: Obstacle[];
	status: 'playing' | 'won';
	latency: number; // ms
}

const TICK_RATE = 60;
const PLAYER_SPEED = 5;
const PLAYER_SIZE = 20;
const FRICTION = 0.9;
const BOX_PUSH_STRENGTH = 1.2;

export const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server: any) {
		if (!server.httpServer) return;

		const io = new Server(server.httpServer);

		let gameState: GameState = {
			players: {},
			box: { x: 375, y: 275, width: 50, height: 50, vx: 0, vy: 0 },
			goal: { x: 700, y: 250, width: 100, height: 100 },
			obstacles: [
				{ x: 200, y: 150, width: 20, height: 300 },
				{ x: 550, y: 150, width: 20, height: 300 }
			],
			status: 'playing',
			latency: 0
		};

		const checkCollision = (rect1: any, rect2: any) => {
			return rect1.x < rect2.x + rect2.width &&
				rect1.x + rect1.width > rect2.x &&
				rect1.y < rect2.y + rect2.height &&
				rect1.y + rect1.height > rect2.y;
		};

		const updatePhysics = () => {
			if (gameState.status !== 'playing') return;

			// Update players
			for (const id in gameState.players) {
				const player = gameState.players[id];
				const oldPos = { x: player.x, y: player.y };

				if (player.inputs.up) player.y -= PLAYER_SPEED;
				if (player.inputs.down) player.y += PLAYER_SPEED;

				// Wall collision Y
				for (const wall of gameState.obstacles) {
					if (checkCollision({ x: player.x, y: player.y, width: PLAYER_SIZE, height: PLAYER_SIZE }, wall)) {
						player.y = oldPos.y;
					}
				}

				if (player.inputs.left) player.x -= PLAYER_SPEED;
				if (player.inputs.right) player.x += PLAYER_SPEED;

				// Wall collision X
				for (const wall of gameState.obstacles) {
					if (checkCollision({ x: player.x, y: player.y, width: PLAYER_SIZE, height: PLAYER_SIZE }, wall)) {
						player.x = oldPos.x;
					}
				}

				// Clamp player
				player.x = Math.max(0, Math.min(800 - PLAYER_SIZE, player.x));
				player.y = Math.max(0, Math.min(600 - PLAYER_SIZE, player.y));

				// Collision with box
				const playerCenterX = player.x + PLAYER_SIZE / 2;
				const playerCenterY = player.y + PLAYER_SIZE / 2;
				const boxCenterX = gameState.box.x + gameState.box.width / 2;
				const boxCenterY = gameState.box.y + gameState.box.height / 2;

				const dx = playerCenterX - boxCenterX;
				const dy = playerCenterY - boxCenterY;
				const distance = Math.sqrt(dx * dx + dy * dy);

				if (distance < 40) {
					const angle = Math.atan2(dy, dx);
					gameState.box.vx -= Math.cos(angle) * BOX_PUSH_STRENGTH;
					gameState.box.vy -= Math.sin(angle) * BOX_PUSH_STRENGTH;
				}
			}

			// Update box physics
			const oldBoxPos = { x: gameState.box.x, y: gameState.box.y };
			gameState.box.x += gameState.box.vx;

			// Box Wall collision X
			for (const wall of gameState.obstacles) {
				if (checkCollision(gameState.box, wall)) {
					gameState.box.x = oldBoxPos.x;
					gameState.box.vx *= -0.5; // Bounce
				}
			}

			gameState.box.y += gameState.box.vy;
			// Box Wall collision Y
			for (const wall of gameState.obstacles) {
				if (checkCollision(gameState.box, wall)) {
					gameState.box.y = oldBoxPos.y;
					gameState.box.vy *= -0.5; // Bounce
				}
			}

			gameState.box.vx *= FRICTION;
			gameState.box.vy *= FRICTION;

			// Clamp box
			if (gameState.box.x < 0) { gameState.box.x = 0; gameState.box.vx = 0; }
			if (gameState.box.x > 800 - gameState.box.width) { gameState.box.x = 800 - gameState.box.width; gameState.box.vx = 0; }
			if (gameState.box.y < 0) { gameState.box.y = 0; gameState.box.vy = 0; }
			if (gameState.box.y > 600 - gameState.box.height) { gameState.box.y = 600 - gameState.box.height; gameState.box.vy = 0; }

			// Win condition
			if (
				gameState.box.x > gameState.goal.x &&
				gameState.box.x + gameState.box.width < gameState.goal.x + gameState.goal.width &&
				gameState.box.y > gameState.goal.y &&
				gameState.box.y + gameState.box.height < gameState.goal.y + gameState.goal.height
			) {
				gameState.status = 'won';
				emitWithLatency('victory');
			}

			emitWithLatency('stateUpdate', gameState);
		};

		const emitWithLatency = (event: string, data?: any) => {
			if (gameState.latency > 0) {
				setTimeout(() => io.emit(event, data), gameState.latency);
			} else {
				io.emit(event, data);
			}
		};

		setInterval(updatePhysics, 1000 / TICK_RATE);

		io.on('connection', (socket) => {
			console.log('User connected:', socket.id);

			gameState.players[socket.id] = {
				id: socket.id,
				x: Math.random() * 700,
				y: Math.random() * 500,
				color: `hsl(${Math.random() * 360}, 70%, 50%)`,
				inputs: { up: false, down: false, left: false, right: false }
			};

			socket.emit('init', { id: socket.id, state: gameState });
			emitWithLatency('playerJoined', gameState.players[socket.id]);

			socket.on('input', (inputs) => {
				const handle = () => {
					if (gameState.players[socket.id]) {
						gameState.players[socket.id].inputs = inputs;
					}
				};
				if (gameState.latency > 0) setTimeout(handle, gameState.latency);
				else handle();
			});

			socket.on('setLatency', (val: number) => {
				gameState.latency = val;
				emitWithLatency('stateUpdate', gameState);
			});

			socket.on('reset', () => {
				gameState = {
					...gameState,
					box: { x: 375, y: 275, width: 50, height: 50, vx: 0, vy: 0 },
					status: 'playing'
				};
				for (const id in gameState.players) {
					gameState.players[id].x = Math.random() * 700;
					gameState.players[id].y = Math.random() * 500;
				}
				emitWithLatency('stateUpdate', gameState);
			});

			socket.on('disconnect', () => {
				delete gameState.players[socket.id];
				emitWithLatency('playerLeft', socket.id);
			});
		});
	}
};
