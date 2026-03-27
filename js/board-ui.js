// ==================== УПРАВЛЕНИЕ ДОСКОЙ ====================
// Отвечает за: инициализацию доски, подсветку клеток, drag-and-drop

// Инициализация доски
window.initBoard = function(playerColor) {
    const boardConfig = {
        draggable: true,
        onDragStart: window.handleDragStart,
        onDrop: window.handleDrop,
        onMouseoutSquare: window.handleMouseoutSquare,
        onMouseoverSquare: window.handleMouseoverSquare,
        position: 'start',
        moveSpeed: 'slow',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/alpha/{piece}.png'
    };
    
    window.board = Chessboard('myBoard', boardConfig);
    
    if (playerColor === 'b') window.board.orientation('black');
    
    // Для мобильных устройств используем клики
    if (window.isMobile) {
        window.attachMobileClickHandler();
    }
    
    return window.board;
};

// Проверка перед началом перетаскивания
window.handleDragStart = function(source, piece, position, orientation) {
    // Не разрешаем перетаскивание, если:
    // - игра окончена
    // - нет цвета игрока
    // - не наш ход
    // - есть ожидающий подтверждения ход
    if (window.game.game_over() || 
        !window.playerColor || 
        window.game.turn() !== window.playerColor || 
        window.pendingMove) {
        return false;
    }
    
    // Проверяем, что перетаскиваем свою фигуру
    const pieceColor = piece.charAt(0);
    if ((window.playerColor === 'w' && pieceColor === 'b') ||
        (window.playerColor === 'b' && pieceColor === 'w')) {
        return false;
    }
    
    // Сохраняем источник для подсветки
    window.dragSourceSquare = source;
    window.showPossibleMoves(source);
    
    return true;
};

// Подсветка при наведении на клетку
window.handleMouseoverSquare = function(square, piece) {
    if (!window.playerColor || window.game.game_over() || window.pendingMove) return;
    
    // Если перетаскиваем фигуру - показываем ходы (уже показаны в onDragStart)
    if (window.dragSourceSquare) return;
    
    // Если наводим на свою фигуру и это наш ход - показываем её возможные ходы
    if (piece && piece.charAt(0) === window.playerColor && window.game.turn() === window.playerColor) {
        window.showPossibleMoves(square);
    }
};

// Убираем подсветку при уходе мыши
window.handleMouseoutSquare = function(square, piece) {
    // Если не перетаскиваем фигуру и нет выбранной фигуры - убираем подсветку
    if (!window.dragSourceSquare && !window.selectedSquare) {
        window.removeTemporaryHighlights();
    }
};

// Показ возможных ходов для фигуры
window.showPossibleMoves = function(square) {
    window.removeTemporaryHighlights();
    
    // Подсвечиваем текущую клетку
    window.highlightSquare(square, 'highlight-drag-source');
    
    // Получаем все возможные ходы для выбранной фигуры
    const moves = window.game.moves({ square: square, verbose: true });
    
    moves.forEach(move => {
        if (move.captured) {
            window.highlightSquare(move.to, 'highlight-capture');
        } else {
            window.highlightSquare(move.to, 'highlight-possible');
        }
    });
    
    window.currentHighlightSquare = square;
};

// Убираем временную подсветку
window.removeTemporaryHighlights = function() {
    $('#myBoard .square-55d63').removeClass('highlight-drag-source highlight-possible highlight-capture');
};

// Обработка сброса фигуры (drag-and-drop)
window.handleDrop = function(source, target) {
    // Убираем подсветку
    window.removeTemporaryHighlights();
    
    // Проверки
    if (window.game.game_over() || !window.playerColor || window.game.turn() !== window.playerColor || window.pendingMove) {
        window.dragSourceSquare = null;
        return 'snapback';
    }
    
    // Пробуем сделать ход
    const move = window.game.move({ from: source, to: target, promotion: 'q' });
    
    if (move === null) {
        window.dragSourceSquare = null;
        return 'snapback';
    }
    
    // Ход валидный - сохраняем для подтверждения
    window.pendingMove = { from: source, to: target };
    
    // Откатываем ход
    window.game.undo();
    
    // Показываем предварительный ход
    window.game.move({ from: source, to: target, promotion: 'q' });
    window.updateBoardPosition(window.game.fen(), false);
    window.game.undo();
    
    // Показываем оверлей подтверждения
    document.getElementById('confirm-move-box')?.classList.remove('hidden');
    
    window.dragSourceSquare = null;
    return 'snapback';
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

// Прикрепление обработчика кликов для мобильных устройств
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

// Выделение фигуры (для мобильной версии)
window.selectSquare = function(square) {
    window.clearSelection();
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
};

// Сброс выделения
window.clearSelection = function() {
    window.selectedSquare = null;
    window.removeHighlights();
};

// Обновление позиции доски
window.updateBoardPosition = function(fen, animate = true) {
    if (window.board) {
        window.board.position(fen, animate);
    }
};

// Полная очистка подсветки
window.removeHighlights = function() {
    $('#myBoard .square-55d63').removeClass('highlight-selected highlight-drag-source highlight-possible highlight-capture');
};

// Подсветка клетки
window.highlightSquare = function(square, type) {
    $(`.square-${square}`).addClass(type);
};

// Обновление ориентации доски
window.setBoardOrientation = function(color) {
    if (window.board) {
        window.board.orientation(color === 'b' ? 'black' : 'white');
    }
};
