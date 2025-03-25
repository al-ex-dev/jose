export default {
    name: 'admins',
    description: 'Etiqueta a todos los administradores del grupo',
    comand: ['admins', 'tgadm'],
    exec: async (m) => {
        const teks = `      » *MODERADORES DEL GRUPO* « \n• -> *Total* : ${m.admins.length}\n${m.admins.map(user => `  ⊦ ➛ @${user.split('@')[0]}`).join('\n')}`
        await m.reply(teks, { mentions: m.admins })
    },
    isAdmin: true,
    isGroup: true
}
