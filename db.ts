import firebase from "firebase"
import * as dotenv from "dotenv"

dotenv.config();

const app = firebase.initializeApp({
    apiKey: process.env.API_KEY_DESAFIO_M6,
    databaseURL: "https://desafio-m6-13481-default-rtdb.firebaseio.com",
    authDomain: "desafio-m6-13481-default-rtdb.firebaseapp.com",
    projectId: process.env.PROJECT_ID_DESAFIO_M6
})

const rtdb = firebase.database();
const db = firebase.firestore(app)

const testRef = rtdb.ref('/test')

testRef.on('value', (snapshot) => {
    const data = snapshot.val();
    console.log(data)
}); 



export { rtdb, db }