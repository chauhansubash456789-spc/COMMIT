import os
import sys
import subprocess
from PIL import Image, ImageSequence, ImageDraw, ImageFont

def generate_3min_demo_mp4():
    webp_path = r"d:\Hackthon\commit_protocol_demo.webp"
    output_mp4 = r"d:\Hackthon\commit_protocol_demo.mp4"
    public_mp4 = r"d:\Hackthon\public\commit_protocol_demo.mp4"
    ffmpeg_exe = r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe"

    if not os.path.exists(webp_path):
        print(f"Error: {webp_path} does not exist", flush=True)
        return

    print("Opening WebP recording...", flush=True)
    im = Image.open(webp_path)
    n_input_frames = getattr(im, "n_frames", 1)
    print(f"Found {n_input_frames} raw recording frames.", flush=True)

    out_w, out_h = 1280, 720
    target_fps = 15
    target_duration_sec = 180  # Exactly 3 minutes
    total_output_frames = target_fps * target_duration_sec  # 2700 frames

    # Extract every 3rd frame to get ~200 high-resolution key checkpoints
    print("Extracting and scaling keyframes from WebP...", flush=True)
    sampled_frames = []
    idx = 0
    for frame in ImageSequence.Iterator(im):
        if idx % 3 == 0:
            rgb = frame.convert("RGB")
            # Resize preserving aspect ratio into 1280x720
            w, h = rgb.size
            scale = min((out_w - 40) / w, (out_h - 100) / h)
            new_w, new_h = int(w * scale), int(h * scale)
            resized = rgb.resize((new_w, new_h), Image.Resampling.BILINEAR)

            base = Image.new("RGB", (out_w, out_h), (13, 15, 18))
            x_off = (out_w - new_w) // 2
            y_off = 48 + (out_h - 96 - new_h) // 2
            base.paste(resized, (x_off, y_off))
            sampled_frames.append(base)
        idx += 1

    n_sampled = len(sampled_frames)
    print(f"Sampled {n_sampled} distinct video moments.", flush=True)

    # Chapters timeline for the 3-minute presentation
    chapters = [
        (0, 25, "1/8: Web3 Landing Page & Protocol Architecture ($254k TVL)"),
        (25, 55, "2/8: Pure Sign-in-with-Solana (SIWS) & Dual Staking Vaults"),
        (55, 85, "3/8: Personal Ledger & Live Solana Devnet Escrow Feed"),
        (85, 115, "4/8: 7-Step Commitment Creation Wizard & Penalty Rules"),
        (115, 140, "5/8: Automated GitHub Verifier Engine (Commit SHA Attestation)"),
        (140, 160, "6/8: Deep Work Focus Studio (Rotating Cryptographic Nonces)"),
        (160, 172, "7/8: Peer Consensus (Dynamic Blockhash) & Solana Blinks"),
        (172, 180, "8/8: 1-Click Hackathon Demos & Sub-Second Settlement"),
    ]

    def get_chapter(sec):
        for start, end, title in chapters:
            if start <= sec < end:
                return title
        return chapters[-1][2]

    # Try font loading
    try:
        font_large = ImageFont.truetype("arial.ttf", 32)
        font_med = ImageFont.truetype("arial.ttf", 18)
        font_mono = ImageFont.truetype("consola.ttf", 16)
    except:
        font_large = font_med = font_mono = ImageFont.load_default()

    # Intro Title Card
    intro_img = Image.new("RGB", (out_w, out_h), (13, 15, 18))
    draw_intro = ImageDraw.Draw(intro_img)
    draw_intro.text((out_w//2, 260), "⚡ COMMIT PROTOCOL", font=font_large, fill=(255, 107, 85), anchor="mm")
    draw_intro.text((out_w//2, 320), "Put Real Money Behind Your Promise", font=font_large, fill=(255, 255, 255), anchor="mm")
    draw_intro.text((out_w//2, 380), "Solana Renaissance Hackathon 2026 // Product Demonstration", font=font_med, fill=(158, 172, 185), anchor="mm")
    draw_intro.text((out_w//2, 430), "Dual-Staking Vaults  •  Pure SIWS  •  Automated Oracles  •  Solana Blinks", font=font_med, fill=(126, 200, 164), anchor="mm")

    # Outro Title Card
    outro_img = Image.new("RGB", (out_w, out_h), (13, 15, 18))
    draw_outro = ImageDraw.Draw(outro_img)
    draw_outro.text((out_w//2, 260), "🏆 COMMIT PROTOCOL // HACKATHON READY", font=font_large, fill=(255, 107, 85), anchor="mm")
    draw_outro.text((out_w//2, 320), "171/171 Tests Passing  •  25/25 Attacks Defended  •  Live Devnet Settlement", font=font_med, fill=(255, 255, 255), anchor="mm")
    draw_outro.text((out_w//2, 380), "GitHub: https://github.com/chauhansubash456789-spc/COMMIT", font=font_mono, fill=(56, 189, 248), anchor="mm")
    draw_outro.text((out_w//2, 430), "Anchor Program: programs/commit-protocol/src/lib.rs", font=font_mono, fill=(158, 172, 185), anchor="mm")

    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", str(target_fps),
        "-i", "-",
        "-c:v", "libopenh264",
        "-b:v", "3000k",
        output_mp4
    ]

    print("Launching FFmpeg subprocess...", flush=True)
    # Using DEVNULL for stderr to completely avoid Windows pipe deadlock
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

    intro_frames = target_fps * 5   # 5 sec intro
    outro_frames = target_fps * 5   # 5 sec outro
    content_frames = total_output_frames - intro_frames - outro_frames

    print(f"Streaming {total_output_frames} frames into MP4 encoder...", flush=True)
    last_reported = -1

    for out_idx in range(total_output_frames):
        cur_sec = out_idx / target_fps
        m = int(cur_sec // 60)
        s = int(cur_sec % 60)
        time_str = f"{m:02d}:{s:02d} / 03:00"

        if out_idx < intro_frames:
            frame = intro_img.copy()
        elif out_idx >= total_output_frames - outro_frames:
            frame = outro_img.copy()
        else:
            c_idx = out_idx - intro_frames
            s_idx = int((c_idx / content_frames) * (n_sampled - 1))
            frame = sampled_frames[min(s_idx, n_sampled - 1)].copy()

        draw = ImageDraw.Draw(frame)

        # Top Bar
        draw.rectangle([(0, 0), (out_w, 42)], fill=(13, 15, 18))
        draw.line([(0, 42), (out_w, 42)], fill=(255, 255, 255, 40))
        draw.text((24, 21), "⚡ COMMIT PROTOCOL // SOLANA RENAISSANCE 2026", font=font_med, fill=(255, 107, 85), anchor="lm")
        draw.text((out_w - 24, 21), time_str, font=font_mono, fill=(255, 255, 255), anchor="rm")

        # Bottom Bar
        chap = get_chapter(cur_sec)
        draw.rectangle([(0, out_h - 44), (out_w, out_h)], fill=(13, 15, 18))
        draw.line([(0, out_h - 44), (out_w, out_h - 44)], fill=(255, 255, 255, 40))
        draw.text((24, out_h - 22), f"📍 {chap}", font=font_med, fill=(255, 255, 255), anchor="lm")

        # Progress bar
        pct = out_idx / total_output_frames
        bar_w = int(out_w * pct)
        draw.rectangle([(0, out_h - 4), (bar_w, out_h)], fill=(255, 107, 85))

        # Convert to BGR
        r, g, b = frame.split()
        bgr = Image.merge("RGB", (b, g, r))
        proc.stdin.write(bgr.tobytes())

        cur_pct = int((out_idx / total_output_frames) * 100)
        if cur_pct != last_reported and cur_pct % 10 == 0:
            print(f"Encoding progress: {cur_pct}% ({time_str})", flush=True)
            last_reported = cur_pct

    proc.stdin.close()
    proc.wait()

    if proc.returncode == 0:
        file_size = os.path.getsize(output_mp4)
        print(f"SUCCESS! Output MP4 generated: {output_mp4} ({file_size:,} bytes)", flush=True)
        import shutil
        shutil.copyfile(output_mp4, public_mp4)
        print(f"SUCCESS! Copied to public: {public_mp4}", flush=True)
    else:
        print(f"FFmpeg exited with error code {proc.returncode}", flush=True)

if __name__ == "__main__":
    generate_3min_demo_mp4()
