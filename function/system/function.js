import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';
import ytdl from 'ytdl-core';
import fetch from 'node-fetch';

/*close gc */
export async function closegc() {
    const moment = (await import('moment-timezone')).default;
    let data = fs.readFileSync("./function/database/grup.json");
    let json = JSON.parse(data);
    const time = moment.tz('Asia/Jakarta').format('HH:mm');

    for (let schedule of json) {
        try {
            let anon = (await conn.groupMetadata(schedule)).announce;

            if (time === '22:00' && !anon) {
                await conn.groupSettingUpdate(schedule, 'announcement');
                await conn.delay(1000);
                await conn.reply(schedule, `\`\`\`
Halo semua, mohon perhatian. Grup WhatsApp akan ditutup sementara karena sudah larut malam. Terima kasih atas pengertiannya. Selamat beristirahat dan sampai jumpa besok pagi!
\`\`\``, null); 
            
            } else if (time === '07:00' && anon) {
                await conn.groupSettingUpdate(schedule, 'not_announcement');
                await conn.delay(1000);
                await conn.reply(schedule, `\`\`\`
Selamat pagi! Grup WhatsApp kita telah dibuka kembali. Semoga hari ini penuh dengan semangat dan kebahagiaan. Mari kita berbagi kebaikan dan semangat positif. Selamat beraktivitas!
\`\`\``, null);
            
            } else if (time === '18:00' && !anon) {
                await conn.groupSettingUpdate(schedule, 'announcement');
                await conn.delay(1000);
                await conn.reply(schedule, `\`\`\`
Halo semua! Grup WhatsApp akan ditutup sementara karena sudah memasuki waktu Maghrib. Nikmati waktu bersama keluarga dan aktivitas lainnya. Kami akan membuka kembali grup setelah Maghrib. Terima kasih atas pengertiannya.
\`\`\``, null); 
            
            } else if (time === '18:10' && anon) {
                await conn.groupSettingUpdate(schedule, 'not_announcement');
                await conn.delay(1000);
                await conn.reply(schedule, `\`\`\`
Selamat malam! Grup WhatsApp telah dibuka kembali setelah Maghrib. Mari kita berbagi cerita dan kebahagiaan bersama. Semoga malam ini menyenangkan untuk kita semua.
\`\`\``, null); 
            }
        } catch (e) {
            // Log error tetapi tidak menghapus data dari grup.json
            console.log(`Error: Bot tidak terdaftar dalam grup ${schedule}. Error: ${e}`);
        }
    }
}

// Fungsi-fungsi lainnya yang mungkin diperlukan oleh script utama
export async function delay(ms) {
    return new Promise(res => setTimeout(res, ms))
}

export async function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}
