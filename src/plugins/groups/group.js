export default {
    name: 'group',
    params: ['cerrar/abrir'],
    description: 'Gestionar configuraciones del grupo',
    comand: ['group', 'gp', 'grupo'],
    exec: async (m, { sock }) => {
        const action = m.args[0]
        const metadata = await sock.groupMetadata(m.from)

        if (["cerrar", "close", "off"].includes(action)) {
            if (metadata.announce) return sock.sendMessage(m.from, { text: 'El grupo ya está cerrado.' }, { quoted: m })
            await sock.groupSettingUpdate(m.from, "announcement")
            await sock.sendMessage(m.from, { text: 'Grupo cerrado con éxito.' }, { quoted: m })
        } else if (["abrir", "open", "on"].includes(action)) {
            if (!metadata.announce) return sock.sendMessage(m.from, { text: 'El grupo ya está abierto.' }, { quoted: m })
            await sock.groupSettingUpdate(m.from, "not_announcement")
            await sock.sendMessage(m.from, { text: 'Grupo abierto con éxito.' }, { quoted: m })
        }
    },
    isAdmin: true,
    isBotAdmin: true,
    isGroup: true
}
