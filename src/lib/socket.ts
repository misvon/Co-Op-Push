import { io } from 'socket.io-client';
import { browser } from '$app/environment';

export const socket = browser ? io() : null;
