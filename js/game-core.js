// ==================== ИГРОВАЯ ЛОГИКА ====================
// Отвечает за: лобби, создание/подключение к игре, ходы, синхронизацию

// Переменные состояния игры
window.game = null;
window.playerColor = null;
window.pendingMove = null;
window.selectedSquare = null;
window.currentRoomId = null;
window.pendingTakeback = null;

// Лобби
window.initLobby = function() {
    document.getElementById('lobby-section').classList.remove('hidden');
    document.getElementById('game-section').classList.add('hidden');
    document.getElementById('create-game-btn').onclick = () => {
        const id = window.generateRoomId();
        location.href = location.origin + location.pathname + `?room=${id}`;
    };
};

// Загрузка игр в лобби
window.loadLobby = function(user) {
    const list = document.getElementById('games-list');
    window.watchGames((snap) => {
        list.innerHTML = '';
        const games = snap.val();
        if (!games) { list.innerHTML = "Нет активных партий"; return; }
        
        const sortedGames = Object.entries(games).sort((a, b) => (a[1].gameState === 'game_over' ? 1 : 0) - (b[1].gameState === 'game_over' ? 1 : 0));
        let hasGames = false;
        
        sortedGames.forEach(([id, data]) => {
            const p = data.players;
            if (p && (p.white === user.uid || p.black === user.uid)) {
                hasGames = true;
                const isOver = data.gameState === 'game_over';
                const opp = (p.white === user.uid) ? (p.blackName || "Ожидание...") : (p.whiteName || "Ожидание...");
                const item = document.createElement('div');
                item.className = `game-item ${isOver ? 'finished' : 'active'}`;
                item.innerHTML = `<div class="game-info"><div>Против: <b>${opp}</b></div><small>${isOver ? data.message || "Завершена" : "Идет игра"}</small></div><button class="btn btn-sm">Играть</button>`;
                item.onclick = () => location.href = location.origin + location.pathname + `?room=${id}`;
                list.appendChild(item);
            }
        });
        
        if (!hasGames) list.innerHTML = "Нет активных партий";
    });
};

// Инициализация игры
window.initGame = async function(roomId) {
    document.getElementById('game-section').classList.remove('hidden');
    document.getElementById('lobby-section').classList.add('hidden');
    document.getElementById('room-link').value = window.location.href;
    
    const user = await new Promise(res => { 
        const unsub = onAuthStateChanged(window.auth, u => { unsub(); res(u); }); 
    });
    
    const uid = window.getUserId(user);
    const uName = window.getUserName(user);
    const gameRef = window.getGameRef(roomId);
    const playersRef = window.getPlayersRef(roomId);
    
    window.game = new Chess();
    
    const gameCheck = await get(gameRef);
    if (!gameCheck.exists()) {
        await window.createGame(roomId, window.game.pgn(), window.game.fen());
    }
    
    await window.addPlayerToGame(playersRef, uid, uName);
    
    const p = (await get(playersRef)).val() || {};
    window.playerColor = p.white === uid ? 'w' : (p.black === uid ? 'b' : null);
    
    // Обновляем UI
    window.updatePlayerBadge();
    window.initBoard(window.playerColor);
    
    if (window.playerColor === 'b') window.board.orientation('black');
    
    setTimeout(() => {
        if (window.isMobile && window.playerColor) {
            window.attachMobileClickHandler();
        }
    }, 100);
    
    // Синхронизация игры
    window.watchGame(gameRef, (snap) => {
        const data = snap.val();
        if (!data) return;
        if (data.pgn && data.pgn !== window.game.pgn()) { 
            window.game.load_pgn(data.pgn); 
            window.updateBoardPosition(window.game.fen(), true);
            window.pendingMove = null;
            document.getElementById('confirm-move-box').classList.add('hidden');
            window.clearSelection();
        }
        window.updateUI(data);
    });
    
    window.setupGameControls(gameRef, roomId);
    window.currentRoomId = roomId;
};

// Мобильный клик
window.handleMobileClick = function(square) {
    if (window.game.game_over()) return;
    if (!window.playerColor) return;
    if (window.game.turn() !== window.playerColor) return;
    if (window.pendingMove) return;
    
    const piece = window.game.get(square);
    
    if (window.selectedSquare) {
        if (window.selectedSquare === square) {
            window.clearSelection();
            return;
        }
        
        const move = window.game.move({ from: window.selectedSquare, to: square, promotion: 'q' });
        
        if (move) {
            window.game.undo();
            window.pendingMove = { from: window.selectedSquare, to: square };
            window.game.move({ from: window.selectedSquare, to: square, promotion: 'q' });
            window.updateBoardPosition(window.game.fen(), false);
            window.game.undo();
            document.getElementById('confirm-move-box')?.classList.remove('hidden');
            window.clearSelection();
        } else {
            if (piece && piece.color === window.playerColor) {
                window.selectSquare(square);
            } else {
                window.clearSelection();
            }
        }
    } else {
        if (piece && piece.color === window.playerColor) {
            window.selectSquare(square);
        }
    }
};

// Десктопный drag-and-drop
window.handleDrop = function(source, target) {
    if (window.game.game_over() || !window.playerColor || window.game.turn() !== window.playerColor || window.pendingMove) {
        return 'snapback';
    }
    
    const testMove = window.game.move({ from: source, to: target, promotion: 'q' });
    if (testMove === null) return 'snapback';
    
    window.game.undo();
    
    window.pendingMove = { from: source, to: target };
    
    window.game.move({ from: source, to: target, promotion: 'q' });
    window.updateBoardPosition(window.game.fen(), false);
    window.game.undo();
    
    document.getElementById('confirm-move-box')?.classList.remove('hidden');
    
    return 'snapback';
};
