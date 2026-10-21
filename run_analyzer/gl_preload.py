"""
Make MediaPipe importable on hosts without OpenGL (Vercel Functions).

mediapipe's libmediapipe.so links libEGL.so.1 and libGLESv2.so.2 even when
only the CPU path is used. Vercel's runtime ships neither, so vendor/gl holds
the glvnd dispatch libraries (CentOS 7 builds, glibc 2.14+). Loading them with
RTLD_GLOBAL before mediapipe lets the dynamic linker satisfy those NEEDED
entries by soname. On hosts that already have the libraries this is a no-op.
"""

import ctypes
import ctypes.util
import sys
from pathlib import Path

_VENDOR = Path(__file__).parent / "vendor" / "gl"
_LIBS = ("libGLdispatch.so.0", "libEGL.so.1", "libGLESv2.so.2")  # dependency order


def preload() -> None:
    if not sys.platform.startswith("linux") or ctypes.util.find_library("EGL"):
        return
    for name in _LIBS:
        path = _VENDOR / name
        if path.exists():
            ctypes.CDLL(str(path), mode=ctypes.RTLD_GLOBAL)
