"""Generate the narration line by line with word timings. Usage: python scripts/voiceover.py"""
import asyncio, json, edge_tts
VOICE = "en-NG-EzinneNeural"
LINES = {
  "s1": "Writing JAMB in 2027? Then you NEED to see this!",
  "s2": "What if I told you, you can now practise thousands of JAMB past questions, completely for FREE?",
  "s3": "Introducing JAMB Prep! A platform designed to help you prepare for JAMB.",
  "s4": "Practise questions across different subjects, challenge yourself, play fun learning games, and climb the leaderboard!",
  "s5": "And the best part? It's completely FREE! Visit JAMB Prep today and start practising. Your JAMB preparation just got easier!",
}
async def one(k, text):
    c = edge_tts.Communicate(text, VOICE, rate="+10%", pitch="+2Hz", boundary="WordBoundary")
    words = []
    with open(f"assets/{k}_t.mp3", "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"t": ch["text"], "s": ch["offset"]/1e7, "d": ch["duration"]/1e7})
    return words
async def main():
    out = {}
    for k, t in LINES.items():
        out[k] = await one(k, t); print(k, round(out[k][-1]["s"]+out[k][-1]["d"],2))
    json.dump(out, open("assets/words.json","w"), indent=1)
asyncio.run(main())

