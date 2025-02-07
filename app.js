const express = require("express");
const socket = require("socket.io");
const http = require("http");
const {Chess} = require("chess.js");
const path = require("path");

const app = express();
const PORT = 3000;

const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};
let currentPlayer = "w";
let gameStarted = false;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", {title: "Chess game"});
});

io.on("connection", function(uniquesocket) {
    console.log(`New connection - Socket ID: ${uniquesocket.id}`);

    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
        console.log(`Player 1 (White) connected - http://localhost:${PORT}`);
    }
    else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
        console.log(`Player 2 (Black) connected - http://localhost:${PORT}`);
    }
    else {
        uniquesocket.emit("spectatorRole");
        console.log(`Spectator connected - http://localhost:${PORT}`);
    }

    // Log current game status
    console.log(`Connected players: ${Object.keys(players).length}`);
    console.log(`Game started: ${gameStarted}`);

    uniquesocket.on("disconnect", function() {
        if (uniquesocket.id === players.white) {
            console.log("Player 1 (White) disconnected");
            delete players.white;
        }
        else if (uniquesocket.id === players.black) {
            console.log("Player 2 (Black) disconnected");
            delete players.black;
        }
        else {
            console.log("Spectator disconnected");
        }

        if (Object.keys(players).length === 0) {
            gameStarted = false;
            console.log("Game reset - waiting for players");
        }
    });

    uniquesocket.on("move", (move) => {
        try {
            if (!gameStarted) {
                console.log("Move rejected - game not started");
                return;
            }
            if (chess.turn() === "w" && uniquesocket.id !== players.white) {
                console.log("Invalid turn - not White's move");
                return;
            }
            if (chess.turn() === "b" && uniquesocket.id !== players.black) {
                console.log("Invalid turn - not Black's move");
                return;
            }

            const result = chess.move(move);
            if (result) {
                currentPlayer = chess.turn();
                io.emit("move", move);
                io.emit("boardState", chess.fen());
                console.log(`Valid move: ${move.from} to ${move.to}`);
            }
            else {
                console.log(`Invalid move: ${JSON.stringify(move)}`);
                uniquesocket.emit("invalidMove", move);
            }
        } catch(err) {
            console.error("Move error:", err);
            uniquesocket.emit("invalidMove", move);
        }
    });

    if (Object.keys(players).length === 2 && !gameStarted) {
        gameStarted = true;
        io.emit("gameStarted");
        io.emit("boardState", chess.fen());
        console.log("Game started - both players connected");
    }
});

server.listen(PORT, function() {
    console.log(`\nChess server running on http://localhost:${PORT}`);
    console.log("Waiting for players to connect...");
});