process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
import './config.js';
global.func = await import("./function/system/function.js");
import { createRequire } from "module"; // Bring in the ability to create the 'require' method
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') { return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL): pathURL: pathToFileURL(pathURL).toString() }; global.__dirname = function dirname(pathURL) { return path.dirname(global.__filename(pathURL, true)) }; global.__require = function require(dir = import.meta.url) { return createRequire(dir) }
import * as ws from 'ws';
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, watch } from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import syntaxerror from 'syntax-error';
import { tmpdir } from 'os';
import chalk from 'chalk'
import { format } from 'util';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import pino from 'pino';
import { mongoDB, mongoDBV2 } from './lib/mongoDB.js';
import {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion, 
    makeInMemoryStore, 
    makeCacheableSignalKeyStore, 
    PHONENUMBER_MCC
    } from '@adiwajshing/baileys'
const { CONNECTING } = ws
const { chain } = lodash
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000

protoType()
serialize()

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name]: name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({
    ...query, ...(apikeyqueryname ? {
        [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name]: name]
    }: {})
})): '')
// global.Fn = function functionCallBack(fn, ...args) { return fn.call(global.conn, ...args) }
global.timestamp = {
    start: new Date
}

const __dirname = global.__dirname(import.meta.url)

global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[' + (opts['prefix'] || '‎\/!#.\\').replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

global.db = new Low(
    /https?:\/\//.test(opts['db'] || '') ?
    new cloudDBAdapter(opts['db']): /mongodb(\+srv)?:\/\//i.test(opts['db']) ?
    (opts['mongodbv2'] ? new mongoDBV2(opts['db']): new mongoDB(opts['db'])):
    new JSONFile(`${opts._[0] ? opts._[0] + '_': ''}database.json`)
)

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) return new Promise((resolve) => setInterval(async function () {
        if (!global.db.READ) {
            clearInterval(this)
            resolve(global.db.data == null ? global.loadDatabase(): global.db.data)
        }
    }, 1 * 1000))
    if (global.db.data !== null) return
    global.db.READ = true
    await global.db.read().catch(console.error)
    global.db.READ = null
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        ...(global.db.data || {})
    }
    global.db.chain = chain(global.db.data)
}
loadDatabase()

global.authFile = `${opts._[0] || 'sessions'}`
console.log(`Load AuthFile from ${authFile}`)
const { state, saveCreds } = await useMultiFileAuthState(global.authFile)
const { version, isLatest } = await fetchLatestBaileysVersion()
console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

const connectionOptions = {
    version,
    logger: pino({
        level: 'silent'
    }),
    printQRInTerminal: true,
    browser: ['Chrome (Linux)', '', ''],
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino().child({
            level: 'silent',
            stream: 'store'
        }))
    }
}

global.conn = makeWASocket(connectionOptions)
conn.isInit = false

if (!opts['test']) {
    setInterval(async () => {
        if (global.db.data) await global.db.write().catch(console.error)
    }, 60 * 1000)
}
if (opts['server']) (await import('./server.js')).default(global.conn, PORT)

async function connectionUpdate(update) {
  const { receivedPendingNotifications, connection, lastDisconnect, isOnline, isNewLogin } = update
  if (isNewLogin) conn.isInit = true
  if (connection == 'connecting') console.log(chalk.redBright('Mengaktifkan Bot, Mohon tunggu sebentar...'))
  if (connection == 'open') console.log(chalk.green('Tersambung'))
  if (isOnline == true) console.log(chalk.green('Status Aktif'))
  if (isOnline == false) console.log(chalk.red('Status Mati'))
  if (receivedPendingNotifications) console.log(chalk.yellow('Menunggu Pesan Baru'))
  if (connection == 'close') console.log(chalk.red('koneksi terputus & mencoba menyambung ulang...'))
  global.timestamp.connect = new Date
  if (lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut) {
    console.log(chalk.red('Connecting...'))
    await global.reloadHandler(true)
  } 
  if (global.db.data == null) await global.loadDatabase()
}


process.on('uncaughtException', console.error)
// let strQuot = /(["'])(?:(?=(\\?))\2.)*?\1/

