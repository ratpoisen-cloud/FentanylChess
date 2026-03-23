import { db } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

console.log("Скрипт app.js запущен!"); // Проверка старта

// 1. Инициализация комнаты
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get('room');
if (!roomId) {
    roomId = Math.random().toString(36).substring(2, 8);
    window.history.pushState({}, '', `?room=${roomId}`);
}

// Теперь эти строки ДОЛЖНЫ сработать, если скрипт жив
document.getElementById('room-id').innerText = roomId;
document.getElementById('room-link').value = window.location.href;

const gameRef = ref(db, 'games/' + roomId);

// 2. Инициализация игры
let board = null;
// Используем window.Chess для надежности
const ChessInstance = window.Chess || Chess; 
let game = new ChessInstance();
const statusEl = document.getElementById('status');

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' 
    });

    if (move === null) return 'snapback';

    set(gameRef, {
        fen: game.fen(),
        turn: game.turn()
    });
}

onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.fen !== game.fen()) {
        game.load(data.fen);
        board.position(data.fen);
    }
    updateStatus();
});

function updateStatus() {
    let status = '';
    const moveColor = (game.turn() === 'b') ? 'Черных' : 'Белых';

    if (game.in_checkmate()) {
        status = `Мат! ${moveColor} проиграли.`;
    } else if (game.in_draw()) {
        status = 'Ничья!';
    } else {
        status = `Ход ${moveColor}`;
        if (game.in_check()) status += ' (Шах!)';
    }
    statusEl.innerText = status;
}

// 3. Создание доски
// Добавим проверку, загружена ли библиотека Chessboard
if (typeof Chessboard === 'undefined') {
    console.error("Ошибка: Библиотека Chessboard не загружена!");
} else {
    board = Chessboard('myBoard', {
        draggable: true,
        position: 'start',
        onDrop: onDrop,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    console.log("Доска инициализирована");
}

document.getElementById('room-link').onclick = function() {
    this.select();
    document.execCommand("copy");
    alert("Ссылка скопирована!");
};
