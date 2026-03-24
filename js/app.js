import { db, auth } from './firebase-config.js';
import { 
    signInWithPopup, GoogleAuthProvider, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, runTransaction, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let board, game = new Chess(), playerColor = null, pendingMove = null, currentUser = null;
let selectedSquare = null;

const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 ('ontouchstart' in window && window.innerWidth < 768);

// --- ИНИЦИАЛИЗАЦИЯ ---
window.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) initGame(roomId); else initLobby();
});

// --- АВТОРИЗАЦИЯ ---
function setupAuth() {
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        const authGroup = document.getElementById('auth-buttons');
        const userInfo = document.getElementById('user-info');
        if (user) {
            authGroup?.classList.add('hidden');
            userInfo?.classList.remove('hidden');
            document.getElementById('user-name').innerText = user.displayName || user.email.split('@')[0];
            document.getElementById('user-photo').src = user.photoURL || 'https://via.placeholder.com/35';
            if (!new URLSearchParams(window.location.search).get('room')) loadLobby(user);
        } else {
            authGroup?.classList.remove('hidden');
            userInfo?.classList.add('hidden');
        }
    });

    // Google Login
    document.getElementById('login-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());

    // Email Modal Controls
    const emailModal = document.getElementById('email-modal');
    const emailError = document.getElementById('email-error');
    
    const showError = (msg) => {
        emailError.innerText = msg;
        emailError.classList.remove('hidden');
    };

    document.getElementById('login-email-trigger').onclick = () => {
        emailError.classList.add('hidden');
        emailModal.classList.remove('hidden');
    };
    
    document.getElementById('close-email-modal').onclick = () => emailModal.classList.add('hidden');

    // Кнопка: ВОЙТИ
    document.getElementById('login-email-btn').onclick = async () => {
        const email = document.getElementById('email-input').value.trim();
        const pass = document.getElementById('password-input').value;
        if (!email || !pass) return showError("Введите почту и пароль");

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            emailModal.classList.add('hidden');
        } catch (err) {
            console.error("Login Error:", err.code);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
                showError("Неверная почта или пароль");
            } else if (err.code === 'auth/wrong-password') {
                showError("Неверный пароль");
            } else {
                showError("Ошибка входа: " + err.message);
            }
        }
    };

    // Кнопка: РЕГИСТРАЦИЯ
    document.getElementById('register-email-btn').onclick = async () => {
        const email = document.getElementById('email-input').value.trim();
        const pass = document.getElementById('password-input').value;
        
        if (!email) return showError("Введите почту");
        if (pass.length < 6) return showError("Пароль должен быть от 6 символов");

        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            emailModal.classList.add('hidden');
            alert("Аккаунт успешно создан!");
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                showError("Эта почта уже зарегистрирована");
            } else if (err.code === 'auth/invalid-email') {
                showError("Некорректный формат почты");
            } else {
                showError("Ошибка регистрации: " + err.message);
            }
        }
    };

    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => location.href = location.origin + location.pathname);
}

// --- ОСТАЛЬНАЯ ЛОГИКА (БЕЗ ИЗМЕНЕНИЙ) ---

function initLobby() {
    document.getElementById('lobby-section').classList.remove('hidden');
    document.getElementById('game-section').classList.add('hidden');
    document.getElementById('create-game-btn').onclick = () => {
        const id = Math.random().toString(36).substring(2, 8);
        location.href = location.origin + location.pathname + `?room=${id}`;
    };
}

function loadLobby(user) {
    const list = document.getElementById('games-list');
    onValue(ref(db, `games`), (snap) => {
        list.innerHTML = '';
        const games = snap.val();
        if (!games) { list.innerHTML = "Нет активных партий"; return; }
        const sortedGames = Object.entries(games).sort((a, b) => (a[1].gameState === 'game_over' ? 1 : 0) - (b[1].gameState === 'game_over' ? 1 : 0));
        sortedGames.forEach(([id, data]) => {
            const p = data.players;
            if (p && (p.white === user.uid || p.black === user.uid)) {
                const isOver = data.gameState === 'game_over';
                const opp = (p.white === user.uid) ? (p.blackName || "Ожидание...") : (p.whiteName || "Ожидание...");
                const item = document.createElement('div');
                item.className = `game-item ${isOver ? 'finished' : 'active'}`;
                item.innerHTML = `<div class="game-info"><div>Против: <b>${opp}</b></div><small>${isOver ? data.message : "Идет игра"}</small></div><button class="btn btn-sm">Играть</button>`;
                item.onclick = () => location.href = location.origin + location.pathname + `?room=${id}`;
                list.appendChild(item);
            }
        });
    });
}

