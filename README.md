# Co-Op Push

Welcome to **Co-Op Push**, a real-time multiplayer cooperative game built with SvelteKit and Socket.io.

## About the Game

In Co-Op Push, players work together in a shared arena to accomplish a single goal: maneuvering a giant box into the designated Goal Zone. Players must coordinate their movements to navigate around obstacles and push the box successfully. The game features real-time state synchronization, latency simulation controls, and a retro-style glowing aesthetic.

## How to Play

1. **Join the Game**: Enter your preferred player name when you open the game.
2. **Move Your Character**: Use the **W, A, S, D** keys or the **Arrow Keys** to move your player avatar around the arena.
3. **Push the Box**: Move your character against the glowing yellow box to push it. You might need help from other players to steer it effectively.
4. **Win**: Guide the box into the Goal Zone to win the game!

## Getting Started

To run this project locally, you will need Node.js installed.

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template minimal --types ts --install npm .
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
