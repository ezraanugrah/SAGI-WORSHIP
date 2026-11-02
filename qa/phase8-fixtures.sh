#!/bin/sh
# Optional reproduction helper; uses an already-installed ffmpeg, never installs it.
# Writes only synthetic QA fixtures under test-results.
set -eu
mkdir -p test-results/phase8-fixtures
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 3 -c:v libx264 -pix_fmt yuv420p -c:a aac -y test-results/phase8-fixtures/synthetic-h264-aac.mp4
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 3 -c:v libvpx -c:a libvorbis -y test-results/phase8-fixtures/synthetic-vp8-vorbis.webm
