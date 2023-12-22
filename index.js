"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = require("./db");
var bodyParser = require("body-parser");
var express = require("express");
var cors = require("cors");
var nanoid_1 = require("nanoid");
// import * as dotenv from "dotenv"
var app = express();
app.use(bodyParser());
app.use(cors());
var userRef = db_1.db.collection("users");
var roomRef = db_1.db.collection("rooms");
// REGISTRAR USUARIO, RETORNA ID
app.post("/signup", function (req, res) {
    var nombre = req.body.nombre;
    userRef
        .where("nombre", "==", nombre)
        .get()
        .then(function (dbResponse) {
        // Si no existe, lo creo
        if (dbResponse.empty) {
            userRef.add({
                nombre: nombre
            })
                .then(function (newUserRef) {
                res.json({ id: newUserRef.id });
                console.log("User registered - id: " + newUserRef.id);
            });
        }
        else {
            res.status(400).json({
                message: "user exists"
            });
        }
    });
});
// LOGUEAR USUARIO
app.post("/login", function (req, res) {
    var nombre = req.body.nombre;
    userRef
        .where("nombre", "==", nombre)
        .get()
        .then(function (dbRes) {
        if (!dbRes.empty) {
            var docs = dbRes.docs;
            // Itero los docs para responder con el ID del usuario (es unico ya que solo puede haber 1 por nombre)
            for (var _i = 0, docs_1 = docs; _i < docs_1.length; _i++) {
                var i = docs_1[_i];
                console.log("User logged in: " + i.id);
                res.json({ id: i.id });
            }
            ;
        }
        else {
            res.status(404).json({
                message: "user not found"
            });
        }
        ;
    });
});
//CREAR ROOM
app.post("/rooms", function (req, res) {
    var userId = req.query.userId;
    userRef
        .doc(userId)
        .get()
        .then(function (doc) {
        if (doc.exists) {
            // Si el use existe, creo una referencia nueva en la RTDB
            var newRoomRtdb_1 = db_1.rtdb.ref("/rooms/" + (0, nanoid_1.nanoid)(12));
            var userName_1 = doc.data().nombre;
            newRoomRtdb_1.set({
                owner: userId,
                participants: {
                    owner: {
                        nombre: userName_1,
                        isConnected: true,
                        isReady: false,
                    },
                    opponent: {
                        nombre: null,
                        isConnected: false,
                        isReady: false,
                    }
                },
                sessionPlays: {
                    actual: { owner: "", opponent: "" },
                    thisSession: [0]
                }
            })
                .then(function () {
                // Una vez creada, tomo su ID largo (privada)
                var roomLongId = newRoomRtdb_1.key;
                // Genero una ID corta (publica)
                var roomId = (0, nanoid_1.nanoid)(6).toUpperCase();
                // Genero un DOC en la DB con el dato de la KEY privada
                roomRef
                    .doc(roomId.toString())
                    .set({
                    privateKey: roomLongId,
                    participants: {
                        owner: {
                            nombre: userName_1,
                            id: userId
                        },
                        opponent: {
                            nombre: "",
                            id: ""
                        }
                    },
                    isFull: false,
                    history: [0]
                })
                    .then(function () {
                    res.json({
                        id: roomId
                    });
                    console.log("Room created - id: " + roomId);
                });
            });
        }
        else {
            console.log(req.body);
            res.status(401).json({
                message: "User not found"
            });
        }
    });
});
// INGRESAR A ROOM   ---- retorna la room ID para la RTDB
app.get("/rooms", function (req, res) {
    // User ID del opponent que ingresa
    var userId = req.query.userId;
    //room ID al que ingresa
    var roomId = req.query.roomId;
    // Nombre del USER
    userRef
        .doc(userId)
        .get()
        .then(function (doc) {
        var userName = doc.data().nombre;
        roomRef
            .doc(roomId)
            .get()
            .then(function (doc) {
            if (doc.exists) {
                var actualData = doc.data();
                /* Ingreso a la sala, solo si:
                    isFull es false, si intenta entrar el OPPONENT o el OWNER
                */
                var currentDate = new Date();
                var currentDayOfMonth = currentDate.getDate();
                var currentMonth = currentDate.getMonth();
                var currentYear = currentDate.getFullYear();
                var dateString = currentDayOfMonth + "-" + (currentMonth + 1) + "-" + currentYear;
                console.log({
                    isFull: actualData.isFull,
                    opponentId: actualData.participants.opponent.id,
                    ownerId: actualData.participants.owner.id,
                    requestUserId: userId,
                    requestedAt: dateString
                });
                // SI LO SOLICITA UN TERCERO
                if (actualData.isFull && userId != actualData.participants.opponent.id && userId != actualData.participants.owner.id) {
                    res.status(409).json({
                        message: "The room is full"
                    });
                }
                else {
                    // SI LO SOLICITA EL OWNER, room ya existente
                    if (userId == actualData.participants.owner.id) {
                        var newRoomRtdb = db_1.rtdb.ref("/rooms/" + actualData.privateKey);
                        res.json(actualData);
                    }
                    // SI LO SOLICITA EL OPPONENT, room ya existente
                    if (userId == actualData.participants.opponent.id) {
                        var newRoomRtdb_2 = db_1.rtdb.ref("/rooms/" + actualData.privateKey);
                        newRoomRtdb_2.once("value", function (snap) {
                            var snapshot = snap.val();
                            newRoomRtdb_2.update({
                                participants: {
                                    owner: {
                                        nombre: snapshot.participants.owner.nombre,
                                        isConnected: snapshot.participants.owner.isConnected,
                                        isReady: snapshot.participants.owner.isReady,
                                    },
                                    opponent: {
                                        nombre: userName,
                                        isConnected: true,
                                        isReady: false,
                                    }
                                },
                                sessionPlays: {
                                    actual: { owner: "", opponent: "" },
                                    thisSession: [0]
                                },
                            });
                        });
                        res.json(actualData);
                    }
                    //SI LO SOLICITA EL OPPONENT, primer ingreso
                    if (actualData.isFull == false && actualData.participants.owner.id != userId) {
                        console.log("Solicita opponent primer ingreso");
                        var newData = {
                            "privateKey": actualData.privateKey,
                            "participants": {
                                "owner": {
                                    nombre: actualData.participants.owner.nombre,
                                    id: actualData.participants.owner.id
                                },
                                "opponent": {
                                    nombre: userName,
                                    id: userId
                                }
                            },
                            "isFull": true,
                            "history": [0]
                        };
                        // Seteo en el RTDB el estado connected del opponent...
                        var newRoomRtdb_3 = db_1.rtdb.ref("/rooms/" + actualData.privateKey);
                        newRoomRtdb_3.once("value", function (snap) {
                            var snapshot = snap.val();
                            newRoomRtdb_3.update({
                                participants: {
                                    owner: {
                                        nombre: snapshot.participants.owner.nombre,
                                        isConnected: snapshot.participants.owner.isConnected,
                                        isReady: snapshot.participants.owner.isReady,
                                    },
                                    opponent: {
                                        nombre: userName,
                                        isConnected: true,
                                        isReady: false,
                                    }
                                },
                                sessionPlays: {
                                    actual: { opponent: "", owner: "" },
                                    thisSession: [0]
                                },
                            });
                        });
                        roomRef
                            .doc(roomId)
                            .update(newData)
                            .then(function () {
                            console.log("db updated");
                        });
                        res.json(newData);
                    }
                }
            }
            else {
                res.status(404).json({
                    message: "Room not found"
                });
            }
        });
    });
});
app.post("/rooms/history", function (req, res) {
    // ID de sala (corto)
    var roomId = req.body.roomId;
    var play = req.body.play;
    roomRef.doc(roomId)
        .get()
        .then(function (doc) {
        if (doc.exists) {
            var actualData = doc.data();
            if (play.owner && play.opponent) {
                actualData.history.push(play);
                roomRef.doc(roomId)
                    .update(actualData)
                    .then(function () {
                    console.log("Added play to history");
                    res.status(200).json({
                        message: "Play successfuly added to the history"
                    });
                });
            }
            else {
                res.status(400).json({
                    message: "The play could not be added, wrong format"
                });
            }
        }
        else {
            res.status(404).json({ message: "Room not found" });
        }
    });
});
app.get("/", function (req, res) {
    db_1.rtdb.ref("test").on("value", function (snapshot) {
        var data = snapshot.val();
        console.log(data);
    });
});
app.get("/db", function (req, res) {
    db_1.db.collection("dbTest").doc("Ftgq154aSEbFBIGa2mJ2").get()
        .then(function (dbResponse) {
        res.send(dbResponse.data());
    });
});
app.listen(3000, function () {
    console.log("App launched in port 3000");
});
