import { db, auth } from './firebase-config.js';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, runTransaction, update, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const provider = new GoogleAuthProvider();
let currentUser = null;
let board = null;
const ChessInstance = window.Chess || Chess;
let game = new ChessInstance();
let playerColor = null;

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ---
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 8);
        window.history.pushState({}, '', `?room=${roomId}`);
    }
    document.getElementById('room-link').value = window.location.href;

    const gameRef = ref(db, 'games/' + roomId);
    const playersRef = ref(db, 'games/' + roomId + '/players');

    // 1. Быстрая отрисовка доски
    board = Chessboard('myBoard', {
        draggable: true,
        position: 'start',
        onDragStart,
        onDrop,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    // 2. Авторизация
    setupAuth();

    // 3. Логика комнаты и ходов
    setupGameSync(gameRef, playersRef);
    
    // 4. Кнопки
    setupControls(gameRef);
}

function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    loginBtn.onclick = () => signInWithPopup(auth, provider);
    logoutBtn.onclick = () => signOut(auth);

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            document.getElementById('user-name').innerText = user.displayName.split(' ')[0];
            document.getElementById('user-photo').src = user.photoURL;
        } else {
            loginBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
        }
    });
}

function setupGameSync(gameRef, playersRef) {
    runTransaction(playersRef, (players) => {
        if (!players) { playerColor = 'w'; return { white: true }; }
        else if (!players.black) { playerColor = 'b'; return { ...players, black: true }; }
        return;
    }).then(() => {
        const colorName = playerColor === 'w' ? 'Белые' : (playerColor === 'b' ? 'Черные' : 'Зритель');
        document.getElementById('user-color').innerText = colorName;
        if (playerColor === 'b') board.orientation('black');
        if (playerColor === 'b') update(gameRef, { gameState: 'playing' });
    });

    onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Если в базе есть PGN (история), загружаем её. Это чинит отмену на разных устройствах!
        if (data.pgn) {
            game.load_pgn(data.pgn);
        } else if (data.fen) {
            game.load(data.fen);
        }
        
        board.position(game.fen());
        handleGameStateUI(data);
        updateStatusUI();
    });
}

function onDragStart(source, piece) {
    if (game.game_over() || !playerColor) return false;
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1) ||
        (game.turn() !== playerColor)) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    update(ref(db, 'games/' + getRoomId()), {
        fen: game.fen(),
        pgn: game.pgn(), // Сохраняем историю ходов
        turn: game.turn()
    });
}

function setupControls(gameRef) {
    // ИСПРАВЛЕННАЯ ГЛОБАЛЬНАЯ ОТМЕНА
    document.getElementById('undo-btn').onclick = () => {
        game.undo(); // Откат на 1 полуход
        update(gameRef, { 
            fen: game.fen(), 
            pgn: game.pgn(), 
            turn: game.turn() 
        });
    };

    document.getElementById('resign-btn').onclick = () => {
        const msg = `Сдача. Победили ${playerColor === 'w' ? 'Черные' : 'Белые'}`;
        update(gameRef, { gameState: 'game_over', message: msg });
        if (currentUser) {
            push(ref(db, `users/${currentUser.uid}/history`), { result: msg, date: serverTimestamp() });
        }
    };
}

function getRoomId() {
    return new URLSearchParams(window.location.search).get('room');
}

function handleGameStateUI(data) {
    const modal = document.getElementById('game-modal');
    if (data.gameState === 'game_over') {
        modal.classList.remove('hidden');
        document.getElementById('modal-title').innerText = 'Конец игры';
        document.getElementById('modal-desc').innerText = data.message;
    } else {
        modal.classList.add('hidden');
    }
}

function updateStatusUI() {
    const statusEl = document.getElementById('status');
    let status = `Ход: ${game.turn() === 'b' ? 'Черных' : 'Белых'}`;
    if (game.in_check()) status += ' (Шах!)';
    statusEl.innerText = status;
}
