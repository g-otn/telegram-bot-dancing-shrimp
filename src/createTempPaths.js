const fs = require('fs')
const rmdir = require('rimraf');

// Remove temp directory to clean not somehow deleted files
rmdir.sync('assets/temp')

// Create temp folders
const tempPaths = ['assets/temp/audio', 'assets/temp/video']
tempPaths.forEach(path => {
    // Folders need to exists so fs function calls inside script do not fail
    fs.mkdirSync(path, { recursive: true })
})
