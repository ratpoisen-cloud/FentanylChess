// Firebase конфигурация
// Создайте свой проект в Firebase Console и замените эти значения
const firebaseConfig = {
  apiKey: "AIzaSyB_7Eh0wuaNY3eb-42uisssvOrSb6ESi_E",
  authDomain: "fentanylchess.firebaseapp.com",
  databaseURL: "https://fentanylchess-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fentanylchess",
  storageBucket: "fentanylchess.firebasestorage.app",
  messagingSenderId: "578661463625",
  appId: "1:578661463625:web:2877feb0d1a38f4961b198",
  measurementId: "G-N4HCS2P63T"
};

let firebaseApp = null;
let database = null;
let firebaseInitialized = false;

function initFirebase() {
    try {
        if (firebase.apps.length) {
            firebaseApp = firebase.app();
        } else {
            firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        }
        database = firebase.database(firebaseApp);
        
        // Проверка подключения
        database.ref('.info/connected').on('value', (snap) => {
            firebaseInitialized = snap.val() === true;
            updateFirebaseStatus(firebaseInitialized);
        });
        
        return true;
    } catch (e) {
        console.warn('Firebase initialization failed:', e);
        firebaseInitialized = false;
        updateFirebaseStatus(false);
        return false;
    }
}

function updateFirebaseStatus(connected) {
    const statusEl = document.getElementById('tokenStatus');
    const tokenInput = document.getElementById('tokenInput');
    
    if (statusEl) {
        if (connected) {
            statusEl.innerHTML = '<span class="status-dot online"></span> Firebase подключен';
            statusEl.style.color = '#10b981';
        } else {
            statusEl.innerHTML = '<span class="status-dot offline"></span> Локальный режим';
            statusEl.style.color = '#6b6b6b';
        }
    }
    
    if (tokenInput) {
        tokenInput.disabled = !connected;
    }
}

// Экспорт для использования в main.js
window.FirebaseAPI = {
    init: initFirebase,
    getDatabase: () => database,
    isConnected: () => firebaseInitialized
};
