#!/usr/bin/env python3
import sys
import os
import subprocess
from PIL import Image

try:
    import Xlib.display
    import Xlib.X
    HAS_XLIB = True
except ImportError:
    HAS_XLIB = False

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_PATH = os.path.join(ROOT_DIR, 'public', 'icons', 'icon-512.png')

def get_target_window_ids():
    """Find window IDs matching pdfsign app window (excluding terminals)."""
    try:
        out = subprocess.check_output(['wmctrl', '-lx']).decode('utf-8', errors='ignore')
    except Exception:
        return []
    win_ids = []
    for line in out.splitlines():
        parts = line.split(None, 4)
        if len(parts) < 5:
            continue
        win_id_hex, desktop, wm_class, client, title = parts
        lower_line = line.lower()
        # Skip terminals, text editors, file managers
        if any(ign in lower_line for ign in ['gnome-terminal', 'terminal', 'sublime', 'nemo', 'code']):
            continue
        if 'pdfsign' in lower_line or '127.0.0.1' in lower_line:
            try:
                win_ids.append(int(win_id_hex, 16))
            except ValueError:
                pass
    return win_ids

def build_net_wm_icon_data(sizes=(16, 24, 32, 48, 64, 128)):
    if not os.path.exists(ICON_PATH):
        return []
    master = Image.open(ICON_PATH).convert('RGBA')
    combined = []
    for sz in sizes:
        resized = master.resize((sz, sz), Image.Resampling.LANCZOS)
        combined.append(sz)
        combined.append(sz)
        pixels = list(resized.getdata())
        for r, g, b, a in pixels:
            # 32-bit ARGB
            val = (a << 24) | (r << 16) | (g << 8) | b
            combined.append(val)
    return combined

def apply_icon_to_window(disp, win_id, icon_data):
    try:
        atom_icon = disp.intern_atom('_NET_WM_ICON')
        atom_cardinal = disp.intern_atom('CARDINAL')
        win = disp.create_resource_object('window', win_id)
        
        # Set _NET_WM_ICON property with full multi-size icon dataset
        win.change_property(atom_icon, atom_cardinal, 32, icon_data, Xlib.X.PropModeReplace)
        
        # Ensure WM_CLASS is set to pdfsign
        win.set_wm_class('pdfsign', 'pdfsign')
        
        disp.sync()
        return True
    except Exception as e:
        print(f"[set-window-icon] Failed on window {hex(win_id)}: {e}", file=sys.stderr)
        return False

def main():
    target_ids = []
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            try:
                target_ids.append(int(arg, 16) if arg.startswith('0x') else int(arg))
            except ValueError:
                pass
    if not target_ids:
        target_ids = get_target_window_ids()

    if not target_ids:
        sys.exit(0)

    if not HAS_XLIB:
        sys.exit(1)

    disp = Xlib.display.Display()
    icon_data = build_net_wm_icon_data()
    if not icon_data:
        sys.exit(1)

    for wid in target_ids:
        apply_icon_to_window(disp, wid, icon_data)

if __name__ == '__main__':
    main()
