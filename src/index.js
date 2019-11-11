const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true }) // Start the bot
const fs = require('fs')
const https = require('https');
const generateVideo = require('./generateVideo')
const i18n = require('./i18n.json')
const botStartDate = Date.now()



// Send help message
bot.onText(/shrimphelp/, (msg, match) => {
  const chatId = msg.chat.id;
  const langCode = msg.from.language_code

  bot.sendMessage(chatId, getText('help', langCode), { parse_mode: 'Markdown' })
});



// Generate audio sent with /shrimp caption
bot.on('message', async (msg, metadata) => {
  const caption = msg.caption
  const date = msg.date

  // Filter for audio with caption '/shrimp <start>' and recent message
  if (!caption || !caption.match(/^shrimp/i) || date * 1000 < botStartDate)
    return

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
  })

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
  })

  const tempAudioFilePath = `assets/temp/audio/${fromId}_${date}.mp3`
  const audioDownloadStream = fs.createWriteStream(tempAudioFilePath) // Create temp file

  // Start audio file download
  console.info('Downloading file...')

  // Download progress
  let totalBytesDownloaded = 0, lastSentBytesDownloadedValue = 0
  const downloadProgressMessageInterval = setInterval(() => {
    if (totalBytesDownloaded === lastSentBytesDownloadedValue) return

    // Send download progress message
    lastSentBytesDownloadedValue = Math.round((totalBytesDownloaded / audioSize) * 100)
    bot.editMessageText(getText('downloading', langCode, lastSentBytesDownloadedValue), {
      chat_id: chatId,
      message_id: progressMsgId,
      parse_mode: 'Markdown'
    })
  }, 1250) // Sent within a interval so editMessageText doesn't get called extremely fast

  await new Promise((resolve, reject) => {
    // Get audio file
    https.get(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${audioPath}`)
      .on('response', response => {
        if (response.statusCode === 200) {
          response.pipe(audioDownloadStream) // Write to temp file
          resolve()
        } else
          reject(response.statusCode + ' ' + response.statusMessage)

        // Update download progress value
        response.on('data', chunk => totalBytesDownloaded += chunk.length)
      })
      .on('error', err => {
        reject(err.message)
      })
  })
    // Download error
    .catch(err => {
      audioDownloadStream.close()
      clearInterval(downloadProgressMessageInterval)
      sendError(chatId, progressMsgId, langCode, `Error downloading audio`)
      console.error('Error downloading audio:', err)
    })

  // File fully downloaded or download error event
  await new Promise((resolve, reject) => {
    audioDownloadStream.on('close', () => {
      // Stop sending download progress messages updates
      clearInterval(downloadProgressMessageInterval)

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
      })

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
      bot.editMessageText(getText('progress', langCode, Math.round(progress.percent)), {
        chat_id: chatId,
        message_id: progressMsgId,
        parse_mode: 'Markdown'
      })
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
      })

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
    }
  )
})



function sendError(chatId, msgId, langCode, errorMessage) {
  if (!msgId) {
    bot.sendMessage(chatId, getText('error', langCode, errorMessage.toString()), { parse_mode: 'Markdown' })
  } else {
    bot.editMessageText(getText('error', langCode, errorMessage.toString()), {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'Markdown'
    })
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
  const p = str.split(':'),
    s = 0, m = 1

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