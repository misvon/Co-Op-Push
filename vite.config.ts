import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { webSocketServer } from './src/lib/server/webSocketServer.js';

export default defineConfig({
	plugins: [sveltekit(), webSocketServer]
});
