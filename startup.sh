#!/bin/bash
# Startup script for the Developing TV dashboard
sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get -y install nodejs npm
cd ~/developing-dashboard
git pull
sudo npm update
open https://nederland.fm/radio/joe &
npm run dev
open http://localhost:5173/ &
