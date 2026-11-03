#!/usr/bin/env python3
"""
Native GTK3 + WebKit2 standalone desktop application runner for PDFSign.
Provides first-class Linux desktop integration:
- Dedicated window grouping (WM_CLASS: pdfsign)
- Proper high-res application icon in title bar and taskbar
- Native file chooser and automatic downloads to ~/Downloads
- Persistent local storage & IndexedDB
- Smooth fullscreen toggle (F11), reload (Ctrl+R), quit (Ctrl+Q)
"""
import sys
import os
import urllib.parse

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib, Gio, Gdk

def main():
    if len(sys.argv) < 2:
        print("Usage: desktop-app.py <url>")
        sys.exit(1)

    url = sys.argv[1]
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icon_path = os.path.join(root_dir, 'public', 'icons', 'icon-512.png')

    # Set application identity for X11 / Wayland window tracking
    GLib.set_prgname('pdfsign')
    GLib.set_application_name('PDFSign')

    # Main window
    win = Gtk.Window(title='pdfsign — sign PDFs locally')
    win.set_role('pdfsign-main')
    win.set_default_size(1280, 800)

    # Set icon
    if os.path.exists(icon_path):
        try:
            win.set_icon_from_file(icon_path)
            Gtk.Window.set_default_icon_from_file(icon_path)
        except Exception as e:
            print(f"[desktop-app] Warning setting icon: {e}", file=sys.stderr)

    # Configure WebKit context & persistent data directory
    data_dir = os.path.expanduser('~/.local/share/pdfsign')
    cache_dir = os.path.expanduser('~/.cache/pdfsign')
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(cache_dir, exist_ok=True)

    website_data_manager = WebKit2.WebsiteDataManager(
        base_data_directory=data_dir,
        base_cache_directory=cache_dir
    )
    web_context = WebKit2.WebContext.new_with_website_data_manager(website_data_manager)

    # Handle automatic file downloads (e.g. Download PDF button)
    def on_download_started(context, download):
        def on_decide_destination(dl, suggested_filename):
            downloads_dir = os.path.expanduser('~/Downloads')
            os.makedirs(downloads_dir, exist_ok=True)
            target = os.path.join(downloads_dir, suggested_filename)
            base, ext = os.path.splitext(suggested_filename)
            counter = 1
            while os.path.exists(target):
                target = os.path.join(downloads_dir, f"{base} ({counter}){ext}")
                counter += 1
            dl.set_destination(f"file://{os.path.abspath(target)}")
            return True

        download.connect('decide-destination', on_decide_destination)

    web_context.connect('download-started', on_download_started)

    # WebKit settings
    settings = WebKit2.Settings()
    settings.set_enable_javascript(True)
    settings.set_enable_developer_extras(True)
    settings.set_enable_webgl(True)
    settings.set_enable_page_cache(True)
    settings.set_javascript_can_access_clipboard(True)
    settings.set_enable_smooth_scrolling(True)

    # Create webview
    webview = WebKit2.WebView.new_with_context(web_context)
    webview.set_settings(settings)

    # Sync window title with webpage title
    def on_title_changed(view, param):
        title = view.get_title()
        if title:
            win.set_title(title)
    webview.connect('notify::title', on_title_changed)

    # Keyboard shortcuts: F11 fullscreen, Ctrl+R reload, Ctrl+Q quit
    def on_key_press(widget, event):
        keyval = event.keyval
        state = event.state & (Gdk.ModifierType.CONTROL_MASK | Gdk.ModifierType.SHIFT_MASK)
        
        if keyval == Gdk.KEY_F11:
            if win.is_fullscreen:
                win.unfullscreen()
                win.is_fullscreen = False
            else:
                win.fullscreen()
                win.is_fullscreen = True
            return True
        elif keyval in (Gdk.KEY_r, Gdk.KEY_R) and (state & Gdk.ModifierType.CONTROL_MASK):
            webview.reload()
            return True
        elif keyval in (Gdk.KEY_q, Gdk.KEY_Q) and (state & Gdk.ModifierType.CONTROL_MASK):
            win.close()
            return True
        return False

    win.is_fullscreen = False
    win.connect('key-press-event', on_key_press)

    # Clean shutdown on close
    def on_destroy(widget):
        Gtk.main_quit()
    win.connect('destroy', on_destroy)

    # Add webview to window
    win.add(webview)
    win.show_all()

    # Start maximized
    win.maximize()

    # Load URL
    webview.load_uri(url)

    # Also apply X11 multi-resolution window icon once window is mapped
    def apply_x11_icon():
        try:
            set_icon_script = os.path.join(root_dir, 'scripts', 'set-window-icon.py')
            if os.path.exists(set_icon_script):
                import subprocess
                subprocess.run(['python3', set_icon_script], capture_output=True)
        except Exception:
            pass
        return False

    GLib.timeout_add(400, apply_x11_icon)

    # Run GTK loop
    Gtk.main()

if __name__ == '__main__':
    main()
