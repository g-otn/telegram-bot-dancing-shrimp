const ffmpeg = require('ffmpeg')
const fs = require('fs')
const shrimpVideoPath = 'assets/video/shrimp-15s.mp4'
const audioPath = 'assets/audio.mp3'
const audioStart = 55 // 75 | 55;
const timestamp = Date.now()

try {
    new ffmpeg(process.env.VIDEO_PATH, (err, video) => {
        if (!err) {
            // console.log('Configuration:')
            // console.log(video.info_configuration)

            video.addCommand('-i', audioPath)
            // video.addCommand('-af', 'atrim=start=10')
            // video.addCommand('-ss', '00:00:08')
            // video.addCommand('-c', 'copy')
            // video.addCommand('-map 0:v:0 -map 1:a:0')
            video.addCommand('-shortest')
            video.addCommand('-y')
            video.addCommand('-filter_complex "',
                // `"[0:v]atrim=end=${videoEnd};` +
                `[1:a]atrim=start=${audioStart},asetpts=PTS-STARTPTS[a]` +
                '"')
            video.addCommand('-map "[a]" -map 0:v:0')
            // video.addCommand('-async', '1')
            video.save(`assets/shrimp_dance_${timestamp}.mp4`, (err) => { console.log('Saved', err) })

        } else {
            console.log('Error:', err)
        }
    })
} catch (e) {
    console.log(e)
    console.log(e.code)
    console.log(e.msg)
}