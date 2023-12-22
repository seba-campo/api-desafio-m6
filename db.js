"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.rtdb = void 0;
var firebase_1 = require("firebase");
var dotenv = require("dotenv");
dotenv.config();
var app = firebase_1.default.initializeApp({
    apiKey: process.env.API_KEY_DESAFIO_M6,
    databaseURL: "https://desafio-m6-13481-default-rtdb.firebaseio.com",
    authDomain: "desafio-m6-13481-default-rtdb.firebaseapp.com",
    projectId: process.env.PROJECT_ID_DESAFIO_M6
});
var rtdb = firebase_1.default.database();
exports.rtdb = rtdb;
var db = firebase_1.default.firestore(app);
exports.db = db;
var testRef = rtdb.ref('/test');
testRef.on('value', function (snapshot) {
    var data = snapshot.val();
    console.log(data);
});
