<script lang="ts">
	import "../app.css";
	import { onMount, onDestroy } from "svelte";
	import { socket } from "$lib/socket";
	import * as THREE from "three";
	import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
	import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
	import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

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
	let keys = $state(new Set<string>());
	let canvasContainer: HTMLDivElement;

	// Three.js variables
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let composer: EffectComposer;
	let clock = new THREE.Clock();

	// Meshes map to track objects
	const playerMeshes = new Map<string, THREE.Group>();
	let boxMesh: THREE.Mesh;
	let goalMesh: THREE.Mesh;
	const obstacleMeshes: THREE.Mesh[] = [];

	let playerName = $state("");
	let hasJoined = $state(false);

	function createNameTag(name: string, color: string) {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d");
		canvas.width = 256;
		canvas.height = 128;

		if (context) {
			context.fillStyle = "rgba(0, 0, 0, 0.4)";
			context.roundRect(40, 40, 176, 48, 24);
			context.fill();

			context.font = "bold 32px Inter, sans-serif";
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillStyle = color;
			context.fillText(name, 128, 64);
		}

		const texture = new THREE.CanvasTexture(canvas);
		const spriteMat = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
		});
		const sprite = new THREE.Sprite(spriteMat);
		sprite.scale.set(40, 20, 1);
		sprite.position.y = 35;
		return sprite;
	}

	function handleJoin() {
		if (playerName.trim() && socket) {
			socket.emit("join", { name: playerName.trim() });
			hasJoined = true;
		}
	}

	function sendInputs() {
		if (!socket || !isConnected || !hasJoined) return;
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

	function handleResize() {
		if (!renderer || !camera || !canvasContainer) return;
		const width = canvasContainer.clientWidth;
		const height = canvasContainer.clientHeight;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height);
		composer.setSize(width, height);
	}

	function initThree() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0514);

		camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 2000);
		camera.position.set(400, 500, 700);
		camera.lookAt(400, 0, 300);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(800, 600);
		renderer.setPixelRatio(window.devicePixelRatio);
		canvasContainer.appendChild(renderer.domElement);

		// Post-processing
		const renderScene = new RenderPass(scene, camera);
		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(800, 600),
			1.5,
			0.4,
			0.85,
		);
		composer = new EffectComposer(renderer);
		composer.addPass(renderScene);
		composer.addPass(bloomPass);

		// Lights
		const ambLight = new THREE.AmbientLight(0x404040, 2);
		scene.add(ambLight);

		const pointLight = new THREE.PointLight(0x7c4dff, 2000, 1000);
		pointLight.position.set(400, 300, 300);
		scene.add(pointLight);

		// Floor grid
		const grid = new THREE.GridHelper(2000, 50, 0x4d4d4d, 0x1a1a1a);
		grid.position.y = -1;
		scene.add(grid);

		// Goal
		const goalGeo = new THREE.BoxGeometry(100, 5, 100);
		const goalMat = new THREE.MeshStandardMaterial({
			color: 0x00ff88,
			transparent: true,
			opacity: 0.3,
			emissive: 0x00ff88,
			emissiveIntensity: 2,
		});
		goalMesh = new THREE.Mesh(goalGeo, goalMat);
		scene.add(goalMesh);

		// Goal Particles
		const pointsGeo = new THREE.BufferGeometry();
		const count = 200;
		const positions = new Float32Array(count * 3);
		for (let i = 0; i < count * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * 100;
			positions[i + 1] = Math.random() * 100;
			positions[i + 2] = (Math.random() - 0.5) * 100;
		}
		pointsGeo.setAttribute(
			"position",
			new THREE.BufferAttribute(positions, 3),
		);
		const pointsMat = new THREE.PointsMaterial({
			color: 0x00ff88,
			size: 2,
			transparent: true,
			opacity: 0.6,
		});
		const particles = new THREE.Points(pointsGeo, pointsMat);
		goalMesh.add(particles);

		// Box
		const boxGeo = new THREE.BoxGeometry(50, 50, 50);
		const boxMat = new THREE.MeshStandardMaterial({
			color: 0x00e5ff,
			emissive: 0x00e5ff,
			emissiveIntensity: 1,
		});
		boxMesh = new THREE.Mesh(boxGeo, boxMat);
		scene.add(boxMesh);

		window.addEventListener("resize", handleResize);
		handleResize(); // Initial call

		animate();
	}

	function animate() {
		if (!renderer) return;
		requestAnimationFrame(animate);

		const time = clock.getElapsedTime();

		// Update Goal
		goalMesh.position.set(gameState.goal.x + 50, 0, gameState.goal.y + 50);
		goalMesh.scale.setScalar(1 + Math.sin(time * 2) * 0.05);

		// Update Box
		boxMesh.position.set(gameState.box.x + 25, 25, gameState.box.y + 25);
		boxMesh.rotation.y += 0.01;

		// Update Obstacles
		if (obstacleMeshes.length !== gameState.obstacles.length) {
			obstacleMeshes.forEach((m) => scene.remove(m));
			obstacleMeshes.length = 0;
			gameState.obstacles.forEach((obs) => {
				const geo = new THREE.BoxGeometry(obs.width, 100, obs.height);
				const mat = new THREE.MeshStandardMaterial({
					color: 0x333333,
					metalness: 0.8,
					roughness: 0.2,
				});
				const mesh = new THREE.Mesh(geo, mat);
				mesh.position.set(
					obs.x + obs.width / 2,
					50,
					obs.y + obs.height / 2,
				);
				scene.add(mesh);
				obstacleMeshes.push(mesh);
			});
		}

		// Update Players
		const currentIds = new Set(Object.keys(gameState.players));

		// Remove old players
		for (const [id, mesh] of playerMeshes.entries()) {
			if (!currentIds.has(id)) {
				scene.remove(mesh);
				playerMeshes.delete(id);
			}
		}

		// Add/Update players
		for (const id in gameState.players) {
			const p = gameState.players[id];
			let group = playerMeshes.get(id);
			if (!group) {
				group = new THREE.Group();

				const geo = new THREE.BoxGeometry(20, 20, 20);
				const mat = new THREE.MeshStandardMaterial({
					color: p.color,
					emissive: p.color,
					emissiveIntensity: 0.5,
				});
				const mesh = new THREE.Mesh(geo, mat);
				group.add(mesh);

				const nameTag = createNameTag(p.name, p.color);
				group.add(nameTag);

				scene.add(group);
				playerMeshes.set(id, group);
			}
			group.position.set(p.x + 10, 10, p.y + 10);
			if (id === myId) {
				const mesh = group.children[0] as THREE.Mesh;
				mesh.scale.setScalar(1.2 + Math.sin(time * 10) * 0.1);
			}
		}

		composer.render();
	}

	onMount(() => {
		initThree();

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

	onDestroy(() => {
		if (renderer) {
			renderer.dispose();
		}
	});

	const playersList = $derived(Object.values(gameState.players));
</script>

<div class="app-container">
	<div class="game-header">
		<h1>CO-OP PUSH 3D</h1>
		<p style="color: var(--text-secondary); opacity: 0.8;">
			Collaborate to move the box to the goal
		</p>
	</div>

	<div class="game-canvas-container" bind:this={canvasContainer}>
		<!-- Three.js Appends Canvas Here -->

		<!-- Win Overlay -->
		<div class="win-overlay" class:show={gameState.status === "won"}>
			<div class="win-title">VICTORY!</div>
			<p style="margin-bottom: 2rem; color: var(--text-secondary);">
				You worked together and reached the goal!
			</p>
			<button class="btn-restart" onclick={handleReset}>Play Again</button
			>
		</div>

		<!-- Name Entry Overlay -->
		{#if !hasJoined}
			<div class="name-overlay">
				<div class="name-container">
					<h2>Welcome to Co-Op Push</h2>
					<p>Enter your name to start playing</p>
					<div class="input-group">
						<input
							type="text"
							bind:value={playerName}
							placeholder="Your Name..."
							onkeydown={(e) => e.key === "Enter" && handleJoin()}
							maxlength="15"
						/>
						<button
							class="btn-join"
							onclick={handleJoin}
							disabled={!playerName.trim()}
						>
							Join Game
						</button>
					</div>
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
		background: #0a0514;
	}
	.game-canvas-container :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
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

	.name-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(10, 5, 20, 0.9);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
	}

	.name-container {
		background: var(--glass-bg);
		border: 1px solid var(--glass-border);
		padding: 2.5rem;
		border-radius: 1.5rem;
		text-align: center;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
		width: 400px;
	}

	.name-container h2 {
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		font-size: 1.8rem;
		letter-spacing: -0.02em;
	}

	.name-container p {
		color: var(--text-secondary);
		margin-bottom: 2rem;
		opacity: 0.8;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.input-group input {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--glass-border);
		border-radius: 0.75rem;
		padding: 1rem;
		color: white;
		font-size: 1.1rem;
		outline: none;
		transition: all 0.2s;
	}

	.input-group input:focus {
		border-color: var(--accent-primary);
		background: rgba(255, 255, 255, 0.1);
	}

	.btn-join {
		background: var(--accent-primary);
		color: white;
		border: none;
		border-radius: 0.75rem;
		padding: 1rem;
		font-weight: 600;
		font-size: 1.1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-join:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 5px 15px rgba(124, 77, 255, 0.4);
	}

	.btn-join:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
