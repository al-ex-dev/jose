export default {
    name: 'demote',
    description: 'Degradar miembro de administrador',
    comand: ['demote'],
    exec: async (m, { sock }) => {
        const users = m.quoted ? [m.quoted.sender] : (m.mentionedJid.length ? m.mentionedJid : [m.args.join(" ").replace(/[^0-9]/g, '') + '@s.whatsapp.net'])
        if (!users.length) return await sock.sendMessage(m.from, { text: 'Selecciona un usuario para degradar.' }, { quoted: m })

        const admins = m.admins;
        const validUsers = users.filter(user => admins.includes(user))

        if (!validUsers.length) return await sock.sendMessage(m.from, { text: 'Ninguno de los usuarios seleccionados es administrador.' }, { quoted: m })

        await sock.groupParticipantsUpdate(m.from, validUsers, "demote")
        await sock.sendMessage(m.from, {
            text: `Usuarios degradados con éxito.`,
            mentions: [...admins, ...validUsers]
        }, { quoted: m })
    },
    isAdmin: true,
    isBotAdmin: true,
    isGroup: true
}
