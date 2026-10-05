#!/usr/bin/env python3
"""Per-printer project templates for bambu3mf.js (bambu-printers/<id>.json).
usage: python3 tools/build_templates.py bambu-printers   (with src.3mf = any two-colour card .3mf from the
dashboard, next to this script; needs Bambu Studio installed, macOS paths)

For each enclosed Bambu printer, Bambu Studio's own CLI re-targets a finished two-part card project (src.3mf)
to that printer's system presets (flattened with resolve.py from ~/Library/Application Support/BambuStudio)
and exports it; its Metadata/project_settings.config is the complete, GUI-format settings for two filaments
on that printer (checked: for the P2S it equals the template built from a GUI-saved project, key for key).
The card's process overrides are then applied and listed in different_settings_to_system[0]."""
import json, os, subprocess, sys, zipfile
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'resolve.py')).read().split("if __name__")[0])
BS = '/Applications/BambuStudio.app/Contents/MacOS/BambuStudio'
OUT = sys.argv[1]
PRINTERS = [  # id, label, machine model, ASA preset, ABS preset
    ('X1C', 'X1 Carbon', 'Bambu Lab X1 Carbon', 'Bambu ASA @BBL X1C 0.4 nozzle', 'Bambu ABS @BBL X1C'),
    ('X1E', 'X1E', 'Bambu Lab X1E', 'Bambu ASA @BBL X1E 0.4 nozzle', 'Bambu ABS @BBL X1E'),
    ('P1S', 'P1S', 'Bambu Lab P1S', 'Bambu ASA @BBL X1C 0.4 nozzle', 'Bambu ABS @BBL P1S 0.4 nozzle'),
    ('P2S', 'P2S', 'Bambu Lab P2S', 'Bambu ASA @BBL P2S 0.4 nozzle', 'Bambu ABS @BBL P2S'),
    ('H2S', 'H2S', 'Bambu Lab H2S', 'Bambu ASA @BBL H2S', 'Bambu ABS @BBL H2S'),
    ('H2D', 'H2D (two nozzles)', 'Bambu Lab H2D', 'Bambu ASA @BBL H2D 0.4 nozzle', 'Bambu ABS @BBL H2D'),
    ('H2DP', 'H2D Pro (two nozzles)', 'Bambu Lab H2D Pro', 'Bambu ASA @BBL H2DP 0.4 nozzle', 'Bambu ABS @BBL H2DP'),
    ('H2C', 'H2C (two nozzles)', 'Bambu Lab H2C', 'Bambu ASA @BBL H2C', 'Bambu ABS @BBL H2C'),
    ('X2D', 'X2D (two nozzles)', 'Bambu Lab X2D', 'Bambu ASA @BBL X2D 0.4 nozzle', 'Bambu ABS @BBL X2D 0.4 nozzle'),
]
OVR = {  # same overrides as the original P2S template
    'sparse_infill_density': '100%', 'skeleton_infill_density': '100%', 'skin_infill_density': '100%',
    'sparse_infill_pattern': 'zig-zag', 'wall_loops': '3', 'wall_generator': 'arachne', 'brim_type': 'no_brim',
    'enable_support': '0', 'enable_prime_tower': '1', 'layer_height': '0.2', 'initial_layer_print_height': '0.2',
    'ironing_type': 'no ironing',
}
CLI_ONLY = ('compatible_printers_condition', 'filament_map_2', 'inherits_group')
os.makedirs(OUT, exist_ok=True); W = os.path.join(HERE, 'build'); os.makedirs(W, exist_ok=True)

def flat(kind, name, path):
    cfg = resolve(kind, name); j = index(kind)[name]
    cfg.update(name=name, inherits='', type=j.get('type', kind), instantiation='true'); cfg['from'] = 'system'
    if 'setting_id' in j: cfg['setting_id'] = j['setting_id']
    json.dump(cfg, open(path, 'w'), indent=1); return cfg

def retarget(pid, mat, m, p, f):
    out = os.path.join(W, f'{pid}-{mat}.3mf')
    r = subprocess.run([BS, '--debug', '2', '--load-settings', f'{m};{p}', '--load-filaments', f'{f};{f}', '--export-3mf', out,
                        os.path.join(HERE, 'src.3mf')], capture_output=True, text=True, timeout=600)
    if r.returncode or not os.path.exists(out): raise SystemExit(f'{pid} {mat}: CLI failed\n{r.stdout[-2000:]}{r.stderr[-2000:]}')
    s = json.loads(zipfile.ZipFile(out).read('Metadata/project_settings.config'))
    for k in CLI_ONLY: s.pop(k, None)
    return s

