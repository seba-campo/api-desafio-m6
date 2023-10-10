import { db, rtdb } from "./db";
import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
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
                    res.json({ id: newUserRef.id });
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
                const newRoomRtdb = rtdb.ref("/rooms" + nanoid.customAlphabet("ABCDEFGHIJKLMNOPQRSUVWXYX0123456789", 12));

                newRoomRtdb.set({
                    owner: userId
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