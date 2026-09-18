"""Sequential, bounded comparison against one Hub-owned browser. No browser launch."""
import json
import os
from pathlib import Path
import subprocess
import urllib.request

directory = Path(__file__).resolve().parent
endpoint = os.environ['HUB_CDP_URL']
with urllib.request.urlopen(endpoint + '/json/version', timeout=3) as response:
    version = json.load(response)
print(json.dumps({'browser': version['Browser'], 'protocol': version['Protocol-Version']}), flush=True)

def run(runtime, script, args=(), env=None, **labels):
    try:
        result = subprocess.run([runtime, str(directory / script), *args], env={**os.environ, **(env or {})}, capture_output=True, text=True, timeout=8)
        record = json.loads(result.stdout)
        record.update(labels, exitCode=result.returncode)
    except (subprocess.TimeoutExpired, json.JSONDecodeError) as error:
        record = dict(labels, runtime=runtime, harnessError=type(error).__name__)
    print(json.dumps(record), flush=True)

for repetition in range(1, 4):
    for transport, address in [('http', endpoint), ('ws', version['webSocketDebuggerUrl'])]:
        for runtime in (['bun', 'node'] if repetition % 2 else ['node', 'bun']):
            run(runtime, 'minimal.mjs', env={'HUB_CDP_URL': address}, transport=transport, repetition=repetition)
for mode in ['native', 'bundled', 'bundled-agent', 'http-upgrade']:
    for runtime in ['bun', 'node']:
        run(runtime, 'http-upgrade.mjs' if mode == 'http-upgrade' else 'transport.mjs', [] if mode == 'http-upgrade' else [mode])
