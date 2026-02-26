<script lang="ts">
	import "../app.css";
	import { onMount } from "svelte";
	import { socket } from "$lib/socket";

	// Game state using Svelte 5 runes
	let gameState = $state({
		players: {} as Record<string, any>,
		box: { x: 375, y: 275, width: 50, height: 50 },
		goal: { x: 700, y: 250, width: 100, height: 100 },
		obstacles: [] as any[],
		status: "playing" as "playing" | "won",
		latency: 0,
	});

	let myId = $state("");
	let isConnected = $state(false);
	let hasJoined = $state(false);
	let playerName = $state("");
	let keys = $state(new Set<string>());

	function handleJoin() {
		if (socket && playerName.trim()) {
			socket.emit("join", { name: playerName.trim() });
			hasJoined = true;
		}
	}

	function sendInputs() {
		if (!socket || !isConnected) {
			return;
		}
		
		socket.emit("input", {
			up: keys.has("ArrowUp") || keys.has("w"),
			down: keys.has("ArrowDown") || keys.has("s"),
			left: keys.has("ArrowLeft") || keys.has("a"),
			right: keys.has("ArrowRight") || keys.has("d"),
		});
	}

	function handleReset() {
		if (socket) socket.emit("reset");
	}

	function setLatency(e: any) {
		if (socket) socket.emit("setLatency", parseInt(e.target.value));
	}

	onMount(() => {
		if (!socket) return;

		socket.on("connect", () => {
			isConnected = true;
		});

		socket.on("init", (data) => {
			myId = data.id;
			gameState = data.state;
		});

		socket.on("stateUpdate", (newState) => {
			gameState = newState;
		});

		socket.on("playerJoined", (player) => {
			gameState.players[player.id] = player;
		});

		socket.on("playerLeft", (id) => {
			delete gameState.players[id];
		});

		const handleKey = (e: KeyboardEvent) => {
			if (e.repeat) return;
			if (
				[
					"ArrowUp",
					"ArrowDown",
					"ArrowLeft",
					"ArrowRight",
					"w",
					"a",
					"s",
					"d",
				].includes(e.key)
			) {
				if (e.type === "keydown") keys.add(e.key);
				else keys.delete(e.key);
				sendInputs();
			}
		};

		window.addEventListener("keydown", handleKey);
		window.addEventListener("keyup", handleKey);

		return () => {
			window.removeEventListener("keydown", handleKey);
			window.removeEventListener("keyup", handleKey);
			socket.off();
		};
	});

	const playersList = $derived(Object.values(gameState.players));
</script>

