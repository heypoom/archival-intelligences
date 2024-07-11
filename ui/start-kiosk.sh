#!/usr/bin/env bash

killall -9 "Google Chrome"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --disable-infobars https://exhibition-ui.poom.dev
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --disable-infobars https://exhibition-ui.poom.dev/video

