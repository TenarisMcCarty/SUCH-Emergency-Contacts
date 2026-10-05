#!/usr/bin/env python3
"""Flatten a Bambu Studio system preset (resolve "inherits" + "include") into one JSON
that the Bambu Studio CLI can load with --load-settings / --load-filaments.
usage: resolve.py <type: machine|process|filament> "<preset name>" out.json"""
import json, os, sys

SYS = os.path.expanduser('~/Library/Application Support/BambuStudio/system/BBL')
_index = {}

def index(kind):
    if kind not in _index:
        m = {}
        d = os.path.join(SYS, kind)
        for f in os.listdir(d):
            if f.endswith('.json'):
                try:
                    j = json.load(open(os.path.join(d, f)))
                    m[j.get('name', f[:-5])] = j
                except Exception:
                    pass
        _index[kind] = m
    return _index[kind]

META = {'name', 'inherits', 'include', 'instantiation', 'from', 'setting_id', 'type', 'description'}

def resolve(kind, name):
    j = index(kind)[name]
    cfg = {}
    if j.get('inherits'):
        cfg.update(resolve(kind, j['inherits']))
    for inc in j.get('include', []):
        cfg.update(resolve(kind, inc))
    for k, v in j.items():
        if k not in META:
            cfg[k] = v
    return cfg

if __name__ == '__main__':
    kind, name, out = sys.argv[1:4]
    cfg = resolve(kind, name)
    j = index(kind)[name]
    cfg['name'] = name
    cfg['from'] = 'system'
    cfg['inherits'] = ''
    cfg['type'] = j.get('type', kind)
    if 'setting_id' in j:
        cfg['setting_id'] = j['setting_id']
    cfg['instantiation'] = 'true'
    json.dump(cfg, open(out, 'w'), indent=4)
    print(out, len(cfg))
