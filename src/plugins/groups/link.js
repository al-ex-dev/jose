export default {
    name: 'link',
    params: [],
    description: 'Envía el enlace de invitación del grupo',
    comand: ['link', 'invitelink'],
    exec: async (m, { sock }) => {
        await sock.sendMessage(m.from, {
            text: `Enlace de invitación del grupo: ${m.metadata.subject}\nEnlace: https://chat.whatsapp.com/${await sock.groupInviteCode(m.from)}`,
            contextInfo: { mentionedJid: m.metadata.participants.map((p) => p.id), remoteJid: m.from }
        });
    },
    isAdmin: true,
    isGroup: true
}
