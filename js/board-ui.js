// ==================== УПРАВЛЕНИЕ ДОСКОЙ ====================
// Отвечает за: инициализацию доски, подсветку клеток, мобильные клики, эффекты шаха

// Инициализация доски
window.initBoard = function(playerColor) {
    const boardConfig = {
        draggable: !window.isMobile && playerColor !== null,
        onDrop: window.handleDrop,
        position: 'start',
        moveSpeed: 'slow',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/alpha/{piece}.png'
    };
    
    window.board = Chessboard('myBoard', boardConfig);
    
    if (playerColor === 'b') window.board.orientation('black');
    
    if (window.isMobile && playerColor) {
        window.attachMobileClickHandler();
    }
    
    return window.board;
};

// Обновление позиции доски
window.updateBoardPosition = function(fen, animate = true) {
    if (window.board) {
        window.board.position(fen, animate);
    }
};

// Полная очистка всех видов подсветки (оптимизировано)
window.removeHighlights = function() {
    $('#myBoard .square-55d63').removeClass(
        'highlight-selected ' + 
        'highlight-possible ' + 
        'highlight-capture ' + 
        'highlight-drag-source ' + 
        'check-pulse'
    );
};

// Подсветка клетки
window.highlightSquare = function(square, type) {
    $(`.square-${square}`).addClass(type);
};

// Находит клетку, на которой стоит король заданного цвета
window.getKingSquare = function(color) {
    if (!window.game) return null;
    const board = window.game.board();
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece && piece.type === 'k' && piece.color === color) {
                return String.fromCharCode(97 + j) + (8 - i);
            }
        }
    }
    return null;
};

// Логика подсветки короля при шахе и вибрация
window.highlightCheck = function() {
    // Важно: не вызываем removeHighlights здесь целиком, 
    // чтобы не стереть подсветку возможных ходов во время выбора фигуры.
    // Убираем только старый пульс.
    $('#myBoard .square-55d63').removeClass('check-pulse');
    
    if (window.game && window.game.in_check()) {
        const kingSquare = window.getKingSquare(window.game.turn());
        if (kingSquare) {
            window.highlightSquare(kingSquare, 'check-pulse');
            
            // Вибрация: срабатывает только если сейчас ход локального игрока
            const isMyTurn = window.playerColor === window.game.turn();
            if (isMyTurn && navigator.vibrate) {
                navigator.vibrate([100, 50, 100]); // Двойной короткий отклик
            }
        }
    }
};

// Выделение фигуры и подсветка ходов
window.selectSquare = function(square) {
    window.removeHighlights();
    window.selectedSquare = square;
    
    window.highlightSquare(square, 'highlight-selected');
    
    const moves = window.game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        if (move.captured) {
            window.highlightSquare(move.to, 'highlight-capture');
        } else {
            window.highlightSquare(move.to, 'highlight-possible');
        }
    });

    // После перерисовки подсветки ходов, возвращаем индикацию шаха, если он есть
    window.highlightCheck();
};

// Сброс выделения
window.clearSelection = function() {
    window.selectedSquare = null;
    window.removeHighlights();
    // Возвращаем подсветку шаха после очистки ходов
    window.highlightCheck();
};

// Прикрепление обработчика для мобильных устройств
window.attachMobileClickHandler = function() {
    $('#myBoard').off('click');
    $('#myBoard').on('click', '.square-55d63', function(e) {
        e.stopPropagation();
        const square = $(this).attr('data-square');
        if (square) {
            window.handleMobileClick(square);
        }
    });
};

// Обновление ориентации доски
window.setBoardOrientation = function(color) {
    if (window.board) {
        window.board.orientation(color === 'b' ? 'black' : 'white');
    }
};