let isInit = true;
let handler = await import('./handler.js')
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) {
        console.error(e)
    }
    if (restatConn) {
        const oldChats = global.conn.chats
        try {
            global.conn.ws.close()
        } catch {}
        conn.ev.removeAllListeners()
        global.conn = makeWASocket(connectionOptions, {
            chats: oldChats
        })
        isInit = true
    }
    if (!isInit) {
        conn.ev.off('messages.upsert', conn.handler)
        conn.ev.off('group-participants.update', conn.participantsUpdate)
        conn.ev.off('groups.update', conn.groupsUpdate)
       // conn.ev.off('message.delete', conn.onDelete)
        conn.ev.off('connection.update', conn.connectionUpdate)
        conn.ev.off('creds.update', conn.credsUpdate)
    }

    let wel = `┏━❖
┃「 hallo kak 👋 」
┗┳❖「 ✦ @user ✦ 」
   ┃✑  𝖜𝖊𝖑𝖈𝖔𝖒𝖊 𝖙𝖔 :
   ┃✑  @subject
   ┃✑  𝖒𝖊𝖒𝖇𝖊𝖗 𝖐𝖊 : 
   ┃✑  ➱ @xmember 
   ┃✑  𝖇𝖊𝖗𝖌𝖆𝖇𝖚𝖓𝖌 𝖕𝖆𝖉𝖆 :
   ┃✑  ${ya}
   ┗━━━━━━━━━━━━━━┈ ⳹
•❅─────✧❅✦❅✧─────❅•
_______𓊈ɪɴᴛʀᴏ ᴅᴜʟᴜ𓊉_______
‿︵‿︵‿︵‿︵‿︵‿︵‿︵‿︵
╔══════════════════╗
║➩  ɴᴀᴍᴀ        :
║➩  ᴜsɪᴀ          :
║➩  ᴋᴇʟᴀs        :
║➩  ᴀsᴀʟ          :
║➩  ʜᴏʙʙʏ       :
║➩  ɢᴇɴᴅᴇʀ     :
║➩  ᴘᴀᴄᴀʀ       :
║➩  sᴛᴀᴛᴜs     :
╚══════════════════
╰─────ᴍᴏʜᴏɴ ᴅɪɪsɪ─────╯
‿︵‿︵‿︵‿︵‿︵‿︵‿︵‿︵
❀•°•════ஓ๑♡๑ஓ════•°•❀`
  conn.welcome = wel
    conn.bye = '✧━━━━━━[ *さよなら* ]━━━━━━✧\nSayonara *@user* 👋( ╹▽╹ )'
    conn.spromote = '@user sekarang admin!'
    conn.sdemote = '@user sekarang bukan admin!'
    conn.sDesc = 'Deskripsi telah diubah ke \n@desc'
    //conn.sSubject = 'Judul grup telah diubah ke \n@subject'
    conn.sIcon = 'Icon grup telah diubah!'
    conn.sRevoke = 'Link group telah diubah ke \n@revoke'
    conn.handler = handler.handler.bind(global.conn)
    conn.participantsUpdate = handler.participantsUpdate.bind(global.conn)
    conn.groupsUpdate = handler.groupsUpdate.bind(global.conn)
    //conn.onDelete = handler.deleteUpdate.bind(global.conn)
    conn.connectionUpdate = connectionUpdate.bind(global.conn)
    conn.credsUpdate = saveCreds.bind(global.conn)

    conn.ev.on('messages.upsert', conn.handler)
    conn.ev.on('group-participants.update', conn.participantsUpdate)
    conn.ev.on('groups.update', conn.groupsUpdate)
    //conn.ev.on('message.delete', conn.onDelete)
    conn.ev.on('connection.update', conn.connectionUpdate)
    conn.ev.on('creds.update', conn.credsUpdate)
    isInit = false
    return true
}

const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = filename => /\.js$/.test(filename)
global.plugins = {}
async function filesInit() {
    for (let filename of readdirSync(pluginFolder).filter(pluginFilter)) {
        try {
            let file = global.__filename(join(pluginFolder, filename))
            const module = await import(file)
            global.plugins[filename] = module.default || module
        } catch (e) {
            conn.logger.error(e)
            delete global.plugins[filename]
        }
    }
}
filesInit().then(_ => console.log(Object.keys(global.plugins))).catch(console.error)

global.reload = async (_ev, filename) => {
    if (pluginFilter(filename)) {
        let dir = global.__filename(join(pluginFolder, filename), true)
        if (filename in global.plugins) {
            if (existsSync(dir)) conn.logger.info(`re - require plugin '${filename}'`)
            else {
                conn.logger.warn(`deleted plugin '${filename}'`)
                return delete global.plugins[filename]
            }
        } else conn.logger.info(`requiring new plugin '${filename}'`)
        let err = syntaxerror(readFileSync(dir), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        })
        if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`)
        else try {
            const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`))
            global.plugins[filename] = module.default || module
        } catch (e) {
            conn.logger.error(`error require plugin '${filename}\n${format(e)}'`)
        } finally {
            global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
        }
    }
}
Object.freeze(global.reload)
watch(pluginFolder, global.reload)
await global.reloadHandler()

// Quick Test
async function _quickTest() {
    let test = await Promise.all([
        spawn('ffmpeg'),
        spawn('ffprobe'),
        spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        spawn('convert'),
        spawn('magick'),
        spawn('gm'),
        spawn('find', ['--version'])
    ].map(p => {
            return Promise.race([
                new Promise(resolve => {
                    p.on('close', code => {
                        resolve(code !== 127)
                    })
                }),
                new Promise(resolve => {
                    p.on('error', _ => resolve(false))
                })
            ])
        }))
    let [ffmpeg,
        ffprobe,
        ffmpegWebp,
        convert,
        magick,
        gm,
        find] = test
    console.log(test)
    let s = global.support = {
        ffmpeg,
        ffprobe,
        ffmpegWebp,
        convert,
        magick,
        gm,
        find
    }
    // require('./lib/sticker').support = s
    Object.freeze(global.support)

    if (!s.ffmpeg) conn.logger.warn('Please install ffmpeg for sending videos (pkg install ffmpeg)')
    if (s.ffmpeg && !s.ffmpegWebp) conn.logger.warn('Stickers may not animated without libwebp on ffmpeg (--enable-ibwebp while compiling ffmpeg)')
    if (!s.convert && !s.magick && !s.gm) conn.logger.warn('Stickers may not work without imagemagick if libwebp on ffmpeg doesnt isntalled (pkg install imagemagick)')
}
 setInterval(async () => {
      await func.closegc();
    }, 25000);
_quickTest()
.then(() => conn.logger.info('☑️ Quick Test Done'))
.catch(console.error)