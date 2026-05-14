const net = require('net');
const crypto = require('crypto');

class MinecraftBuffer {
    /**
     * Кодирует число в VarInt (32-бит)
     * @param {number} value
     * @returns {Uint8Array}
     */
    static encodeVarInt(value) {
        const bytes = [];
        // Приводим к 32-битному знаковому целому (аналог Java int)
        let v = value | 0;

        while (true) {
            if ((v & ~0x7F) === 0) {
                bytes.push(v);
                break;
            }
            bytes.push((v & 0x7F) | 0x80);
            v >>>= 7; // Беззнаковый сдвиг
        }
        return new Uint8Array(bytes);
    }

    /**
     * Декодирует VarInt из буфера
     * @param {Uint8Array} buffer
     * @param {number} offset
     * @returns {{value: number, length: number}}
     */
    static decodeVarInt(buffer, offset = 0) {
        let value = 0;
        let length = 0;
        let currentByte;

        while (true) {
            currentByte = buffer[offset + length];
            value |= (currentByte & 0x7F) << (length * 7);

            length++;
            if (length > 10) throw new Error("VarInt is too big");
            if ((currentByte & 0x80) !== 0x80) break;
        }

        return { value, length };
    }

    /**
     * Кодирует BigInt в VarLong (64-бит)
     * @param {bigint} value
     * @returns {Uint8Array}
     */
    static encodeVarLong(value) {
        const bytes = [];
        let v = BigInt(value);

        while (true) {
            if ((v & ~0x7Fn) === 0n) {
                bytes.push(Number(v));
                break;
            }
            bytes.push(Number((v & 0x7Fn) | 0x80n));
            v >>= 7n;
        }
        return new Uint8Array(bytes);
    }

    /**
     * Декодирует VarLong из буфера
     * @param {Uint8Array} buffer
     * @param {number} offset
     * @returns {{value: bigint, length: number}}
     */
    static decodeVarLong(buffer, offset = 0) {
        let value = 0n;
        let length = 0;
        let currentByte;

        while (true) {
            currentByte = buffer[offset + length];
            value |= BigInt(currentByte & 0x7F) << BigInt(length * 7);

            length++;
            if (length > 10) throw new Error("VarLong is too big");
            if ((currentByte & 0x80) !== 0x80) break;
        }

        return { value, length };
    }
}

function printHex(bytes){
    const hexString = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' '); // Соединяем через пробел для читаемости

    console.log(hexString.toUpperCase());
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bigEndian(value){
    const byte1 = Math.floor(value / 256); // Старший байт
    const byte2 = value % 256;             // Младший байт
    return [byte1,byte2]
}

function getOfflineUUID(username) {
    // 1. Формируем строку как в Java: "OfflinePlayer:" + никнейм
    const data = "OfflinePlayer:" + username;

    // 2. Считаем MD5 хэш (в бинарном виде)
    const hash = crypto.createHash('md5').update(data, 'utf8').digest();

    // 3. Устанавливаем версию (3) и вариант (RFC 4122)
    // Эти манипуляции с байтами обязательны для соответствия стандарту UUID v3
    hash[6] = (hash[6] & 0x0f) | 0x30; // Version 3
    hash[8] = (hash[8] & 0x3f) | 0x80; // Variant is RFC 4122

    return hash
}

function buildHandshake(ip,port){
    const address_name = Buffer.from(ip, 'ascii')
    let buildBuffer = [0x00,...MinecraftBuffer.encodeVarInt(775),address_name.length,...address_name,...bigEndian(port),0x02]
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

let currentStep = 1

const client = net.createConnection({host: "127.0.0.1",port: 25565}, () => {
    console.log(currentStep)
    client.write(buildHandshake("127.0.0.1",25565));
    currentStep = 2
    console.log(currentStep)
    client.write(buildLogin("1488_228"))
});

client.on('data', (data) => {
    //printHex(data)
    if(data[2] === 0x02 && currentStep === 2){
        const bytes = new Uint8Array([0x02,0x00,0x03]);
        client.write(bytes)
        currentStep = 3
        console.log(currentStep)
        client.write(buildClientInformation())
    }
    if(data[2] === 0x01 && currentStep === 3) {
        console.log("arsen")
        const bytes = new Uint8Array([0x03,0x00,0x07,0x00]);
        client.write(bytes)
        currentStep = 4
    }
    if(currentStep === 4){
        let copy_data = data
        while(copy_data.length > 0){
            const len = MinecraftBuffer.decodeVarInt(copy_data)
            //console.log(len.value)
            const info = copy_data.slice(0,len.value)
            copy_data = copy_data.slice(len.value)
            console.log(1)
            printHex(info)
            if(info[0] === 0x03){
                const bytes = new Uint8Array([0x02, 0x00, 0x03]);
                client.write(bytes)
                currentStep = 5
                break
            }
        }
    }
    if(data[2] === 0x2C) {
        console.log("pisos")
        let copy_data = data
        copy_data[2] = 0x1C
        client.write(copy_data)
    }
});