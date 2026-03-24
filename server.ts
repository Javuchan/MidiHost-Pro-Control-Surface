{
  "name": "midihost-pro-control",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build",
    "lint": "tsc --noEmit",
    "preview": "vite preview",
    "start": "tsx server.ts"
  },
  "dependencies": {
    "@google/genai": "^1.37.0",
    "@tailwindcss/vite": "^4.2.2",
    "express": "^5.2.1",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "socket.io": "^4.8.3",
    "socket.io-client": "^4.8.3",
    "tailwindcss": "^4.2.2",
    "tsx": "^4.21.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.6",
    "@types/node": "^22.14.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}
