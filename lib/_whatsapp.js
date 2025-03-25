import "../src/config.js"
import baileys, {
	jidDecode,
	generateForwardMessageContent,
	makeWASocket,
	areJidsSameUser,
	jidNormalizedUser,
	downloadContentFromMessage,
	generateWAMessageFromContent
} from "@al-e-dev/baileys"

const { proto } = baileys

import FileType from 'file-type'
import { parsePhoneNumber } from "libphonenumber-js"
import ffmpeg from "fluent-ffmpeg"
import { PassThrough } from "stream"
import axios from "axios"

import Function from "./_functions.js"
import Sticker from "./_sticker.js"

export function _prototype(args, options = {}) {
	const sock = Object.defineProperties(makeWASocket(args), {
		parseMention: {
			value(text) {
				return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + "@s.whatsapp.net");
			},
			enumerable: true
		},
		decodeJid: {
			value(jid) {
				if (!jid) return jid;
				if (/:\d+@/gi.test(jid)) {
					let decode = jidDecode(jid) || {}
					return decode.user && decode.server && decode.user + "@" + decode.server || jid
				} else return jid
			},
			enumerable: true
		},
		getMessageType: {
			value(m) {
				let Type = Object.keys(m);
				if (!["senderKeyDistributionMessage", "messageContextInfo"].includes(Type[0])) { return Type[0]; }
				else if (Type.length >= 3 && Type[1] != "messageContextInfo") { return Type[1]; }
				else Type[Type.length - 1] || Object.keys(m)[0];
			},
			enumerable: true
		},
		getMessageBody: {
			value(type, msg) {
				const body = {
					conversation: () => msg,
					viewOnceMessageV2: () => msg.message.imageMessage?.caption ? msg.message.imageMessage?.caption : msg.message.videoMessage?.caption,
					imageMessage: () => msg?.caption,
					videoMessage: () => msg?.caption,
					extendedTextMessage: () => msg?.text,
					viewOnceMessage: () => msg.message.videoMessage?.caption ? msg.message.videoMessage?.caption : msg.message.imageMessage?.caption,
					documentWithCaptionMessage: () => msg.message.documentMessage?.caption,
					buttonsMessage: () => msg.imageMessage?.caption,
					buttonsResponseMessage: () => msg?.selectedButtonId,
					listResponseMessage: () => msg.singleSelectReply?.selectedRowId,
					templateButtonReplyMessage: () => msg?.selectedId,
					groupInviteMessage: () => msg?.caption,
					pollCreationMessageV3: () => msg,
					interactiveResponseMessage: () => JSON.parse(msg.nativeFlowResponseMessage.paramsJson).id,
					text: () => msg.text
				}
				return body[type] ? body[type]() : ""
			}
		},

		groupInviteCodeV4: {
			async value(from, participant, inviteCode, inviteExpiration, groupName = 'annonymus', caption = 'invitacion a mi grupo de whatsapp', jpegThumbnail, opc = {}) {
				if (!from || !participant || !inviteCode || !inviteExpiration) throw new Error('params @from , @participant , @inviteCode and @inviteExpiration required')
				const sms = proto.Message.fromObject({
					groupInviteMessage: proto.Message.GroupInviteMessage.fromObject({
						groupJid: from,
						groupName,
						caption,
						inviteCode,
						inviteExpiration,
						jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null
					})
				})
				const message = generateWAMessageFromContent(participant, sms, opc)
				await sock.relayMessage(
					participant,
					message.message, { messageId: message.key.id })
				return message
			},
			enumerable: true
		},
		sendSticker: {
			async value(from, opc = {}, quoted) {
				const s = await Sticker.write(opc)
				return await sock.sendMessage(from, {
					sticker: s,
					mimetype: 'image/webp'
				}, quoted)
			},
			enumerable: true
		},
		forward: {
			async value(jid, message, forwardingScore = true, options = {}) {
				let m = generateForwardMessageContent(message, !!forwardingScore)
				let type = Object.keys(m)[0];
				if (forwardingScore && typeof forwardingScore == 'number' && forwardingScore > 1) {
					m[type].contextInfo.forwardingScore += forwardingScore;
				}

				m = generateWAMessageFromContent(jid, m, { ...options, userJid: sock.user.id });
				await sock.relayMessage(jid, m.message, { messageId: m.key.id, additionalAttributes: { ...options } });
				return m;
			}
		},
		getName: {
			value(jid) {
				return new Promise(async (resolve, reject) => {
					if (!jid) return;
					let id = sock.decodeJid(jid);
					let format = parsePhoneNumber(`+${id.replace("@s.whatsapp.net", "")}`);
					let v;
					if (id.endsWith("@g.us")) {
						v = await sock.groupMetadata(id).catch(_ => ({ subject: id }));
						resolve(v.subject || v.id);
					} else {
						v = (id == "0@s.whatsapp.net") ? { id, name: "Whatsapp" } : areJidsSameUser(id, sock.user.id) ? { id, name: sock.user.name } : store.contacts[id] ? store.contacts[id] : { id, name: "NPC" };
						resolve(v.name || v.verifiedName || format.number);
					}
				});
			},
			enumerable: true
		},
		resizeImage: {
			async value(path, ancho = 640, alto = 640) {
				if (!path) throw new Error('params @path required')
				const image = await Jimp.read(path)
				image.resize(ancho, alto)
				return {
					image: await image.getBufferAsync(Jimp.MIME_JPEG)
				}
			}
		},
		downloadMediaMessage: {
			async value(type, media) {
				const stream = await downloadContentFromMessage(type, media);
				let buffer = Buffer.from([]);
				for await (const chunk of stream) {
					buffer = Buffer.concat([buffer, chunk]);
				}
				return buffer
			},
			enumerable: true
		},
		getAdmins: {
			async value(from) {
				try {
					if (!from && !from.endsWith("@g.us")) return;
					let admins = new Array();
					let { participants } = await (await sock.groupFetchAllParticipating)[from] || await store.groupMetadata[from];
					for (let i of participants) {
						if (/admin|superadmin/.test(i.admin)) admins.push(i.id);
					}
					return admins.map(i => i);
				} catch (e) {
					return [];
				}
			},
			enumerable: true
		},
		getMetadata: {
			async get() {
				let chats = await sock.groupFetchAllParticipating().catch(_ => null) || {};

				let chat = Object.keys(chats).map(i => i);

				for (let i in chats) store.groupMetadata[i] = {
					...(store.groupMetadata[i] || {}),
					...(chats[i] || {}),
					code: await sock.groupInviteCode(i).catch(_ => null) || "No es admin el bot"
				};

				Object.keys(store.groupMetadata).forEach((i) => {
					if (!chat.includes(i)) delete store.groupMetadata[i];
				});
			},
			enumerable: true
		},
		sendMedia: {
			async value(from, path, options = {}) {
				let type;
				let buffer;
				let Size;
				if (Buffer.isBuffer(path)) {
					buffer = path;
				} else {
					const response = await fetch(path);
					const data = await response.arrayBuffer();
					buffer = Buffer.from(data);
					Size = data.byteLength;
				}
				const fileType = await FileType.fromBuffer(buffer);
				const size = Function.byteToSize(Size);
				const mime = fileType.mime;
				if (options.document) type = "document";
				else if (options.sticker || mime.split("/")[1] == "webp") type = "sticker"
				else if (/image/.test(mime)) type = "image"
				else if (/video/.test(mime)) type = "video"
				else if (options.type === "audio" && options.convert) {
					type = "audio"
					buffer = await sock.convertToOgg(path)
					mime = 'audio/ogg; codecs=opus'
				} else if (/audio/.test(mime)) type = "video"
				else if (/audio/.test(mime) && options.convert) {
					type = "audio"
					buffer = await sock.convertToOgg(path)
					mime = 'audio/ogg; codecs=opus'
				} else if (size.split(" MB") >= 99.00) type = "document";
				else type = "document"

				return await sock.sendMessage(from, {
					[type]: buffer,
					caption: options.caption ? options.caption : null,
					ptt: (options.ptt && type == "audio") ? options.ptt : null,
					gifPlayback: (type == "video" && options.gif) ? options.gif : null,
					mimetype: options.mime ? options.mime : mime,
				}, {
					quoted: options.quoted ? options.quoted : null
				});
			},
			enumerable: true
		},
		convertToOgg: {
			async value(input) {
				return new Promise(async (resolve, reject) => {
					const bufferStream = new PassThrough();
					const chunks = [];

					bufferStream.on('data', (chunk) => chunks.push(chunk));
					bufferStream.on('end', () => resolve(Buffer.concat(chunks)));
					bufferStream.on('error', (err) => reject(err));

					let stream;
					if (Buffer.isBuffer(input)) {
						stream = new PassThrough();
						stream.end(input);
					} else {
						const response = await axios({
							url: input,
							responseType: 'stream',
						});
						stream = response.data;
					}

					ffmpeg(stream)
						.audioCodec('libopus')
						.outputOptions('-avoid_negative_ts', 'make_zero', '-ac', '1', '-qscale:a', '0')
						.audioBitrate('192k')
						.format('ogg')
						.on('error', (err) => reject(err))
						.pipe(bufferStream);
				});
			}
		},
		convertTimeOut: {
			value(ms) {
				if (ms < 0) {
					throw new Error("Invalid time value. Milliseconds cannot be negative.");
				}

				const units = [
					{ label: "year", ms: 31536000000 },
					{ label: "month", ms: 2628000000 },
					{ label: "week", ms: 604800000 },
					{ label: "day", ms: 86400000 },
					{ label: "hour", ms: 3600000 },
					{ label: "minute", ms: 60000 },
					{ label: "second", ms: 1000 }
				];

				const result = [];

				for (const { label, ms: uni } of units) {
					const count = Math.floor(ms / uni);
					if (count > 0) {
						ms -= count * uni;
						result.push(`${count} ${label}${count !== 1 ? "s" : ""}`);
					}
				}

				return result.length > 0 ? result.join(", ") : "0 milliseconds";
			},
			enumerable: true
		},
	})

	if (sock.user?.id) sock.user.jid = jidNormalizedUser(sock.user.id)

	return sock
}