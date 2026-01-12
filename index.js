import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from '@itsukichan/baileys';

import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.reconnectDelay = 15000;
    }

    async start() {
        const { state, saveCreds } = await useMultiFileAuthState(
            join(__dirname, 'session')
        );

        this.sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false
        });

        this.sock.ev.on('creds.update', saveCreds);
        this.registerEvents();
    }

    registerEvents() {
        const sock = this.sock;

        // ─── QR ─────────────────────────────────────────────
        sock.ev.on('qr', qr => {
            console.clear();
            console.log('📱 ESCANEA EL QR\n');
            qrcode.generate(qr, { small: true });
        });

        // ─── CONEXIÓN ───────────────────────────────────────
        sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
            if (connection === 'open') {
                console.clear();
                console.log('✅ BOT CONECTADO');
                console.log(`👤 Usuario: ${sock.user?.name}`);
                console.log(`📞 Número: ${sock.user?.id.split(':')[0]}`);
                console.log(`🕐 ${new Date().toLocaleString('es-ES')}`);
            }

            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                if (code === DisconnectReason.loggedOut) {
                    console.log('❌ Sesión cerrada');
                    process.exit(0);
                } else {
                    console.log('⚠️ Desconectado, reconectando...');
                    setTimeout(() => this.start(), this.reconnectDelay);
                }
            }
        });

        // ─── MENSAJES ───────────────────────────────────────
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg?.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];

            console.log(`\n📩 Mensaje (${type})`);

            // ────────────────────────────────────────────────
            // ✅ DETECCIÓN UNIVERSAL DE BOTONES (CLAVE)
            // ────────────────────────────────────────────────
            const buttonResponse =
                msg.message?.buttonsResponseMessage ||
                msg.message?.messageContextInfo?.message?.buttonsResponseMessage;

            if (buttonResponse) {
                const id = buttonResponse.selectedButtonId;
                const text = buttonResponse.selectedDisplayText;

                console.log('👉 BOTÓN PRESIONADO');
                console.log('ID:', id);
                console.log('TEXTO:', text);

                if (id === 'si_prueba') {
                    await sock.sendMessage(jid, {
                        text: '¡Perfecto! Dijiste SÍ 😄'
                    });
                } else if (id === 'no_prueba') {
                    await sock.sendMessage(jid, {
                        text: 'Entendido, dijiste NO 😌'
                    });
                } else {
                    await sock.sendMessage(jid, {
                        text: 'Respuesta recibida 👍'
                    });
                }

                return;
            }

            // ─── TEXTO NORMAL ───────────────────────────────
            if (type === 'conversation' || type === 'extendedTextMessage') {
                const text =
                    type === 'conversation'
                        ? msg.message.conversation
                        : msg.message.extendedTextMessage.text;

                const lower = text.toLowerCase();
                console.log(`💬 Texto: ${lower}`);

                if (
                    lower.includes('hola') ||
                    lower.includes('bot') ||
                    lower.includes('prueba')
                ) {
                    await sock.sendMessage(
                        jid,
                        {
                            text: '¿Te parece bien esta prueba de botones?',
                            footer: 'Elegí una opción ↓',
                            buttons: [
                                {
                                    buttonId: 'si_prueba',
                                    buttonText: { displayText: 'Sí ✅' },
                                    type: 1
                                },
                                {
                                    buttonId: 'no_prueba',
                                    buttonText: { displayText: 'No ❌' },
                                    type: 1
                                }
                            ],
                            headerType: 1
                        },
                        { quoted: msg }
                    );

                    console.log('✅ Botones enviados');
                } else {
                    await sock.sendMessage(jid, {
                        text: 'Escribí *hola* o *prueba* para mostrar los botones 😊'
                    });
                }
            }
        });
    }
}

// ─── START ───────────────────────────────────────────────
console.clear();
console.log('🚀 Iniciando WhatsApp Bot...\n');

const bot = new WhatsAppBot();
bot.start();
