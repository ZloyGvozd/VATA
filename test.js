const { Worker } = require('worker_threads');

let players = []

const worker = new Worker('./proto.js');
worker.postMessage({cmd: "login",dist: {ip: "127.0.0.1"},nick:"arbuz"})
worker.postMessage({cmd: "spy"})

worker.on('message', (msg) => {
    if(msg.resp === "players"){
        players = msg.data
    }
})

setTimeout(() => {
    players.forEach((e) => {
        if(e === "arbuz") return
        worker.postMessage({cmd: "login",dist: {ip: "127.0.0.1"},nick:e})
    })
},1000)