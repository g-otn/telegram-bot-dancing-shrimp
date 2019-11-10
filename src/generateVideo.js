const ffmpeg = require('fluent-ffmpeg')

exports.generate = (audioStream, audioStart, progress, error, end) => {
    return ffmpeg()
        .input(process.env.VIDEO_PATH)
        .input(audioStream)
        .format('mp3')
        .seekInput(audioStart)
        // .complexFilter(
        //     `[1:a]atrim=start=${audioStart},asetpts=PTS-STARTPTS[skippedaudio]`,
        //     'skippedaudio'
        // )
        .outputOption('-shortest') // Output video ends whichever input ends first
        .on('progress', progress)
        .on('error', error)
        .on('end', end)
}