index_out = []
for pid, label, model, asa, abs_ in PRINTERS:
    mname = model + ' 0.4 nozzle'
    mp, pp = os.path.join(W, f'm-{pid}.json'), os.path.join(W, f'p-{pid}.json')
    mc = flat('machine', mname, mp); pc = flat('process', mc['default_print_profile'], pp)
    fa, fb = os.path.join(W, f'asa-{pid}.json'), os.path.join(W, f'abs-{pid}.json')
    flat('filament', asa, fa); flat('filament', abs_, fb)
    S = {}
    for mat, f in (('ASA', fa), ('ABS', fb)):
        s = retarget(pid, mat, mp, pp, f)
        assert s['printer_settings_id'] == mname and s['print_settings_id'] == pc['name'], (s['printer_settings_id'], s['print_settings_id'])
        assert s['filament_settings_id'] == [asa if mat == 'ASA' else abs_] * 2, s['filament_settings_id']
        assert s['filament_colour'] == ['#FFFFFF', '#000000'], s['filament_colour']
        system = {k: s[k] for k in OVR}
        for k in ('skeleton_infill_density', 'skin_infill_density', 'sparse_infill_density', 'wall_loops', 'layer_height', 'ironing_type', 'brim_type', 'wall_generator', 'sparse_infill_pattern', 'initial_layer_print_height', 'enable_support'):
            if k in pc: system[k] = pc[k] if not isinstance(pc[k], list) else pc[k][0]
        system['enable_prime_tower'] = pc.get('enable_prime_tower', '1')
        for k, v in OVR.items(): s[k] = v
        # Every override is listed, even where it happens to equal the preset: Bambu Studio takes listed keys from
        # the project and everything else from the system preset, so nothing can silently revert.
        diff = sorted(OVR)
        s['different_settings_to_system'] = [';'.join(diff)] + [''] * (len(s['different_settings_to_system']) - 1)
        s['curr_bed_type'] = 'Textured PEI Plate'
        if len(s.get('pre_start_fan_time', [])) == 1: s['pre_start_fan_time'] = s['pre_start_fan_time'] * 2  # per filament, as the GUI writes it
        S[mat] = (s, system)
    base, system = S['ASA']
    abs_patch = {k: v for k, v in S['ABS'][0].items() if base.get(k) != v}
    tpl = {
        'about': f'Bambu Studio project settings for bambu3mf.js: printer "{mname}", process "{pc["name"]}" (+ the card\'s overrides, '
                 f'listed in different_settings_to_system[0]), filaments "{asa}" / "{abs_}". Made by Bambu Studio '
                 f'{base["version"]} itself (CLI re-target of a two-part card project to these system presets). '
                 'Regenerate when Bambu Studio updates its presets.',
        'app': 'BambuStudio-' + base['version'], 'printer': {'id': pid, 'label': label, 'model': model, 'nozzles': len(mc['nozzle_diameter'])},
        'colours': ['#FFFFFF', '#000000'],
        'system': {k: system[k] for k in ('ironing_type', 'layer_height')},
        'materials': {'ASA': {}, 'ABS': abs_patch},
        'settings': base,
    }
    json.dump(tpl, open(os.path.join(OUT, pid + '.json'), 'w'), indent=1, ensure_ascii=False)
    index_out.append({'id': pid, 'label': label, 'nozzles': len(mc['nozzle_diameter'])})
    print(pid, 'keys', len(base), 'diff', base['different_settings_to_system'][0], '| abs patch', len(abs_patch),
          '| bed', base['textured_plate_temp'], abs_patch.get('textured_plate_temp'), '| chamber', base.get('chamber_temperatures'),
          '| area', base['printable_area'], '| tower', base['wipe_tower_x'], base['wipe_tower_y'], base['prime_tower_width'], '| map', base['filament_map'], base['filament_map_mode'])
json.dump(index_out, open(os.path.join(HERE, 'printers-index.json'), 'w'), indent=1)
