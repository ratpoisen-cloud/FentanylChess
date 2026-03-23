import { db, auth } from './firebase-config.js';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { ref, set, onValue, runTransaction, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const provider = new GoogleAuthProvider();
let board, game = new Chess(), playerColor = null, pendingMove = null, currentUser = null;

// --- ЗАПУСК ПРИЛОЖЕНИЯ ---
window.addEventListener('DOMContentLoaded', () => {
    console.log("App Initialized");
    setupAuth();
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        initGame(roomId);
    } else {
        initLobby();
    }
});

// --- БЛОК АВТОРИЗАЦИИ (ИСПРАВЛЕН) ---
function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfo = document.getElementById('user-info');

    if (loginBtn) {
        loginBtn.onclick = async () => {
            console.log("Попытка входа...");
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Ошибка входа:", error.code, error.message);
                alert("Ошибка авторизации: " + error.message);
            }
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            signOut(auth).then(() => {
                window.location.href = window.location.pathname; // Очищаем URL при выходе
            });
        };
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            console.log("Пользователь вошел:", user.displayName);
            if (userInfo) userInfo.classList.remove('hidden');
            if (loginBtn) loginBtn.classList.add('hidden');
            
            const nameEl = document.getElementById('user-name');
            const photoEl = document.getElementById('user-photo');
            if (nameEl) nameEl.innerText = user.displayName.split(' ')[0];
            if (photoEl) photoEl.src = user.photoURL;

            // Если мы в лобби, грузим список игр
            if (!new URLSearchParams(window.location.search).get('room')) {
                loadLobby(user);
            }
        } else {
            console.log("Пользователь не авторизован");
            if (userInfo) userInfo.classList.add('hidden');
            if (loginBtn) loginBtn.classList.remove('hidden');
        }
    });
}

// --- БЛОК ЛОББИ ---
function initLobby() {
    const lobby = document.getElementById('lobby-section');
    const createBtn = document.getElementById('create-game-btn');
    
    if (lobby) lobby.classList.remove('hidden');
    if (createBtn) {
        createBtn.onclick = () => {
            const id = Math.random().toString(36).substring(2, 8);
            // Используем надежный переход
            window.location.href = window.location.origin + window.location.pathname + `?room=${id}`;
        };
    }
}

function loadLobby(user) {
    const list = document.getElementById('games-list');
    if (!list) return;

    onValue(ref(db, `games`), (snap) => {
        list.innerHTML = '';
        const games = snap.val();
        if (!games) {
            list.innerHTML = "У вас пока нет активных игр.";
            return;
        }

        let found = false;
        Object.keys(games).forEach(id => {
            const p = games[id].players;
            if (p && (p.white === user.uid || p.black === user.uid)) {
                found = true;
                const item = document.createElement('div');
                item.className = 'game-item';
                item.innerHTML = `<span>Партия: <b>${id}</b></span> <button class="btn btn-success btn-sm">Войти</button>`;
                item.onclick = () => {
                    window.location.href = window.location.origin + window.location.pathname + `?room=${id}`;
                };
                list.appendChild(item);
            }
        });
        if (!found) list.innerHTML = "У вас пока нет активных игр.";
    }, (err) => {
        console.warn("Доступ к общему списку ограничен:", err.message);
        list.innerHTML = "Войдите или создайте новую игру.";
    });
}

// --- ИГРОВАЯ ЛОГИКА (БЕЗ ИЗМЕНЕНИЙ) ---
function initGame(roomId) {
    const gameSection = document.getElementById('game-section');
    if (gameSection) gameSection.classList.remove('hidden');
    
    const roomLink = document.getElementById('room-link');
    if (roomLink) roomLink.value = window.location.href;

    board = Chessboard('myBoard', {
        draggable: true,
        position: 'start',
        onDragStart,
        onDrop,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });

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

    runTransaction(ref(db, `games/${roomId}/players`), (p) => {
        const uid = auth.currentUser?.uid || 'anon';
        if (!p) { playerColor = 'w'; return { white: uid }; }
        if (!p.black && p.white !== uid) { playerColor = 'b'; return { ...p, black: uid }; }
        playerColor = (p.white === uid) ? 'w' : (p.black === uid ? 'b' : null);
        return;
    }).then(() => {
        if (playerColor === 'b') board.orientation('black');
        const colorEl = document.getElementById('user-color');
        if (colorEl) colorEl.innerText = playerColor === 'w' ? 'Белые' : (playerColor === 'b' ? 'Черные' : 'Зритель');
    });

    setupGameControls(gameRef, roomId);
}

function onDragStart(source, piece) {
    if (game.game_over() || !playerColor || pendingMove) return false;
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1) ||
        (game.turn() !== playerColor)) return false;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (!move) return 'snapback';
    pendingMove = move;
    const confirmBox = document.getElementById('confirm-move-box');
    if (confirmBox) confirmBox.classList.remove('hidden');
}

function setupGameControls(gameRef, roomId) {
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            const updateData = { 
                pgn: game.pgn(), fen: game.fen(), turn: game.turn(), 
                lastMoveBy: auth.currentUser?.uid 
            };
            if (game.game_over()) {
                updateData.gameState = 'game_over';
                updateData.message = game.in_checkmate() ? 'Мат!' : 'Ничья!';
            }
            update(gameRef, updateData);
            pendingMove = null;
            document.getElementById('confirm-move-box').classList.add('hidden');
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = () => {
            game.undo(); board.position(game.fen());
            pendingMove = null;
            document.getElementById('confirm-move-box').classList.add('hidden');
        };
    }

    const rematchBtn = document.getElementById('modal-rematch-btn');
    if (rematchBtn) {
        rematchBtn.onclick = () => {
            runTransaction(ref(db, `games/${roomId}/players`), (p) => {
                if (!p) return p;
                return { white: p.black, black: p.white };
            }).then(() => {
                update(gameRef, { pgn: '', fen: 'start', turn: 'w', gameState: 'playing' });
                location.reload();
            });
        };
    }

    const exitBtns = [document.getElementById('exit-btn'), document.getElementById('modal-exit-btn')];
    exitBtns.forEach(btn => {
        if (btn) btn.onclick = () => window.location.href = window.location.origin + window.location.pathname;
    });

    const linkInput = document.getElementById('room-link');
    if (linkInput) {
        linkInput.onclick = function() {
            this.select();
            document.execCommand('copy');
            alert('Ссылка скопирована!');
        };
    }
}

function updateUI(data) {
    const status = document.getElementById('status');
    const moveList = document.getElementById('move-list');
    const modal = document.getElementById('game-modal');
    
    if (data.gameState === 'game_over') {
        if (modal) modal.classList.remove('hidden');
        const desc = document.getElementById('modal-desc');
        if (desc) desc.innerText = data.message;
    } else {
        if (modal) modal.classList.add('hidden');
    }

    if (status) status.innerText = `Ход: ${game.turn() === 'w' ? 'Белых' : 'Черных'}${game.in_check() ? ' (Шах!)' : ''}`;
    
    if (moveList) {
        moveList.innerHTML = game.history().map((m, i) => 
            (i % 2 === 0 ? `<div class="move-num">${Math.floor(i/2)+1}.</div>` : '') + `<div class="move-item">${m}</div>`
        ).join('');
        moveList.scrollTop = moveList.scrollHeight;
    }

    if (data.turn === playerColor && data.lastMoveBy && data.lastMoveBy !== auth.currentUser?.uid) {
        if (document.hidden && Notification.permission === "granted") {
            new Notification("Твой ход в Fentanyl Chess!");
        }
    }
}
