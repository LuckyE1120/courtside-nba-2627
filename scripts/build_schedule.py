"""Create a compact 2026-27 schedule snapshot from ESPN public team schedules."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import time
import subprocess

TEAMS = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY','OKC','ORL','PHI','PHX','POR','SAC','SA','TOR','UTAH','WSH']
BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{}/schedule?season=2027'

def fetch_team(abbr):
    last_error = None
    for attempt in range(5):
        try:
            response = subprocess.run(['curl','--http1.1','-fL','-sS','--max-time','35',BASE.format(abbr.lower())], check=True, capture_output=True, timeout=40)
            doc = json.loads(response.stdout)
            if not isinstance(doc.get('events'), list):
                raise ValueError('events missing')
            return abbr, doc['events']
        except Exception as error:
            last_error = error
            time.sleep(attempt + 1)
    raise RuntimeError(f'{abbr}: {last_error}')

def game_view(event):
    competition = event['competitions'][0]
    status = competition.get('status') or event.get('status') or {}
    kind = status.get('type') or {}
    teams = []
    for team in competition.get('competitors', []):
        info = team.get('team') or {}
        score = team.get('score')
        if isinstance(score, dict):
            score = score.get('value', score.get('displayValue'))
        try:
            score = int(float(score)) if score not in (None, '') else None
        except (TypeError, ValueError):
            score = None
        logos = info.get('logos') or []
        logo = info.get('logo') or next((x.get('href') for x in logos if 'scoreboard' in x.get('rel', [])), None) or (logos[0].get('href') if logos else '')
        leaders = []
        for category in team.get('leaders') or []:
            for leader in (category.get('leaders') or [])[:1]:
                athlete = leader.get('athlete') or {}
                image = athlete.get('headshot') or ''
                if isinstance(image, dict):
                    image = image.get('href') or ''
                leaders.append({'name':category.get('name') or '', 'value':leader.get('value') or 0, 'player':athlete.get('displayName') or '', 'image':image})
        teams.append({'id':team.get('id') or info.get('id') or '', 'abbr':info.get('abbreviation') or '', 'english':info.get('displayName') or '', 'logo':logo, 'color':info.get('color') or '64766b', 'score':score, 'home':team.get('homeAway') == 'home', 'record':'', 'quarters':[int(x.get('value') or 0) for x in team.get('linescores') or []], 'leaders':leaders})
    teams.sort(key=lambda x: x['home'])
    return {'id':event['id'],'date':event['date'],'state':kind.get('state') or 'pre','status':kind.get('shortDetail') or kind.get('description') or '','period':status.get('period') or 0,'clock':status.get('displayClock') or '','complete':bool(kind.get('completed')),'venue':(competition.get('venue') or {}).get('fullName') or '场馆待公布','seasonType':(event.get('seasonType') or {}).get('type') or 2,'teams':teams,'link':f"https://www.espn.com/nba/game/_/gameId/{event['id']}"}

if __name__ == '__main__':
    games = {}
    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = [executor.submit(fetch_team, team) for team in TEAMS]
        for future in as_completed(futures):
            abbr, events = future.result()
            print(f'{abbr}: {len(events)}', flush=True)
            for event in events:
                if event.get('season', {}).get('year') != 2027 or not event.get('competitions'):
                    continue
                game = game_view(event)
                if len(game['teams']) != 2:
                    continue
                old = games.get(game['id'])
                if old is None or sum(len(t['leaders']) for t in game['teams']) > sum(len(t['leaders']) for t in old['teams']):
                    games[game['id']] = game
    if len(games) < 1000:
        raise RuntimeError(f'Only {len(games)} games found; refusing incomplete snapshot')
    payload = {'generatedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'games':sorted(games.values(), key=lambda x:x['date'])}
    target = Path(__file__).resolve().parent.parent / 'public' / 'season-2026-27.json'
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':'))+'\n')
    print(f'Wrote {len(games)} games to {target}', flush=True)
