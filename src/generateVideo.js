const ffmpeg = require('fluent-ffmpeg')

exports.generate = (audioStream, audioFormat, audioStart, videoOutputPath, progress, error, end) => {
    ffmpeg()
        .input(process.env.VIDEO_PATH)
        .input(audioStream)
        .inputFormat(audioFormat)
        .seekInput(audioStart)
        // .complexFilter(
        //     `[1:a]atrim=start=${audioStart},asetpts=PTS-STARTPTS[skippedaudio]`,
        //     'skippedaudio'
        // )
        .outputOptions([
            '-shortest', // Output video ends whichever input ends first
            '-strict -2', // Need to enable for Glitch's ffmpeg
            '-preset veryfast' // Glitch's ffmpeg is SUPER slow, so this should help a little
        ])
        .outputFormat('mp4')
        .on('progress', progress)
        .on('error', error)
        .on('end', end)
        .saveToFile(videoOutputPath)
}