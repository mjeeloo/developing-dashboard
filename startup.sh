#!/bin/bash
# Startup script for the Developing TV dashboard
sudo apt-get update
sudo apt-get -y upgrade
cd ~/developing-dashboard
sudo npm update
xdg-open https://nederland.fm/radio/joe
xdg-open http://localhost:5173/
