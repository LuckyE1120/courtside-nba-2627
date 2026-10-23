"""Save the 30 team marks locally so pages never depend on remote logo requests."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import subprocess
import shutil

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / 'public' / 'season-2026-27.json'
OUTPUT = ROOT / 'public' / 'team-logos'

def download(item):
    abbr, url = item
    target = OUTPUT / f'{abbr.lower()}.png'
    if target.exists() and target.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):
        return abbr
    response = subprocess.run(
        ['curl', '--http1.1', '-fLsS', '--retry', '5', '--retry-all-errors',
         '--retry-delay', '2', '--max-time', '45', url],
        check=True, capture_output=True, timeout=280)
    if not response.stdout.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError(f'{abbr}: invalid PNG response')
    target.write_bytes(response.stdout)
    if shutil.which('sips'):
        subprocess.run(['sips', '-Z', '128', str(target)], check=True, capture_output=True)
    return abbr

if __name__ == '__main__':
    schedule = json.loads(SNAPSHOT.read_text())
    logos = {team['abbr']: team['logo'] for game in schedule['games'] for team in game['teams']}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(download, item) for item in sorted(logos.items())]
        for future in as_completed(futures):
            print(f'{future.result()} saved', flush=True)
    print(f'{len(logos)} team logos cached in {OUTPUT}', flush=True)
