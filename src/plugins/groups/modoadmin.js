export default {
    name: 'modoadmin',
    params: ['on/off'],
    description: 'Habilita o deshabilita el modo administrador en el grupo',
    comand: ['modoadmin'],
    exec: async (m, { sock, db }) => {
        if (m.args[0] === 'on') {
            if (db.data.chats[m.from].mute) return m.reply('➤ Comando: modoadmin ⧉ Estado: ya está habilitado.')
            db.data.chats[m.from].mute = true
            await m.reply('➤ Comando: modoadmin ⧉ Estado: habilitado.' )
        } else if (m.args[0] === 'off') {
            if (!db.data.chats[m.from].mute) return m.reply('➤ Comando: modoadmin ⧉ Estado: ya está deshabilitado.')
            db.data.chats[m.from].mute = false
            await m.reply('➤ Comando: modoadmin ⧉ Estado: deshabilitado.')
        } else {
            const status = db.data.chats[m.from].mute ? 'habilitado' : 'deshabilitado'
            await m.reply(`➤ Comando: modoadmin ⧉ Estado: ${status}`)
        }
    },
    isAdmin: true,
    isGroup: true
}
