import YouTube from "../../scraper/youtube.js"
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { ytmp4, ytmp3 } = require('@hiudyy/ytdl')

export default {
    name: 'youtube',
    params: ['message'],
    description: 'Busca y descarga videos y audios de YouTube',
    comand: ['youtube', 'yt', 'play'],
    os: true,
    exec: async (m, { sock }) => {
        const videos = await YouTube.search(m.text);
        const video = videos[0]

        sock.sendMessage(m.from, {
            caption: `*⤷𝙳̷ 𝙾̷ 𝚆̷ 𝙽̷ 𝙻̷ 𝙾̷ 𝙰̷ 𝙳̷-𝙼̷ 𝚄̷ 𝚂̷ 𝙸̷ 𝙲̷⤶*\n\n*🔹Título:* ${video.title}\n*🔹Duración:* ${video.duration}\n*🔹Canal:* ${video.author}\n*🔹Vistas:* ${video.viewers}\n*🔹Subido:* ${video.published}\n\n𝒯𝒾𝑒𝓂𝓅𝑜 𝓁𝒾𝓂𝒾𝓉𝑒 𝓅𝒶𝓇𝒶 𝓇𝑒𝓈𝓅𝑜𝓃𝒹𝑒𝓇 𝟻 𝓂𝒾𝓃𝓊𝓉𝑜𝓈\n\n𝗦𝗼𝗹𝗼 𝗘𝗹 𝗥𝗲𝗺𝗶𝘁𝗲𝗻𝘁𝗲 𝗣𝘂𝗲𝗱𝗲 𝗥𝗲𝘀𝗽𝗼𝗻𝗱𝗲𝗿`,
            footer: _config.bot.name,
            image: { url: video.thumbnail },
            buttons: [
                { buttonId: 'audio', buttonText: { displayText: 'Audio' } },
                { buttonId: 'video', buttonText: { displayText: 'Video' } }
            ],
            headerType: 6,
            viewOnce: true
        });

        const filter = response => response.key.remoteJid === m.from && response.key.participant === m.sender;
        const timeout = setTimeout(() => {
            sock.ev.off('messages.upsert', responseHandler);
        }, 5 * 60 * 1000);

        const responseHandler = async response => {
            if (response.messages[0].message && response.messages[0].message.buttonsResponseMessage && filter(response.messages[0])) {
                clearTimeout(timeout);
                sock.ev.off('messages.upsert', responseHandler);

                const type = response.messages[0].message.buttonsResponseMessage.selectedButtonId === 'audio' ? 'audio' : 'video';

                if (type === 'audio') {
                    const audioBuffer = await ytmp3(video.url);
                    const oggBuffer = await sock.convertToOgg(audioBuffer);
                    await sock.sendMessage(m.from, { audio: oggBuffer, fileName: `${video.title}.ogg` });
                } else if (type === 'video') {
                    await sock.sendMedia(m.from, await ytmp4(video.url), { caption: video.title });
                }
            }
        }

        sock.ev.on('messages.upsert', responseHandler)
    }
}
