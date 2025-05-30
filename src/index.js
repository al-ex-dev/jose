import "../src/config.js"
import baileys, { DisconnectReason, useMultiFileAuthState, generateWAMessageFromContent, makeCacheableSignalKeyStore, delay, Browsers, fetchLatestBaileysVersion } from "@nazi-team/baileys"
import pino from "pino"
import axios from "axios"
import readline from "readline"
import QRCode from "qrcode"
import { exec } from "child_process"
import { _prototype } from "../lib/_whatsapp.js"
import { _content } from "../lib/_content.js"
import { Lang } from "../lib/_language.js"
import os from "os"

const platform = os.platform()
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = text => new Promise(resolve => rl.question(text, resolve))

const detect = (t) => {
    return [...new Set(
        (t.match(/(?:[a-z+.-]+:\/\/[^\s]+)|(?:\b(?:www\.|ftp\.)[^\s]+\.[a-z]{2,})|(?:\b[^\s/]+\.[a-z]{2,}(?:\/|$))|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?/gi) || [])
            .map(m => m.replace(/[.,;!?]+$/, ''))
            .map(m => /(\/\/)|^(www|ftp)/.test(m) ? m : 'http://' + m)
            .filter(u => {
                try {
                    const url = new URL(u);
                    return ['http:', 'https:', 'ftp:', 'mailto:', 'tel:', 'file:'].includes(url.protocol.toLowerCase())
                } catch {
                    return /^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(\/.*)?$/i.test(u)
                }
            })
    )]
};

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("./auth/session");
    const sock = _prototype({
        logger: pino({ level: "silent" }),
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        browser: Browsers.macOS("Chrome"),
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)
    if (!sock.authState.creds.registered) {
        console.log(`Emparejamiento con este código: ${await sock.requestPairingCode(await question("Ingresa tu número de WhatsApp activo: "), "NAZITEAM")}`)
    }

    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const reconect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log("Error en la conexión", lastDisconnect.error, "Reconectando", reconect);
            reconect ? start() : exec("rm -rf session", err => err ? console.error("Error eliminando sesión:", err) : start())
        } else if (connection === "open") console.log("Conexión establecida")
    })

    sock.ev.on("group-participants.update", async ({ id, author, participants, action }) => {
        const { subject, desc } = await sock.groupMetadata(id);
        const msg = {
            add: () => author ? `Fuiste añadido por @${author.split`@`[0]}` : `Te uniste mediante enlace`,
            remove: p => author === p ? `Salió del grupo` : `Eliminado por @${author.split`@`[0]}`,
            promote: () => `Promovido por @${author.split`@`[0]}`,
            demote: () => `Degradado por @${author.split`@`[0]}`,
            modify: () => `Configuración modificada`
        }[action];

        for (const p of participants) {
            // Ignorar el número del bot, mods y el creador
            if ([sock.user.id, _config.owner.number, ..._config.mods].includes(author)) continue;

            const group = db.data.chats[id]
            const fake = p.split('@')[0]
            
            if (action === 'promote') {
                const admins = await sock.getAdmins(id)
                if (!admins.includes(author)) {
                    await sock.sendMessage(id, { text: 'Detección del sistema: Usted no tiene los suficientes privilegios para realizar esta accion. Por seguridad, se le quitarán los privilegios de administrador.' }, { quoted: m })
                    return await sock.groupParticipantsUpdate(id, [p, author], "demote")
                }
            } else if (action === 'demote') {
                const admins = await sock.getAdmins(id)
                if (!admins.includes(p)) {
                    await sock.sendMessage(id, { text: 'Detección del sistema: Usted no tiene los suficientes privilegios para realizar esta accion. Por seguridad, se le quitarán los privilegios de administrador.' }, { quoted: m })
                    return await sock.groupParticipantsUpdate(id, [author], "demote")
                }
            }

            if (group.antifake && action === 'add') {
                if (group.fake.some(i => fake.startsWith(i))) {
                    await sock.sendMessage(id, { text: 'Tu numero se encuentra en la lista negra, seras eliminado automaticamente.' })
                    await sock.groupParticipantsUpdate(id, [p], 'remove')
                    continue
                }
            }

            if (!action || !db.data.chats[id]?.welcome || author?.endsWith("@lid")) return;

            const text = db.data.chats[id].messages[action]
                .replace(/(@group|@action|@user|@time|@desc)/g, (m) => ({
                    '@group': `@${id}`,
                    '@action': msg?.(p),
                    '@user': `@${p.split`@`[0]}`,
                    '@time': new Date().toLocaleString(),
                    '@desc': desc
                }[m]))

            const image = await sock.profilePictureUrl(p, 'image')
                .catch(() => sock.profilePictureUrl(id, 'image'))
                .catch(() => "./4a.jpg");

            msg && sock.sendMessage(id, {
                image: { url: image },
                caption: text,
                contextInfo: {
                    mentionedJid: [p, author],
                    groupMentions: [{ groupJid: id, groupSubject: subject }]
                }
            })
        }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (let i = 0; i < messages.length; i++) {
            if (type === 'notify' && messages[i].message) {
                let m = await _content(sock, messages[i])
                let v = m.quoted ? m.quoted : m
                let lang = db.data.users[m.sender] ? Lang[db.data.users[m.sender].language] : Lang[db.data.settings[sock.user.jid]?.language]
                let args = { sock, db, v, lang, delay }

                if (!m.isMe && m.message && !m.id.startsWith("NZT") && !m.id.startsWith("BAE5")) {
                    if (db.data.chats[m.from]?.antidelete) {
                        db.data.chats[m.from].cache ||= []
                        db.data.chats[m.from].cache.push({ key: m.key, message: m.message, timestamp: Date.now() })
                        db.data.chats[m.from].cache = db.data.chats[m.from].cache.filter(item => Date.now() - item.timestamp < 1200000)
                    }
                    if (db.data.chats[m.from]?.antitoxic) {
                        let prmpt = `Eres un analizador de lenguaje ofensivo y de contenido obsceno. Tu tarea es analizar el siguiente texto y determinar si contiene lenguaje ofensivo o que insinúe pornografía y/o gore. Responde únicamente con un objeto JSON con la siguiente estructura EXACTA:
{
  "offensive": { "detect": <porcentaje>, "match": <true|false> },
  "obsenity": { "detect": <porcentaje>, "match": <true|false> }
}
Donde "detect" es un número del 0 al 100 que indica el nivel de contenido ofensivo/obsceno y "match" es true si se detecta contenido, false si no.
Analiza el siguiente texto: "${m.body}"
Considera también los siguientes términos: pene, pito, Pitó, cogerte, follar, follarte, panocha, vagina, sexo.
No incluyas ningún otro texto ni explicación. `

                        let { data } = await axios.post("https://chateverywhere.app/api/chat/", {
                            "model": {
                                id: "gpt-4",
                                name: "GPT-4",
                                maxLength: 32000,
                                tokenLimit: 8000,
                                completionTokenLimit: 5000,
                                deploymentName: "gpt-4"
                            },
                            messages: [{ pluginId: null, content: m.text, role: "user" }],
                            prompt: prmpt,
                            temperature: 0.5
                        }, {
                            headers: {
                                "Accept": "application/json",
                                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                            }
                        })

                        const resultado = typeof data === 'string' ? JSON.parse(data) : data

                        if (resultado.obsenity.match) {
                            if (m.isAdmin) {
                                m.reply("> ⚠︎ Admin evita decir mensajes obsceno")
                                
                                return
                            }
                            m.reply("Se ha detectado un mensaje obsceno y serás eliminado automáticamente.")
                            await sock.sendMessage(m.from, { delete: { remoteJid: m.from, fromMe: false, id: m.id, participant: m.sender } })
                            await sock.groupParticipantsUpdate(m.from, [m.sender], "remove")
                            db.data.users[m.sender].warnings = 0
                        } else if (resultado.offensive.match) {
                            if (m.isAdmin) {
                                m.reply("> ⚠︎ Admin evita decir groserias")
                                return
                            }
                            if (db.data.users[m.sender].warnings >= 3) {
                                m.reply("El mensaje acumula 3 advertencias y serás eliminado.")
                                await sock.sendMessage(m.from, { delete: { remoteJid: m.from, fromMe: false, id: m.id, participant: m.sender } })
                                await sock.groupParticipantsUpdate(m.from, [m.sender], "remove")
                                db.data.users[m.sender].warnings = 0
                            } else {
                                m.reply(`Se detecto un mensaje ofensivo: Advertencias: ${db.data.users[m.sender].warnings}\n> Evita acumular 3 advertencias o seras eliminado`)
                                await sock.sendMessage(m.from, { delete: { remoteJid: m.from, fromMe: false, id: m.id, participant: m.sender } })
                                db.data.users[m.sender].warnings += 1
                            }
                        }
                    }
                }

                if (db.data.chats[m.from]?.antilink && m.isGroup && m.isBotAdmin && !m.isAdmin) {
                    const links = detect(m.body)
                    if (links.length > 0) {
                        await sock.groupParticipantsUpdate(m.from, [m.sender], 'remove');
                        await sock.sendMessage(m.from, { delete: { remoteJid: m.from, fromMe: false, id: m.id, participant: m.sender } });
                        await m.reply(`> Enlace detectado y eliminado. @${m.sender.split('@')[0]} fue eliminado del grupo.`)
                        continue
                    }
                }

                for (const plugin of global.plugins) {
                    if (!plugin.disable && plugin.comand ? (Array.isArray(plugin.comand) ? plugin.comand.includes(m.command) : plugin.comand.test(m.body)) : undefined) {

                        if (plugin.isOwner && !m.isOwner) continue
                        if (db.data.settings[sock.user.jid]?.private && !m.isOwner) continue
                        if (db.data.chats[m.from]?.mute && !m.isAdmin && !m.isOwner) continue

                        if (plugin.isAdmin && !m.isAdmin) return m.reply("*Este comando solo está disponible para administradores del grupo.*")
                        if (plugin.isBotAdmin && !m.isBotAdmin) return m.reply("*El bot necesita ser administrador para ejecutar este comando.*")

                        if (plugin.isPrivate && m.isGroup) return m.reply("*Este comando solo puede ser usado en chats privados.*")
                        if (plugin.isGroup && !m.isGroup) return m.reply("*Este comando solo está disponible para grupos.*")

                        if (plugin.os && platform === 'win32') return m.reply(`*Este comando no está disponible debido a la incompatibilidad del sistema operativo en el que se ejecuta ${_config.bot.name}.*`)
                        if (plugin.params && plugin.params.length > 0 && !plugin.params.every(param => m.text && m.text.split(' ')[plugin.params.indexOf(param)])) return m.reply(`*Por favor, proporcione los parámetros requeridos: ${plugin.params.map(p => `[${p}]`).join(' ')}.*`)
                        if (plugin.isQuoted && !m.quoted) return m.reply("*Por favor, responda a un mensaje para usar este comando.*")
                        if (plugin.isMedia && !plugin.isMedia?.includes(v.type.replace('Message', ''))) return m.reply(`*Por favor, adjunte un contenido multimedia de tipo ${plugin.isMedia.length === 1 ? plugin.isMedia[0] : plugin.isMedia.slice(0, -1).join(', ') + ' o ' + plugin.isMedia.slice(-1)} para procesar su solicitud.*`);

                        if (plugin.exec && typeof plugin.exec === 'function') {
                            await plugin.exec.call(plugin, m, args).catch(error => {
                                sock.sendMessage(m.from, { text: `Error al ejecutar el plugin: ${error.message}` })
                                console.error(error)
                            })
                        } else if (!plugin.exec) m.reply(`*El comando ${plugin.name} se encuentra en desarrollo, lo que significa que estamos trabajando activamente en su optimización y ampliación de funcionalidades.*`)
                    }
                }
            }
        }
    })

    sock.ev.on("message.delete", async ({ key: { remoteJid, id, participant } }) => {
        const cache = db.data.chats[remoteJid]?.cache?.find(item => item.key.id === id)
        if (!cache) return

        const participantId = participant.split('@')[0]
        await sock.sendMessage(remoteJid, { text: `Mensaje eliminado por @${participantId}. Recuperando contenido...`, contextInfo: { mentionedJid: [participant] } })

        if (cache.message?.conversation) return await sock.sendMessage(remoteJid, { text: `Contenido eliminado:\n${cache.message.conversation}` })

        const [messageType] = Object.keys(cache.message)
        const messageContent = cache.message[messageType]

        if (typeof messageContent === 'object') {
            const quotedMsg = {
                extendedTextMessage: {
                    text: `Eliminado por @${participantId}`,
                    contextInfo: { mentionedJid: [participant] }
                }
            }

            messageContent.contextInfo = {
                participant: "13135550002@s.whatsapp.net",
                quotedMessage: quotedMsg,
                remoteJid: remoteJid && participant,
                ...messageContent.contextInfo,
                mentionedJid: [participant, ...(messageContent.contextInfo?.mentionedJid || []), "13135550002@s.whatsapp.net"]
            }

            await sock.relayMessage(remoteJid, generateWAMessageFromContent(remoteJid, cache.message, { userJid: sock.user.id }).message, { messageId: cache.key.id })
        }
    })

}

start()