<div class="app-container">
	<div class="game-header">
		<h1>CO-OP PUSH</h1>
		<p style="color: var(--text-secondary); opacity: 0.8;">
			Collaborate to move the box to the goal
		</p>
	</div>

	<div class="game-canvas-container">
		<svg viewBox="0 0 800 600" class="game-canvas">
			<!-- Grid Background -->
			<defs>
				<pattern
					id="grid"
					width="40"
					height="40"
					patternUnits="userSpaceOnUse"
				>
					<path
						d="M 40 0 L 0 0 0 40"
						fill="none"
						stroke="rgba(255,255,255,0.03)"
						stroke-width="1"
					/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#grid)" />

			<!-- Goal Zone -->
			<rect
				x={gameState.goal.x}
				y={gameState.goal.y}
				width={gameState.goal.width}
				height={gameState.goal.height}
				class="goal"
				rx="12"
			/>

			<text
				x={gameState.goal.x + 50}
				y={gameState.goal.y + 115}
				text-anchor="middle"
				fill="var(--goal-color)"
				style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;"
			>
				Goal Zone
			</text>

			<!-- Obstacles -->
			{#each gameState.obstacles as wall}
				<rect
					x={wall.x}
					y={wall.y}
					width={wall.width}
					height={wall.height}
					fill="var(--glass-border)"
					stroke="rgba(255,255,255,0.2)"
					rx="4"
				/>
			{/each}

			<!-- The Box (Shared) -->
			<rect
				x={gameState.box.x}
				y={gameState.box.y}
				width={gameState.box.width}
				height={gameState.box.height}
				fill="var(--accent-secondary)"
				rx="8"
				class="box"
				style="filter: drop-shadow(0 0 15px rgba(0, 229, 255, 0.4));"
			/>

			<!-- Players -->
			{#each playersList as player (player.id)}
				<g class="player">
					<!-- Player Glow -->
					<circle
						cx={player.x + 10}
						cy={player.y + 10}
						r="20"
						fill={player.color}
						fill-opacity="0.15"
					/>
					<rect
						x={player.x}
						y={player.y}
						width="20"
						height="20"
						fill={player.color}
						rx="6"
						stroke="white"
						stroke-width={player.id === myId ? 2 : 0}
					/>
					<text
						x={player.x + 10}
						y={player.y - 10}
						text-anchor="middle"
						fill="white"
						font-size="12"
						font-weight="bold"
						style="text-shadow: 0 0 5px rgba(0,0,0,0.5); pointer-events: none;"
					>
						{player.name || "Anonymous"}
						{player.id === myId ? "(YOU)" : ""}
					</text>
				</g>
			{/each}
		</svg>

		<!-- Win Overlay -->
		<div class="win-overlay" class:show={gameState.status === "won"}>
			<div class="win-title">VICTORY!</div>
			<p style="margin-bottom: 2rem; color: var(--text-secondary);">
				You worked together and reached the goal!
			</p>
			<button class="btn-restart" onclick={handleReset}>Play Again</button
			>
		</div>

		<!-- Join Overlay -->
		{#if !hasJoined}
			<div class="join-overlay">
				<div class="join-card">
					<h2>Welcome to Co-Op Push</h2>
					<p>Enter your name to join the game</p>
					<input
						type="text"
						bind:value={playerName}
						placeholder="Your Name"
						onkeydown={(e) => e.key === "Enter" && handleJoin()}
						maxlength="15"
					/>
					<button onclick={handleJoin} disabled={!playerName.trim()}>
						Join Game
					</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="hud">
		<div class="hud-item" id="status-hud">
			<div class="status-dot" class:connected={isConnected}></div>
			{isConnected ? "Connected" : "Connecting..."}
		</div>
		<div class="hud-item" id="players-hud">
			<span>👥</span>
			{playersList.length} Players
		</div>
		<div
			class="hud-item"
			style="flex-direction: column; align-items: flex-start; gap: 0.25rem;"
		>
			<div
				style="display: flex; align-items: center; gap: 0.5rem; width: 100%;"
			>
				<span>⚡</span> Latency: {gameState.latency}ms
			</div>
			<input
				type="range"
				min="0"
				max="500"
				step="50"
				value={gameState.latency}
				oninput={setLatency}
				style="width: 100%; height: 4px; appearance: none; background: var(--glass-border); border-radius: 2px;"
			/>
		</div>
		<div class="hud-item">
			<span>⌨️</span> WASD to Move
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: #0f0a1e;
	}
	input[type="range"]::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		background: var(--accent-secondary);
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 0 5px var(--accent-secondary);
	}

	.join-overlay {
		position: absolute;
		inset: 0;
		background: rgba(15, 10, 30, 0.9);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		border-radius: 12px;
	}

	.join-card {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		padding: 2.5rem;
		border-radius: 20px;
		text-align: center;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.4s ease-out;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.join-card h2 {
		margin-bottom: 0.5rem;
		background: linear-gradient(
			135deg,
			#fff 0%,
			var(--text-secondary) 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.join-card p {
		color: var(--text-secondary);
		margin-bottom: 2rem;
		font-size: 0.9rem;
	}

	.join-card input {
		width: 100%;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		padding: 1rem;
		border-radius: 10px;
		color: white;
		font-size: 1rem;
		margin-bottom: 1.5rem;
		transition: all 0.3s ease;
	}

	.join-card input:focus {
		outline: none;
		border-color: var(--accent-secondary);
		background: rgba(255, 255, 255, 0.08);
		box-shadow: 0 0 15px rgba(0, 229, 255, 0.1);
	}

	.join-card button {
		width: 100%;
		padding: 1rem;
		background: var(--accent-secondary);
		border: none;
		border-radius: 10px;
		color: #0f0a1e;
		font-weight: bold;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.join-card button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 20px rgba(0, 229, 255, 0.4);
	}

	.join-card button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
