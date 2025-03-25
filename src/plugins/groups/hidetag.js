export default {
    name: 'hidetag',
    description: 'Reenvía un mensaje citado a todos los participantes del grupo',
    comand: ['todos', 'tagall', 'tg'],
    exec: async (m, { sock }) => {
        const usuarios = m.metadata.participants.map(participant => participant.id);
        const teks = `      » *NOTIFICACIÓN GRUPAL* « \n• -> *Aviso* : ${(m.args.join(' ') || "Revivan Gente.")}\n• -> *Miembros* : ${usuarios.length}\n${usuarios.map(user => `  ⊦ ➛ @${user.split('@')[0]}`).join('\n')}`;
        await sock.sendMessage(m.from, { text: teks, mentions: usuarios });
    },
    isAdmin: true,
    isGroup: true
}
