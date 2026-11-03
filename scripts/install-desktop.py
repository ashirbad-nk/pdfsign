#!/usr/bin/env python3
import os
import shutil
import subprocess
from PIL import Image

def install():
    home = os.path.expanduser('~')
    apps_dir = os.path.join(home, '.local', 'share', 'applications')
    icons_base = os.path.join(home, '.local', 'share', 'icons', 'hicolor')
    os.makedirs(apps_dir, exist_ok=True)

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_icons = os.path.join(root_dir, 'public', 'icons')
    master_icon = os.path.join(src_icons, 'icon-512.png')

    if not os.path.exists(master_icon):
        return

    im = Image.open(master_icon)
    sizes = [16, 24, 32, 48, 64, 128, 256, 512]
    for sz in sizes:
        target_dir = os.path.join(icons_base, f'{sz}x{sz}', 'apps')
        os.makedirs(target_dir, exist_ok=True)
        target_file = os.path.join(target_dir, 'pdfsign.png')
        if not os.path.exists(target_file) or os.path.getmtime(target_file) < os.path.getmtime(master_icon):
            im.resize((sz, sz), Image.Resampling.LANCZOS).save(target_file)

    svg_target_dir = os.path.join(icons_base, 'scalable', 'apps')
    os.makedirs(svg_target_dir, exist_ok=True)
    svg_src = os.path.join(src_icons, 'icon.svg')
    if os.path.exists(svg_src):
        shutil.copy(svg_src, os.path.join(svg_target_dir, 'pdfsign.svg'))

    # ~/.local/share/applications/pdfsign.desktop
    desktop_file = os.path.join(apps_dir, 'pdfsign.desktop')
    content = f'''[Desktop Entry]
Version=1.0
Type=Application
Name=PDFSign
GenericName=PDF Signing & Annotation
Comment=100% private, client-side PDF signing and annotation
Exec={root_dir}/scripts/launch-pdfsign.sh %U
Icon={src_icons}/icon-512.png
Terminal=false
Categories=Office;Utility;Graphics;
Keywords=pdf;sign;signature;annotation;
StartupNotify=true
StartupWMClass=pdfsign
MimeType=application/pdf;
'''
    with open(desktop_file, 'w') as f:
        f.write(content)
    os.chmod(desktop_file, 0o755)

    # Update Desktop shortcut if present
    desktop_shortcut = os.path.join(home, 'Desktop', 'PDFSign.desktop')
    if os.path.exists(os.path.join(home, 'Desktop')):
        with open(desktop_shortcut, 'w') as f:
            f.write(content)
        os.chmod(desktop_shortcut, 0o755)

    # Update in root directory as well
    root_desktop = os.path.join(root_dir, 'PDFSign.desktop')
    with open(root_desktop, 'w') as f:
        f.write(content)
    os.chmod(root_desktop, 0o755)

    try:
        subprocess.run(['gtk-update-icon-cache', icons_base], capture_output=True)
        subprocess.run(['update-desktop-database', apps_dir], capture_output=True)
    except Exception:
        pass

if __name__ == '__main__':
    install()
