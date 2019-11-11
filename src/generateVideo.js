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
        .outputOption('-shortest') // Output video ends whichever input ends first
        .outputFormat('mp4')
        .on('progress', progress)
        .on('error', error)
        .on('end', end)
        .saveToFile(videoOutputPath)
}