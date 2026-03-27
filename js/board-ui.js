// ==================== УПРАВЛЕНИЕ ДОСКОЙ ====================
// Отвечает за: инициализацию доски, подсветку клеток, drag-and-drop для десктопа, клики для мобилы

// Инициализация доски
window.initBoard = function(playerColor) {
    const boardConfig = {
        draggable: !window.isMobile,  // Включаем drag-and-drop только на десктопе
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
    
    // Для мобильных устройств используем клики (без drag-and-drop)
    if (window.isMobile && playerColor) {
        window.attachMobileClickHandler();
    }
    
    return window.board;
};

// ==================== ДЕСКТОПНАЯ ЛОГИКА (drag-and-drop) ====================

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
    if (window.isMobile) return;
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
    if (window.isMobile) return;
    // Если не перетаскиваем фигуру - убираем подсветку
    if (!window.dragSourceSquare) {
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
};

// Убираем временную подсветку
window.removeTemporaryHighlights = function() {
    $('#myBoard .square-55d63').removeClass('highlight-drag-source highlight-possible highlight-capture');
};

// Обработка сброса фигуры (drag-and-drop)
window.handleDrop = function(source, target) {
    if (window.isMobile) return 'snapback';
    
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

// ==================== МОБИЛЬНАЯ ЛОГИКА (клики) - ВОЗВРАЩАЕМ КАК БЫЛО ====================

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

// Мобильный клик (оригинальная логика)
window.handleMobileClick = function(square) {
    // Проверки
    if (window.game.game_over()) return;
    if (!window.playerColor) return;
    if (window.game.turn() !== window.playerColor) return;
    if (window.pendingMove) return;
    
    const piece = window.game.get(square);
    
    // Случай 1: Уже есть выбранная фигура
    if (window.selectedSquare) {
        // Если кликнули на ту же фигуру - снимаем выделение
        if (window.selectedSquare === square) {
            window.clearSelection();
            return;
        }
        
        // Пытаемся сделать ход
        const move = window.game.move({ from: window.selectedSquare, to: square, promotion: 'q' });
        
        if (move) {
            // Ход валидный - сохраняем для подтверждения
            window.pendingMove = { from: window.selectedSquare, to: square };
            window.updateBoardPosition(window.game.fen(), true);
            document.getElementById('confirm-move-box').classList.remove('hidden');
            window.clearSelection();
        } else {
            // Ход невалидный - проверяем, может кликнули на другую свою фигуру
            if (piece && piece.color === window.playerColor) {
                // Выбираем новую фигуру
                window.selectSquare(square);
            } else {
                // Кликнули на пустую клетку или фигуру соперника - сбрасываем выделение
                window.clearSelection();
            }
        }
    } 
    // Случай 2: Нет выбранной фигуры
    else {
        // Если кликнули на свою фигуру - выделяем её
        if (piece && piece.color === window.playerColor) {
            window.selectSquare(square);
        }
        // Если кликнули на чужую фигуру или пустую клетку - ничего не делаем
    }
};

// ==================== ОБЩИЕ ФУНКЦИИ ====================

// Выделение фигуры и подсветка доступных ходов (для мобильной версии)
window.selectSquare = function(square) {
    window.clearSelection();
    window.selectedSquare = square;
    
    // Подсветка выбранной клетки
    window.highlightSquare(square, 'highlight-selected');
    
    // Получаем все возможные ходы для выбранной фигуры
    const moves = window.game.moves({ square: square, verbose: true });
    
    moves.forEach(move => {
        if (move.captured) {
            window.highlightSquare(move.to, 'highlight-capture');
        } else {
            window.highlightSquare(move.to, 'highlight-possible');
        }
    });
};

// Сброс выделения и подсветки
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
