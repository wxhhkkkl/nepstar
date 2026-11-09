#!/usr/bin/env python3
"""Verify the Orion runtime bundle in source or an APK, without running it."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def verify(apk=None):
    manifest = json.loads((ROOT / 'android/app/src/main/face-models.json').read_text())
    errors = []
    archive = zipfile.ZipFile(apk) if apk else None
    try:
        for model in manifest['models']:
            name = 'assets/' + model['file']
            try:
                data = archive.read(name) if archive else (ROOT / 'android/app/src/main' / name).read_bytes()
            except (KeyError, FileNotFoundError):
                errors.append('Missing ' + name)
                continue
            if len(data) != model['size'] or hashlib.sha256(data).hexdigest() != model['sha256']:
                errors.append('Size/checksum mismatch: ' + name)
        native = manifest['nativeLibrary']
        try:
            data = archive.read(native['apkFile']) if archive else (ROOT / 'android/app/src/main' / native['file']).read_bytes()
            if hashlib.sha256(data).hexdigest() != native['sha256']:
                errors.append('Native SDK does not match the face models')
        except (KeyError, FileNotFoundError):
            errors.append('Missing native face SDK')
        if not archive:
            jar = manifest['jar']
            if hashlib.sha256((ROOT / 'android/app' / jar['file']).read_bytes()).hexdigest() != jar['sha256']:
                errors.append('Java SDK does not match the face models')
    finally:
        if archive:
            archive.close()
    if errors:
        raise ValueError('\n'.join(errors))
    print(f"Verified {len(manifest['models'])} face models and matching SDK: {apk or 'source'}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path)
    args = parser.parse_args()
    try:
        verify(args.apk)
    except (ValueError, OSError, zipfile.BadZipFile) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
