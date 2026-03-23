// Основной файл приложения
let chessGame = null;
let canvas = null;
let ctx = null;
let cellSize = 0;
let dragStart = null;
let dragPiece = null;
let dragElement = null;
let isDragging = false;

// Firebase
let currentGameId = null;
let playerColor = null;
let isOnlineMode = false;
let gameListenerRef = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    chessGame = new ChessGame();
    canvas = document.getElementById('chessCanvas');
    ctx = canvas.getContext('2d');
    
    resizeCanvas();
    drawBoard();
    
    // Инициализация Firebase
    FirebaseAPI.init();
    
    // Обработчики событий
    initEventListeners();
    initDragAndDrop();
    
    // Обновление UI
    updateUI();
});

function resizeCanvas() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, 600);
    canvas.width = size;
    canvas.height = size;
    cellSize = size / 8;
    drawBoard();
}

function getPieceSymbol(type, color) {
    const symbols = {
        'king': '♔', 'queen': '♕', 'rook': '♖',
        'bishop': '♗', 'knight': '♘', 'pawn': '♙'
    };
    let sym = symbols[type];
    if (color === 'black') {
        const blackMap = { '♔':'♚', '♕':'♛', '♖':'♜', '♗':'♝', '♘':'♞', '♙':'♟' };
        return blackMap[sym];
    }
    return sym;
}

function drawBoard() {
    if (!chessGame || !ctx) return;
    
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const isLight = (i + j) % 2 === 0;
            ctx.fillStyle = isLight ? '#e8e8e8' : '#2c2c2c';
            ctx.fillRect(j * cellSize,
                         // Добавьте в конец файла main.js для проверки
setTimeout(() => {
    if (FirebaseAPI && FirebaseAPI.isConnected()) {
        console.log('✅ Firebase работает!');
        const db = FirebaseAPI.getDatabase();
        if (db) {
            // Тестовая запись
            db.ref('test').set({ message: 'Hello from chess game!' });
            console.log('📝 Тестовая запись создана');
        }
    } else {
        console.warn('⚠️ Firebase не подключен');
    }
}, 2000);
