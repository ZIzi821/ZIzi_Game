#!/bin/bash
set -e
cd "$(dirname "$0")"
python3 -m pip install -r requirements.txt pyinstaller
python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --windowed \
  --name "Chomp_For_Friends" \
  --add-data "image:image" \
  --add-data "assets:assets" \
  --add-data "PLAYER_MUSIC.wav:." \
  --add-data "MapleLeaf_Music.MP3:." \
  --add-data "MUSIC.wav:." \
  main.py
