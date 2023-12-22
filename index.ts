import { db, rtdb } from "./db";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as cors from "cors";
import { nanoid, customAlphabet } from "nanoid";
import { stringify } from "querystring";
import { time } from "console";
import { Timestamp } from "firebase-admin/firestore";
// import * as dotenv from "dotenv"

const app = express();
app.use(bodyParser())
app.use(cors());

const userRef = db.collection("users");
const roomRef = db.collection("rooms");

// REGISTRAR USUARIO, RETORNA ID
app.post("/signup", (req,res)=>{
    const nombre = req.body.nombre;

    userRef
        .where("nombre", "==", nombre)
        .get()
        .then((dbResponse)=>{
            // Si no existe, lo creo
            if(dbResponse.empty){
                userRef.add({
                    nombre
                })
                .then((newUserRef)=>{
                    res.json({id: newUserRef.id});
                    console.log("User registered - id: " + newUserRef.id)
                })
            } else {
                res.status(400).json({
                    message: "user exists"
                })
            }
        })
});

// LOGUEAR USUARIO
app.post("/login", (req,res)=>{
    const nombre = req.body.nombre;
    
    userRef
        .where("nombre", "==", nombre)
        .get()
        .then((dbRes)=>{
            if(!dbRes.empty){
                const docs = dbRes.docs;
                // Itero los docs para responder con el ID del usuario (es unico ya que solo puede haber 1 por nombre)
                for(var i of docs){
                    console.log("User logged in: " + i.id)
                   res.json({id: i.id})
                };
            } else { 
                res.status(404).json({
                    message: "user not found"
                })
            };
        })
});

//CREAR ROOM
app.post("/rooms", (req,res)=>{
    const userId = req.query.userId as any;

    userRef
        .doc(userId)
        .get()
        .then((doc)=>{
            if(doc.exists){
                // Si el use existe, creo una referencia nueva en la RTDB
                const newRoomRtdb = rtdb.ref("/rooms/" + nanoid(12));

                const userName = doc.data().nombre;

                newRoomRtdb.set({
                    owner: userId,
                    participants: {
                        owner: {
                            nombre: userName,
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
                        actual: {owner: "", opponent:""},
                        thisSession: [0]
                    }                 
                })
                .then(()=>{
                    // Una vez creada, tomo su ID largo (privada)
                    const roomLongId = newRoomRtdb.key;
                    // Genero una ID corta (publica)
                    const roomId = nanoid(6).toUpperCase();

                    // Genero un DOC en la DB con el dato de la KEY privada
                    roomRef
                        .doc(roomId.toString())
                        .set({
                            privateKey: roomLongId,
                            participants: {
                                owner: {
                                    nombre: userName,
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
                        .then(()=>{
                            res.json({
                                id: roomId
                            })
                            console.log("Room created - id: " + roomId)
                        });
                });
            } else { 
                console.log(req.body);
                res.status(401).json({
                    message: "User not found"
                })
            }
        })
});


// INGRESAR A ROOM   ---- retorna la room ID para la RTDB
app.get("/rooms", (req, res)=>{
    // User ID del opponent que ingresa
    const userId = req.query.userId as string;
    //room ID al que ingresa
    const roomId = req.query.roomId as string;

    // Nombre del USER
    userRef
        .doc(userId)
        .get()
        .then(doc =>{
            const userName = doc.data().nombre;
            
            roomRef
                .doc(roomId)
                .get()
                .then(doc => {
                    if(doc.exists){
                        const actualData = doc.data();

                        /* Ingreso a la sala, solo si:
                            isFull es false, si intenta entrar el OPPONENT o el OWNER
                        */
                       const currentDate = new Date();
                       const currentDayOfMonth = currentDate.getDate();
                       const currentMonth = currentDate.getMonth();
                       const currentYear = currentDate.getFullYear();

                       const dateString = currentDayOfMonth + "-" + (currentMonth + 1) + "-" + currentYear;

                        console.log({
                            isFull: actualData.isFull,
                            opponentId: actualData.participants.opponent.id,
                            ownerId: actualData.participants.owner.id,
                            requestUserId: userId,
                            requestedAt: dateString
                        })

                        // SI LO SOLICITA UN TERCERO
                        if(actualData.isFull && userId != actualData.participants.opponent.id && userId != actualData.participants.owner.id){
                            res.status(409).json({
                                message: "The room is full"
                            })
                        } else {
                                // SI LO SOLICITA EL OWNER, room ya existente
                            if(userId == actualData.participants.owner.id){
                                const newRoomRtdb = rtdb.ref("/rooms/" + actualData.privateKey);
                                res.json(actualData);
                            }

                            // SI LO SOLICITA EL OPPONENT, room ya existente
                            if(userId == actualData.participants.opponent.id){
                                const newRoomRtdb = rtdb.ref("/rooms/" + actualData.privateKey);

                                newRoomRtdb.once("value", (snap)=>{
                                    const snapshot = snap.val();
                                      newRoomRtdb.update({
                                        participants: {
                                            owner:{
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
                                            actual: {owner: "", opponent: ""},
                                            thisSession: [0]
                                        },
                                    })
                                })
                                res.json(actualData);
                            }

                            //SI LO SOLICITA EL OPPONENT, primer ingreso
                            if(actualData.isFull == false && actualData.participants.owner.id != userId){
                                console.log("Solicita opponent primer ingreso")

                                const newData = {
                                    "privateKey": actualData.privateKey,
                                    "participants": {
                                        "owner":{
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
                                const newRoomRtdb = rtdb.ref("/rooms/" + actualData.privateKey);

                                newRoomRtdb.once("value", (snap)=>{
                                    const snapshot = snap.val();
                                      newRoomRtdb.update({
                                        participants: {
                                            owner:{
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
                                            actual: {opponent: "", owner: ""},
                                            thisSession: [0]
                                        },
                                    })
                                })

                                roomRef
                                    .doc(roomId)
                                    .update(newData)
                                    .then(()=>{
                                        console.log("db updated")
                                    })

                                res.json(newData)
                            }

                        } 
                    }
                    else {
                        res.status(404).json({
                            message: "Room not found"
                        })  
                    }
                })
        });
});


app.post("/rooms/history", (req, res)=>{
    // ID de sala (corto)
    const roomId = req.body.roomId;
    const play = req.body.play

    roomRef.doc(roomId)
    .get()
    .then((doc)=>{
        if(doc.exists){
            const actualData = doc.data();

            if(play.owner && play.opponent){
                actualData.history.push(play)
                roomRef.doc(roomId)
                .update(actualData)
                .then(()=>{
                    console.log("Added play to history")
                    res.status(200).json({
                        message: "Play successfuly added to the history"
                    })
                })
            }
            else{
                res.status(400).json({
                    message: "The play could not be added, wrong format"
                })
            }
        }
        else{
            res.status(404).json({message:"Room not found"})
        }
    });
});

app.get("/", (req, res)=>{
    res.json({
        message: "spinned"
    })
})


app.listen(3000, ()=>{
    console.log("App launched in port 3000")
})