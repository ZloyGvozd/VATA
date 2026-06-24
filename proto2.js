const net = require('net');
const crypto = require('crypto');

function writeVarInt(value) {
    const bytes = [];
    let v = value | 0;

    while (true) {
        if ((v & ~0x7F) === 0) {
            bytes.push(v);
            break;
        }
        bytes.push((v & 0x7F) | 0x80);
        v >>>= 7;
    }
    return new Uint8Array(bytes);
}
function readVarInt(buf) {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;

    while (bytesRead < buf.length) {
        const byte = buf[bytesRead++];
        value |= (byte & 0x7F) << shift;
        if ((byte & 0x80) === 0) {
            return { value, bytesRead };
        }
        shift += 7;
        if (shift >= 35) throw new Error('VarInt too big');
    }
    return null;
}

function printHex(bytes, bytesPerLine = 16) {
    for (let i = 0; i < bytes.length; i += bytesPerLine) {
        const chunk = bytes.slice(i, i + bytesPerLine);

        // 1. Смещение (Адрес)
        const offset = i.toString(16).padStart(8, '0');

        // 2. Гексадецимальная часть
        const hex = Array.from(chunk)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
            .padEnd(bytesPerLine * 3 - 1, ' ');

        // 3. ASCII часть (читаемый текст)
        const ascii = Array.from(chunk)
            .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
            .join('');

        console.log(`${offset.toUpperCase()} | ${hex.toUpperCase()} | ${ascii}`);
    }
}

function bigEndian(value){
    const byte1 = Math.floor(value / 256); // Старший байт
    const byte2 = value % 256;             // Младший байт
    return [byte1,byte2]
}

function getOfflineUUID(username) {
    const data = "OfflinePlayer:" + username;
    const hash = crypto.createHash('md5').update(data, 'utf8').digest();
    hash[6] = (hash[6] & 0x0f) | 0x30
    hash[8] = (hash[8] & 0x3f) | 0x80;
    return hash
}

function buildHandshake(ip,port){
    const address_name = Buffer.from(ip, 'ascii')
    let buildBuffer = [0x00,...writeVarInt(775),address_name.length,...address_name,...bigEndian(port),0x02]
    buildBuffer = [buildBuffer.length].concat(buildBuffer)
    //printHex(buildBuffer)
    const bytes = new Uint8Array(buildBuffer);
    return bytes
}

function buildLogin(name){
    const byte_name = Buffer.from(name, 'ascii')
    let buildBuffer = [0x00,name.length,...byte_name,...getOfflineUUID(name)]
    buildBuffer = [buildBuffer.length].concat(buildBuffer)
    const bytes = new Uint8Array(buildBuffer);
    return bytes
}
function buildClientInformation(){
    return new Uint8Array([0x10, 0x00, 0x00, 0x05, 0x65, 0x6E, 0x5F, 0x75, 0x73, 0x02, 0x00, 0x01, 0x7F, 0x01, 0x00, 0x01, 0x00])
}

let currentStep = 0
// 1 - handshaking, 2 - Login, 3 - Configuration, 4 - play

let isSpy
let client

function start(Spy, nick, host, port) {
    isSpy = Spy
    client = net.createConnection({host: host, port: port }, () => {
        console.log('Подключено к серверу');
        currentStep = 1
        console.log(currentStep)
        client.write(buildHandshake(host,port));
        currentStep = 2
        console.log(currentStep)
        client.write(buildLogin(nick))
    });

    let buffer = Buffer.alloc(0);
    client.on('data', (data) => {
        buffer = Buffer.concat([buffer, data])

        while (true) {
            const length = readVarInt(buffer)
            if (!length) break

            const packetLength = length.value;
            let headerSize = length.bytesRead;
            const totalExpectedSize = headerSize + packetLength;

            if (buffer.length < totalExpectedSize) {
                break
            }

            headerSize += readVarInt(buffer.subarray(headerSize, totalExpectedSize)).bytesRead

            const packetBody = buffer.subarray(headerSize, totalExpectedSize);
            buffer = buffer.subarray(totalExpectedSize);

            if(isSpy){
                const res = on_packet(packetBody)
                if(res){
                    return res
                }
            }else {
                on_packet(packetBody)
            }
        }
    })
}

async function on_packet(data){
    //printHex(data)
    //Login Success
    if(data[0] === 0x02 && currentStep === 2){
        console.log("Login Success")
        const bytes = new Uint8Array([0x02,0x00,0x03]);
        client.write(bytes)
        client.write(buildClientInformation())

        currentStep = 3
        console.log(currentStep)
    }
    
    //Clientbound Plugin Message
    if(data[0] === 0x01 && currentStep === 3) {
        console.log("Clientbound Plugin Message")
        const bytes = new Uint8Array([0x03,0x00,0x07,0x00]);
        client.write(bytes)
    }

    //Finish Configuration
    if(data[0] === 0x03 && currentStep === 3){
        console.log("Finish Configuration")
        const bytes = new Uint8Array([0x02, 0x00, 0x03]);
        client.write(bytes)

        currentStep = 4
        console.log(currentStep)
    }

    //Keep alive
    if(data[0] === 0x2C && currentStep === 4){
        console.log("Keep alive")
        let copy_data = data
        copy_data[0] = 0x1C
        client.write(new Uint8Array([0x0A,0x00,...copy_data]))
    }

    const isSubarray = (main, sub) => {
        return main.some((_, index) =>
            // Проверяем каждый кусок основного массива длиной с подмассив
            sub.every((element, i) => element === main[index + i])
        );
    };

    let players = []

    if(data[0] === 0x46 && data[1] === 0xFF && currentStep === 4){
        let name
        let name_str
        if(data[19]){
            name = data.subarray(20,20+data[19])
            name_str = name.toString()
            players.push(name_str)
            //console.log(name_str)
        }
    }

    if(players===[]) players = undefined
    return players
}

start(false,"12344","127.0.0.1",25565)

module.exports = start;