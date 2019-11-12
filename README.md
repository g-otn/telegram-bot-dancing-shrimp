# telegram-bot-dancing-shrimp
This telegram bot uses FFmpeg to generate "Dancing Shrimp with Beer" videos, with a given audio on top of it.

## Usage
Chat with a live version of the bot https://t.me/dancingshrimpbot.

## Installation
**Requirements**: A [Telegram Bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot) and its API Token, Node.js and npm.

1. Clone the project:
```bash
git clone https://github.com/g-otn/telegram-bot-dancing-shrimp.git
cd telegram-bot-dancing-shrimp/
```
2. Install dependencies:
```bash
npm i
```
3. Download and/or install [FFmpeg](https://www.ffmpeg.org/download.html).
4. Create a file named `.env` in the project root:
```bash
touch .env # Linux
cd > .env  # Windows
```
5. Type in the `.env` file the required environment variables:
```ini
# Your Telegram Bot API Token
BOT_TOKEN=12345678:AABBCCDDEEFFGGHHIIJJKKLLMMNNOOPPQQ

# Path to the ffmpeg executable, not needed if you can access it from the command line
FFMPEG_PATH=ffmpeg/ffmpeg.exe

# The path for the "Dancing Shrimp with Beer" video
VIDEO_PATH=assets/video/shrimp-15s.mp4
```
6. Start the bot, you should see a "<Bot name> has started." message in a few seconds
```
node .
```

## Acknoledgements
Inspired by 
[@shrimpdancing2](https://twitter.com/shrimpdancing2)'s 
[tweet](https://twitter.com/shrimpdancing2/status/1190010801140256768).