async function initGame(roomId) {
    document.getElementById('game-section').classList.remove('hidden');
    document.getElementById('lobby-section').classList.add('hidden');
    const user = await new Promise(res => { const unsub = onAuthStateChanged(auth, u => { unsub(); res(u); }); });
    const uid = user ? user.uid : 'anon_' + Math.random().toString(36).substring(2, 9);
    const uName = user ? (user.displayName || user.email.split('@')[0]) : 'Аноним';
    const gameRef = ref(db, `games/${roomId}`);
    const playersRef = ref(db, `games/${roomId}/players`);
    await runTransaction(playersRef, (p) => {
        if (!p) return { white: uid, whiteName: uName };
        if (p.white === uid || p.black === uid) return;
        if (!p.black) return { ...p, black: uid, blackName: uName };
        return;
    });
    const p = (await get(playersRef)).val();
    playerColor = p.white === uid ? 'w' : (p.black === uid ? 'b' : null);
   // Конфигурация доски в стиле Dark Folk
board = Chessboard('myBoard', {
    draggable: !isMobile,
    onDrop: handleDrop,
    position: 'start',
    moveSpeed: 'slow',
    // ЗАМЕНА НА ТЕМУ ALPHA
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/alpha/{piece}.png'
});
    if (playerColor === 'b') board.orientation('black');
    document.getElementById('user-color').innerText = playerColor === 'w' ? 'Белые' : 'Черные';
    $('#myBoard').on('click', '.square-55d63', function() {
        if (!isMobile) return; 
        handleSquareClick($(this).attr('data-square'));
    });
    onValue(gameRef, (snap) => {
        const data = snap.val();
        if (!data) return;
        if (data.pgn && data.pgn !== game.pgn()) { game.load_pgn(data.pgn); board.position(game.fen(), true); }
        updateUI(data);
    });
    setupGameControls(gameRef, roomId);
}

function handleSquareClick(square) {
    if (game.game_over() || !playerColor || game.turn() !== playerColor || pendingMove) return;
    if (selectedSquare === square) { removeHighlights(); selectedSquare = null; return; }
    const piece = game.get(square);
    if (selectedSquare) {
        if (piece && piece.color === playerColor) { selectSquare(square); return; }
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
            pendingMove = move;
            board.position(game.fen(), true);
            document.getElementById('confirm-move-box').classList.remove('hidden');
            removeHighlights();
            selectedSquare = null;
        } else { removeHighlights(); selectedSquare = null; }
    } else if (piece && piece.color === playerColor) { selectSquare(square); }
}

function selectSquare(square) {
    removeHighlights();
    selectedSquare = square;
    $(`.square-${square}`).addClass('highlight-selected');
    game.moves({ square: square, verbose: true }).forEach(m => $(`.square-${m.to}`).addClass('highlight-possible'));
}

function removeHighlights() { $('#myBoard .square-55d63').removeClass('highlight-selected highlight-possible'); }

function handleDrop(source, target) {
    if (game.game_over() || !playerColor || game.turn() !== playerColor || pendingMove) return 'snapback';
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    pendingMove = move;
    setTimeout(() => board.position(game.fen(), true), 100);
    document.getElementById('confirm-move-box').classList.remove('hidden');
    return move;
}

function setupGameControls(gameRef, roomId) {
    document.getElementById('confirm-btn').onclick = () => {
        if (!pendingMove) return;
        const updateData = { pgn: game.pgn(), fen: game.fen(), turn: game.turn() };
        if (game.game_over()) { updateData.gameState = 'game_over'; updateData.message = getGameResultMessage(); }
        update(gameRef, updateData);
        pendingMove = null;
        document.getElementById('confirm-move-box').classList.add('hidden');
    };
    document.getElementById('undo-btn').onclick = () => {
        game.undo(); board.position(game.fen(), true);
        pendingMove = null;
        document.getElementById('confirm-move-box').classList.add('hidden');
    };
    document.getElementById('resign-btn').onclick = () => {
        if (confirm("Сдаться?")) update(gameRef, { gameState: 'game_over', message: `${playerColor === 'w' ? 'Черные' : 'Белые'} победили` });
    };
    document.getElementById('exit-btn').onclick = () => location.href = location.origin + location.pathname;
}

function getGameResultMessage() {
    if (game.in_checkmate()) return `Мат! ${game.turn() === 'w' ? 'Черные' : 'Белые'} победили`;
    return game.in_draw() ? "Ничья" : "Игра окончена";
}

function updateUI(data) {
    const isMyTurn = (playerColor === game.turn());
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.innerText = `Ход: ${game.turn() === 'w' ? 'Белых' : 'Черных'}`;
    updateTurnIndicator(isMyTurn);
    if (data.gameState === 'game_over' && !document.getElementById('game-section').classList.contains('hidden')) {
        document.getElementById('game-modal').classList.remove('hidden');
        document.getElementById('modal-desc').innerText = data.message || getGameResultMessage();
    }
}

function updateTurnIndicator(isMyTurn) {
    const indicator = document.getElementById('turn-indicator');
    const textEl = document.getElementById('turn-text');
    if (!indicator || !textEl) return;
    indicator.className = isMyTurn ? 'turn-indicator my-turn' : 'turn-indicator opponent-turn';
    textEl.innerText = isMyTurn ? '🎯 ВАШ ХОД' : '⏳ Ход соперника';
}
