const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true }) // Start the bot
const fs = require('fs')
const https = require('https');
const generateVideo = require('./generateVideo')
const i18n = require('./i18n.json')

const botStartDate = Date.now()

// Limit message updating to prevent hitting request limit
let canUpdateMessage = true
setInterval(() => {
  canUpdateMessage = true
}, 250)



// Send help message
bot.onText(/shrimp/, (msg, match) => {
  // Filter for recent message
  const date = msg.date
  if (date * 1000 < botStartDate)
    return

  const chatId = msg.chat.id;
  const langCode = msg.from.language_code

  bot.sendMessage(chatId, getText('help', langCode), { parse_mode: 'Markdown' })
    .then(msg => {
      const msgId = msg.message_id
      bot.onReplyToMessage(chatId, msgId, (msg) => {
        bot.deleteMessage(chatId, msgId)
        start(msg)
      })
    })
});


// Generate audio sent with /shrimp caption
async function start(msg) {
  const date = msg.date
  const caption = msg.caption

  const chatId = msg.chat.id;
  const langCode = msg.from.language_code
  const fromId = msg.from.id
  const audioFileId = msg.audio.file_id

  console.info('New processing\n\tfrom:', msg.from.first_name, msg.from.id, '\n\tchatId:', chatId, '\n\tmsgId:', msg.message_id, '\n\tdate: ', msg.date, '\n\tcaption:', caption)
  const seconds = getSeconds(caption)

  // TODO: Add file size restriction (25MB or something)


  // Progress message id, will be edited multiple times during the process
  let progressMsgId



  // Sends process start message 
  await bot.sendMessage(chatId, getText('start', langCode), { parse_mode: 'Markdown' })
    .then(msg => { progressMsgId = msg.message_id })

  console.log('\tseconds:', seconds, '\n\tprogressMsgId:', progressMsgId)



  // Send getting info message
  bot.editMessageText(getText('getting_info', langCode), {
    chat_id: chatId,
    message_id: progressMsgId,
    parse_mode: 'Markdown'
  }).catch(err => { console.warn('Error editing message: ' + err) })

  let audioPath, audioSize, audioFormat

  // Get audio file path
  console.info('Getting audio file metadata...')
  await bot.getFile(audioFileId)
    .then(file => {
      audioPath = file.file_path
      audioSize = file.file_size
      audioFormat = file.file_path.split('.').pop()
    })

  console.log('\taudioFileId:', audioFileId, '\n\taudioPath:', audioPath, '\n\taudioSize:', audioSize, '\n\taudioFormat:', audioFormat)



  // Send downloading message
  bot.editMessageText(getText('downloading', langCode, '-'), {
    chat_id: chatId,
    message_id: progressMsgId,
    parse_mode: 'Markdown'
  }).catch(err => { console.warn('Error editing message: ' + err) })

  const tempAudioFilePath = `assets/temp/audio/${fromId}_${date}.mp3`
  const audioDownloadStream = fs.createWriteStream(tempAudioFilePath) // Create temp file

  // Start audio file download
  console.info('Downloading file...')
  await new Promise((resolve, reject) => {
    let totalBytesDownloaded = 0, lastProgressPercentage
    // Get audio file
    https.get(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${audioPath}`)
      .on('response', response => {
        if (response.statusCode === 200) {
          response.pipe(audioDownloadStream) // Write to temp file
          resolve()
        } else
          reject(response.statusCode + ' ' + response.statusMessage)

        // Chunk of downloading file data written on temp file event
        response.on('data', chunk => {
          const progressPercentage = Math.round((totalBytesDownloaded / audioSize) * 100)
            
          // Update download progress value
          totalBytesDownloaded += chunk.length

          // Prevents no message edit difference  telegram error
          if (progressPercentage === lastProgressPercentage) return 

          if (canUpdateMessage) {
            canUpdateMessage = false

            // Send download progress message
            bot.editMessageText(getText('downloading', langCode, progressPercentage), {
              chat_id: chatId,
              message_id: progressMsgId,
              parse_mode: 'Markdown'
            }).catch(err => { console.warn('Error editing message: ' + err) })

            lastProgressPercentage = progressPercentage
          }
        })
      })
      .on('error', err => {
        reject(err.message)
      })
  })
    // Download error
    .catch(err => {
      audioDownloadStream.close()
      sendError(chatId, progressMsgId, langCode, `Error downloading audio`)
      console.error('Error downloading audio:', err)
    })

  // File fully downloaded or download error event
  await new Promise((resolve, reject) => {
    audioDownloadStream.on('close', () => {
      // Stop sending download progress messages updates

      console.log('\tbytesWritten:', audioDownloadStream.bytesWritten)
      if (audioDownloadStream.bytesWritten !== audioSize) {
        reject(`bytesWritten (${audioDownloadStream.bytesWritten}) is different from audioSize (${audioSize})`)
      }
      console.info('Audio downloaded')

      // Send initial progress message
      bot.editMessageText(getText('progress', langCode, '0'), {
        chat_id: chatId,
        message_id: progressMsgId,
        parse_mode: 'Markdown'
      }).catch(err => { console.warn('Error editing message: ' + err) })

      resolve()
    })
  })
    .catch(console.error)



  // Video processing
  console.info('Processing video...')
  const audioStream = fs.createReadStream(tempAudioFilePath)
  const tempVideoFilePath = `assets/temp/video/${fromId}_${date}.mp4`
  generateVideo.generate(audioStream, audioFormat, seconds, tempVideoFilePath,
    progress => {               // Progress
      if (!canUpdateMessage) return

      bot.editMessageText(getText('progress', langCode, Math.round(progress.percent)), {
        chat_id: chatId,
        message_id: progressMsgId,
        parse_mode: 'Markdown'
      }).catch(err => { console.warn('Error editing message: ' + err) })
    },
    (err, stdout, stderr) => {  // Error
      sendError(chatId, progressMsgId, langCode, 'Error processing video')
      console.error('Error processing video:\n', err, '\n\n', stdout, '\n\n', stderr)
    },
    (stdout, stderr) => {       // End
      console.info('Processing done')
      const videoStream = fs.createReadStream(tempVideoFilePath)
      console.info('Sending video...')

      // Send uploading message
      bot.editMessageText(getText('uploading', langCode), {
        chat_id: chatId,
        message_id: progressMsgId,
        parse_mode: 'Markdown'
      }).catch(err => { console.warn('Error editing message: ' + err) })

      bot.sendVideo(chatId, videoStream)
        .then(() => {
          console.info('Video sent')
          // Delete progress message
          bot.deleteMessage(chatId, progressMsgId)

          // Stop using video file
          videoStream.close()

          // Delete temp audio and video
          fs.unlinkSync(tempAudioFilePath)
          fs.unlinkSync(tempVideoFilePath)
        })
        .catch(reason => {
          // Error uploading video
          console.error('Error uploading video:', reason)
          sendError(chatId, progressMsgId, langCode, 'Error uploading video')
        })
    }
  )
}



function sendError(chatId, msgId, langCode, errorMessage) {
  if (!msgId) {
    bot.sendMessage(chatId, getText('error', langCode, errorMessage.toString()), { parse_mode: 'Markdown' })
  } else {
    bot.editMessageText(getText('error', langCode, errorMessage.toString()), {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'Markdown'
    }).catch(err => { console.warn('Error editing message: ' + err) })
  }
}



// Returns message from i18n.json on given language code, if not available, default is returned
function getText(key, language_code, replaceText) {
  if (!i18n[key]) return null

  return (i18n[key][language_code] || i18n[key]['default']).replace(/\$/, replaceText)
}



// Parses seconds in caption
function getSeconds(caption) {
  if (!caption) // Error, caption should not be null if function was called
    return 0

  // Matches S, SS, SSS, MM:SS and HH:MM:SS formats or 0
  const start = (caption.match(/(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]{0,3}\d)/) || [0])[0]

  // No start specified
  if (!start)
    return 0

  // S, SS and SSS format
  if (Number(start))
    return start

  // MM:SS and HH:MM:SS format
  const p = start.split(':')
  let s = 0, m = 1

  while (p.length > 0) {
    s += m * parseInt(p.pop(), 10)
    m *= 60;
  }

  return s
}

// Startup log
bot.getMe().then(user => {
  console.log(user.username + ' started.')
})