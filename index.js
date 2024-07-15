require('dotenv').config();
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const port = process.env.PORT || 4000;
const app = express();

// Keep alive

app.get("/", (req, res) =>{
    res.send("running asf");
})
app.listen(port);

function color(message, colorCode) {
    return `\x1b[37m[\x1b[0m\x1b[${colorCode}m${message}\x1b[0m\x1b[37m]\x1b[0m`;
}

function color2(message, colorCode) {
    return `\x1b[37m\x1b[0m\x1b[${colorCode}m${message}\x1b[0m\x1b[37m\x1b[0m`;
}

function generateRandomHex() {
    return crypto.randomBytes(16).toString('hex');
}
const headers = {
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': process.env.TOKEN,
    'Connection': 'keep-alive',
    'Host': 'discord.com'
};

async function fetchCommandIndex() {
    try {
        const response = await axios.get(`https://discord.com/api/v9/guilds/${process.env.SERVER_ID}/application-command-index`, { headers });
        return response.data.application_commands;
    } catch (error) {
        throw new Error(`Error fetching command index: ${error.response ? error.response.data : error.message}`);
    }
}

async function updateStatus(websocket, token, config) {
    const deviceType = process.env.DEVICE_SPOOF === 'pc' ? 'linux' : 'Discord Android';
    websocket.send(JSON.stringify({
        op: 2,
        d: {
            token: token,
            properties: { $os: deviceType, $browser: deviceType, $device: deviceType },
            presence: {
                status: process.env.STATUS || 'online',
                since: 0,
                activities: [],
                afk: false
            }
        }
    }));
}

async function executeCommand(command, options) {
    const data = {
        type: 2,
        application_id: command.application_id,
        guild_id: process.env.SERVER_ID,
        channel_id: process.env.CHANNEL_ID,
        session_id: Math.floor(Math.random() * 9999999999999),
        data: {
            version: command.version,
            id: command.id,
            name: command.name,
            type: command.type,
            options: options,
            application_command: {
                id: command.id,
                type: command.type,
                application_id: command.application_id,
                version: command.version,
                name: command.name,
                description: command.description,
                dm_permission: true,
                integration_types: command.integration_types,
                global_popularity_rank: command.global_popularity_rank,
                options: command.options,
                description_localized: command.description,
                name_localized: command.name
            },
            attachments: []
        },
        nonce: Math.floor(Math.random() * 9999999999999),
        analytics_location: "slash_ui"
    };

    try {
        await axios.post(`https://discord.com/api/v9/interactions`, data, { headers });
        console.log(color('OK', '32'), `Command was run`);
    } catch (error) {
        throw new Error(`Error running command: ${error.response ? error.response.data : error.message}`);
    }
}

function parseCommand(commandString) {
    if (!commandString.match(/^\/(\w+)/)) throw new Error('invalid command string format. /<commandname>');
    const commandName = commandString.match(/^\/(\w+)/)[1];
    const optionMatches = [...commandString.matchAll(/(\w+):(\w+)/g)];
    const options = optionMatches.length > 0 ? optionMatches.map(match => {
        const [name, value] = [match[1], match[2]];
        return { name, value, type: 3 };
    }) : [];
    return { commandName, options };
}

async function runBot() {
    try {
        const userInfo = await axios.get('https://discord.com/api/v9/users/@me', { headers: { 'Authorization': process.env.TOKEN } });
        console.log(color2(`Made by anuj-weebjs`, '35'));
        console.log(color2(`You have been logged in as ${userInfo.data.username} (${userInfo.data.id})`, '37'));

        try {
            const token =  process.env.TOKEN ;
            const websocket = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
            websocket.on('open', () => updateStatus(websocket, token));
            websocket.on('message', async (data) => {
                const message = JSON.parse(data);
                const { op, d } = message;
                if (op === 10) {
                    const { heartbeat_interval } = d;
                    setInterval(() => {
                        websocket.send(JSON.stringify({ op: 1, d: null }));
                    }, heartbeat_interval);
                }
            });
        } catch (error) {
            console.error(color('ERROR', '31'), error);
            process.exit(1);
        }

        const { commandName, options } = parseCommand(process.env.COMMAND);
        const commands = await fetchCommandIndex();
        if (Array.isArray(commands)) {
            const command = commands.find(cmd => cmd.name === commandName && cmd.application_id === process.env.BOT_ID);
            command ? await executeCommand(command, options) : console.log(color('ERROR', '31'), `command "${commandName}" not found.`);
        } else {
            console.log(color('ERROR', '31'), `Commands is not an array: ${commands}`);
        }
    } catch (error) {
        console.log(color('ERROR', '31'), error.message);
    }
}

(async () => {
    if (process.env.LOOP === 'loop') {
        for (;;) {
            await runBot();
            await new Promise(resolve => setTimeout(resolve, process.env.WAIT_TIME));
        }
    } else {
        await runBot();
    }
})();
