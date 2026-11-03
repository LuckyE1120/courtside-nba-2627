"""Cache recent ESPN box scores for browsers that cannot reach ESPN directly."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent / 'public'
TARGET = ROOT / 'recent-boxscores.json'
SNAPSHOT = ROOT / 'season-2026-27.json'
now = datetime.now(timezone.utc)
cutoff = now - timedelta(days=2)

def fetch_boxscore(game_id):
    url = f'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={game_id}'
    response = subprocess.run(['curl', '--http1.1', '-fL', '-sS', '--max-time', '10', url], capture_output=True, check=True, timeout=15)
    data = json.loads(response.stdout)
    boxscore = data.get('boxscore') or {}
    if not boxscore.get('teams') and not boxscore.get('players'):
        raise ValueError(f'{game_id}: empty box score')
    return game_id, {'boxscore': boxscore}

if __name__ == '__main__':
    snapshot = json.loads(SNAPSHOT.read_text())
    selected = [game['id'] for game in snapshot['games']
                if game['state'] != 'pre' and cutoff <= datetime.fromisoformat(game['date'].replace('Z', '+00:00')) <= now]
    previous = json.loads(TARGET.read_text()) if TARGET.exists() else {'games': {}}
    games = {game_id: previous['games'][game_id] for game_id in selected if game_id in previous.get('games', {})}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(fetch_boxscore, game_id) for game_id in selected]
        for future in as_completed(futures):
            try:
                game_id, data = future.result()
                games[game_id] = data
            except Exception as error:
                print(f'Box score unavailable: {error}', flush=True)
    TARGET.write_text(json.dumps({'generatedAt': now.isoformat().replace('+00:00', 'Z'), 'games': games}, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Wrote {len(games)} recent box scores', flush=True)
