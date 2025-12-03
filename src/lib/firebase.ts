import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, update, remove, get } from 'firebase/database';

// Firebase 설정 - Vercel 환경변수에서 가져옴
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Database 참조 헬퍼
export const getGameRef = (roomId: string) => ref(database, `rooms/${roomId}`);
export const getGameStateRef = (roomId: string) => ref(database, `rooms/${roomId}/gameState`);

export { database, ref, set, onValue, update, remove, get };
