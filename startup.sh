#!/bin/bash
# Startup script for the Developing TV dashboard
sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get install npm
cd ~/developing-dashboard
git pull
sudo npm update
xdg-open https://nederland.fm/radio/joe
xdg-open http://localhost:5173/
