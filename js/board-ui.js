// ==================== УПРАВЛЕНИЕ ДОСКОЙ ====================
// Отвечает за: инициализацию доски, подсветку клеток, мобильные и десктоп клики

// Инициализация доски
window.initBoard = function(playerColor) {
    // Для десктопа тоже используем клики вместо drag-and-drop
    const boardConfig = {
        draggable: false,  // Отключаем drag-and-drop на всех устройствах
        onDrop: null,      // Не используем onDrop
        position: 'start',
        moveSpeed: 'slow',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/alpha/{piece}.png'
    };
    
    window.board = Chessboard('myBoard', boardConfig);
    
    if (playerColor === 'b') window.board.orientation('black');
    
    // Прикрепляем обработчик кликов для всех устройств
    window.attachClickHandler();
    
    return window.board;
};

// Прикрепление обработчика кликов для всех устройств
window.attachClickHandler = function() {
    $('#myBoard').off('click');
    $('#myBoard').on('click', '.square-55d63', function(e) {
        e.stopPropagation();
        const square = $(this).attr('data-square');
        if (square) {
            window.handleSquareClick(square);
        }
    });
    
    // Отключаем перетаскивание изображений
    $('#myBoard').on('dragstart', 'img', function(e) {
        e.preventDefault();
        return false;
    });
};

// Обработка клика по клетке (единая логика для всех устройств)
window.handleSquareClick = function(square) {
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
            // Ход валидный - откатываем и сохраняем для подтверждения
            window.game.undo();
            window.pendingMove = { from: window.selectedSquare, to: square };
            
            // Показываем предварительный ход
            window.game.move({ from: window.selectedSquare, to: square, promotion: 'q' });
            window.updateBoardPosition(window.game.fen(), false);
            window.game.undo();
            
            // Показываем оверлей подтверждения
            document.getElementById('confirm-move-box')?.classList.remove('hidden');
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

// Выделение фигуры и подсветка доступных ходов
window.selectSquare = function(square) {
    window.clearSelection();
    window.selectedSquare = square;
    
    // Подсветка выбранной клетки (зеленым контуром)
    window.highlightSquare(square, 'highlight-selected');
    
    // Получаем все возможные ходы для выбранной фигуры
    const moves = window.game.moves({ square: square, verbose: true });
    
    moves.forEach(move => {
        if (move.captured) {
            // Взятие фигуры - красная подсветка
            window.highlightSquare(move.to, 'highlight-capture');
        } else {
            // Обычный ход - зеленая точка
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

// Сброс подсветки
window.removeHighlights = function() {
    $('#myBoard .square-55d63').removeClass('highlight-selected highlight-possible highlight-capture');
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
