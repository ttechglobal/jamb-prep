# JAMB Prep • 2027 launch film

Run these commands from the extracted project folder. The included narration, original score, sound effects, app fonts and logo make the render independent of the live app.

## Render and preview

Install Python with Pillow, fontTools, Brotli and NumPy. Put FFmpeg on PATH.

    python -m pip install Pillow fontTools Brotli numpy
    python render.py --preview
    python render.py

Open output/Storyboard.jpg to review representative frames before encoding. Open output/JAMBPrep-2027-Launch.mp4 to review the full motion and sound. output/Narration.wav contains the isolated, timeline-aligned voice track.

## Editing the film

Each scene is a function in render.py. CUTS sets the transition times in seconds. VOICE sets the five narration offsets. END sets the length. The logo, wordmark, answer option, subject icon, tap ripple, progress indicator, card and easing functions can be reused for other videos.

| Time | Picture |
| --- | --- |
| 0–4.45 | Staggered JAMB 2027 type and the hook |
| 4.45–10.10 | Biology question, answer selection, free-practice reveal |
| 10.10–15.10 | Official icon and wordmark resolve into the landing-page hero |
| 15.10–23.20 | English answer and XP, subject selection, Concord word drag, weekly leaderboard |
| 23.20–33.00 | Free-access reveal, official mark and caption-directed CTA |

To replace narration, put your takes in assets/s1_t.mp3 through assets/s5_t.mp3 and adjust VOICE and CUTS. The supplied tracks are the existing Nigerian English Ezinne neural read. For new synthetic takes, edit LINES in voiceover.py, install edge-tts, then run python voiceover.py with internet access. Check each take's length against the next start time before rendering.

The instrumental and effects were synthesized for the project. Run python sfx.py to rebuild them. Mix gains and cue points are in soundtrack().

## Product references

The 2021 Biology item comes from the project's converted question bank, reference 000d5550-bfdb-405f-9cd0-edcd4d2e8bd0. The CANDID question and +2 XP interaction are from the landing-page hero. The Concord round uses the first sentence of the is-are level. Leaderboard names and totals are illustrative preview data. Brand colours, fonts, cap icon and subject icons follow the app. The Lucide icon licence is included with the assets.

The end card directs viewers to the caption. Add the public website address when posting.
