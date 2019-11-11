// Load .env enviroment variables
require('dotenv').config()

// Create paths
require('./src/createTempPaths')

// Start main script
require('./src')