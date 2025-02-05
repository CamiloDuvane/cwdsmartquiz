// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5gjkbcUrcnRVU_5pdFfjGsfKTNVi99fY",
  authDomain: "alunos-9848d.firebaseapp.com", 
  projectId: "alunos-9848d",
  storageBucket: "alunos-9848d.firebasestorage.app",
  messagingSenderId: "697570485120",
  appId: "1:697570485120:web:c9608222a6c770bcf3d765",
  measurementId: "G-ZLTZE4J3P2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export {
  app,
  analytics,
  db,
  auth,
  storage
};