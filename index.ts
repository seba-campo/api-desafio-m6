import { db, rtdb } from "./db";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import { nanoid, customAlphabet } from "nanoid";
import { stringify } from "querystring";
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
                            isConnected: true,
                            isReady: false,
                        }
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
})


// INGRESAR A ROOM
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

                            // SI LO SOLICITA EL OWNER, room ya existente
                        if(userId == actualData.participants.owner.id){
                            res.json(actualData);
                        }

                        // SI LO SOLICITA EL OPPONENT, room ya existente
                        if(userId == actualData.participants.opponent.id){
                            res.json(actualData);
                        }

                        //SI LO SOLICITA EL OPPONENT, primer ingreso
                        if(actualData.isFull == false && actualData.participants.owner.id != userId){

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
                            };
                            
                            roomRef
                                .doc(roomId)
                                .update(newData)
                                .then(()=>{
                                    console.log("db updated")
                                })

                            res.json(newData)
                        }

                        // SI LO SOLICITA UN TERCERO
                        if(userId != actualData.participants.owner.id && userId != actualData.participants.opponent.id){
                            res.status(409).json({
                                message: "The room is full"
                            })
                        }
                    }
                    else { 
                        res.status(404).json({
                            message: "Room not found"
                        })  
                    }
                })
        });

    // Busco la sala
    

})

app.get("/", (req, res)=>{
    rtdb.ref("test").on("value", (snapshot) => {
        const data = snapshot.val();
        console.log(data)
    })
})

app.get("/db", (req, res)=>{
    db.collection("dbTest").doc("Ftgq154aSEbFBIGa2mJ2").get()
        .then((dbResponse)=>{
            res.send(dbResponse.data())
        })
})

app.listen(3000, ()=>{
    console.log("App launched in port 3000")
})