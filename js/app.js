import { db, auth } from './firebase-config.js';
import { 
    signInWithPopup, GoogleAuthProvider, OAuthProvider, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, runTransaction, update, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

let board, game = new Chess(), playerColor = null, pendingMove = null, currentUser = null;
let selectedSquare = null;

// --- ЗАПУСК ---
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

    document.getElementById('login-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
    document.getElementById('login-apple').onclick = () => signInWithPopup(auth, new OAuthProvider('apple.com'));
    
    // Email модалка
    const emailModal = document.getElementById('email-modal');
    document.getElementById('login-email-trigger').onclick = () => emailModal.classList.remove('hidden');
    document.getElementById('close-email-modal').onclick = () => emailModal.classList.add('hidden');
    
    document.getElementById('email-auth-btn').onclick = async () => {
        const email = document.getElementById('email-input').value;
        const pass = document.getElementById('password-input').value;
        const errEl = document.getElementById('email-error');
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            emailModal.classList.add('hidden');
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                try {
                    await createUserWithEmailAndPassword(auth, email, pass);
                    emailModal.classList.add('hidden');
                } catch (e) { errEl.innerText = e.message; errEl.classList.remove('hidden'); }
            } else { errEl.innerText = err.message; errEl.classList.remove('hidden'); }
        }
    };

    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => location.href = location.origin + location.pathname);
}

// --- ЛОББИ ---
function initLobby() {
    document.getElementById('lobby-section').classList.remove('hidden');
    document.getElementById('create-game-btn').onclick = () => {
        const id = Math.random().toString(36).substring(2, 8);
        location.href = location.origin + location.pathname + `?room=${id}`;
    };
}

function loadLobby(user) {
    onValue(ref(db, `games`), (snap) => {
        const list = document.getElementById('games-list');
        list.innerHTML = '';
        const games = snap.val();
        if (!games) { list.innerHTML = "Нет активных партий"; return; }
        Object.keys(games).forEach(id => {
            const p = games[id].players;
            if (p && (p.white === user.uid || p.black === user.uid)) {
                const item = document.createElement('div');
                item.className = 'game-item';
                item.innerHTML = `<span>Партия ${id}</span> <button class="btn btn-success btn-sm">Войти</button>`;
                item.onclick = () => location.href = location.origin + location.pathname + `?room=${id}`;
                list.appendChild(item);
            }
        });
    });
}

// --- ИГРА ---
async function initGame(roomId) {
    document.getElementById('game-section').classList.remove('hidden');
    document.getElementById('room-link').value = window.location.href;

    const user = await new Promise(res => { const unsub = onAuthStateChanged(auth, u => { unsub(); res(u); })});
    const uid = user ? user.uid : 'anon';

    await runTransaction(ref(db, `games/${roomId}/players`), (p) => {
        if (!p) return { white: uid };
        if (p.white === uid || p.black === uid) return;
        if (!p.black) return { ...p, black: uid };
        return;
    });

    const p = (await get(ref(db, `games/${roomId}/players`))).val();
    playerColor = p.white === uid ? 'w' : (p.black === uid ? 'b' : null);

    board = Chessboard('myBoard', {
        draggable: false, // Мобильное управление через клики
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

    $('#myBoard').on('click', '.square-55d63', function() {
        const square = $(this).attr('data-square');
        onSquareClick(square);
    });

    if (playerColor === 'b') board.orientation('black');
    document.getElementById('user-color').innerText = playerColor === 'w' ? 'Белые' : (playerColor === 'b' ? 'Черные' : 'Зритель');

    const gameRef = ref(db, `games/${roomId}`);
    onValue(gameRef, (snap) => {
        const data = snap.val();
        if (!data) return;
        if (data.pgn && data.pgn !== game.pgn()) {
            game.load_pgn(data.pgn);
            board.position(game.fen());
        }
        updateUI(data);
    });

    setupGameControls(gameRef, roomId);
}

function onSquareClick(square) {
    if (game.game_over() || !playerColor || game.turn() !== playerColor || pendingMove) return;

    if (selectedSquare === square) {
        removeHighlight();
        selectedSquare = null;
    } else if (selectedSquare) {
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
            pendingMove = move;
            board.position(game.fen());
            document.getElementById('confirm-move-box').classList.remove('hidden');
            removeHighlight();
            selectedSquare = null;
        } else {
            const piece = game.get(square);
            if (piece && piece.color === playerColor) selectSquare(square);
        }
    } else {
        const piece = game.get(square);
        if (piece && piece.color === playerColor) selectSquare(square);
    }
}

function selectSquare(s) { removeHighlight(); selectedSquare = s; $(`.square-${s}`).addClass('highlight-selected'); }
function removeHighlight() { $('.square-55d63').removeClass('highlight-selected'); }

function setupGameControls(gameRef, roomId) {
    // Подтверждение хода
    document.getElementById('confirm-btn').onclick = () => {
        if (!pendingMove) return;
        const updateData = { pgn: game.pgn(), fen: game.fen(), turn: game.turn(), lastMoveBy: auth.currentUser?.uid };
        if (game.game_over()) { updateData.gameState = 'game_over'; updateData.message = game.in_checkmate() ? 'Мат!' : 'Ничья!'; }
        update(gameRef, updateData);
        pendingMove = null;
        document.getElementById('confirm-move-box').classList.add('hidden');
    };

    // Отмена хода
    document.getElementById('undo-btn').onclick = () => {
        game.undo(); board.position(game.fen());
        pendingMove = null;
        document.getElementById('confirm-move-box').classList.add('hidden');
    };

    // Сдаться
    document.getElementById('resign-btn').onclick = () => {
        if (confirm("Сдаться?")) {
            const win = playerColor === 'w' ? 'Черные' : 'Белые';
            update(gameRef, { gameState: 'game_over', message: `${win} победили (сдача)` });
        }
    };

    document.getElementById('exit-btn').onclick = () => location.href = location.origin + location.pathname;
    document.getElementById('modal-exit-btn').onclick = () => location.href = location.origin + location.pathname;
    
    document.getElementById('modal-rematch-btn').onclick = async () => {
        const p = (await get(ref(db, `games/${roomId}/players`))).val();
        await set(ref(db, `games/${roomId}/players`), { white: p.black || 'anon', black: p.white || 'anon' });
        await update(gameRef, { pgn: '', fen: 'start', turn: 'w', gameState: 'playing' });
        location.reload();
    };

    document.getElementById('room-link').onclick = function() { this.select(); document.execCommand('copy'); alert('Скопировано!'); };
}

function updateUI(data) {
    document.getElementById('status').innerText = `Ход: ${game.turn() === 'w' ? 'Белых' : 'Черных'}`;
    const moves = document.getElementById('move-list');
    if (moves) moves.innerHTML = game.history().map((m, i) => (i%2===0 ? `<span>${i/2+1}.</span>` : '') + `<b>${m}</b>`).join(' ');
    
    if (data.gameState === 'game_over') {
        document.getElementById('game-modal').classList.remove('hidden');
        document.getElementById('modal-desc').innerText = data.message;
    } else {
        document.getElementById('game-modal').classList.add('hidden');
    }
}
