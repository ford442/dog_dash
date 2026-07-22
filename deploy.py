#!/usr/bin/env python3
"""
Deploy the production build via the Contabo storage manager API.

Usage:
  1. Build: npm run build
  2. export DEPLOY_TOKEN="..."   # required — see docs/DEPLOY.md
  3. python deploy.py

Requirements:
  pip install requests
"""

import io
import os
import sys
import zipfile
from pathlib import Path
from typing import Optional

import requests

# ============================================================
# PER-PROJECT CONFIGURATION (non-secret defaults only)
# ============================================================
PROJECT_NAME: str = os.environ.get('DEPLOY_PROJECT_NAME', 'dog-dash')
BUILD_DIR: str = os.environ.get('DEPLOY_BUILD_DIR', 'dist')
CONTABO_BASE_URL: str = os.environ.get('DEPLOY_CONTABO_URL', 'https://storage.noahcohn.com')
DEPLOY_FOLDER: str = os.environ.get('DEPLOY_FOLDER', '')

# Required secret — never commit tokens to the repository.
DEPLOY_TOKEN: Optional[str] = os.environ.get('DEPLOY_TOKEN')
# ============================================================


def build_zip(build_path: Path) -> bytes:
    """Zip the contents of build_path into an in-memory archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(build_path.rglob("*")):
            if file.is_dir():
                continue
            rel = file.relative_to(build_path)
            parts = rel.parts
            if any(p in (".git", "node_modules", "__pycache__") for p in parts):
                continue
            zf.write(file, str(rel))
            print(f"  + {rel}")
    return buf.getvalue()


def deploy_bundle(build_path: Path) -> bool:
    """Zip the build and upload it as a single bundle."""
    if not DEPLOY_TOKEN:
        print("Error: DEPLOY_TOKEN is required. See docs/DEPLOY.md.")
        return False

    target_folder = DEPLOY_FOLDER or PROJECT_NAME
    url = f"{CONTABO_BASE_URL}/api/deploy/{PROJECT_NAME}/bundle"
    headers = {"X-Deploy-Token": DEPLOY_TOKEN}

    print("Building zip archive...")
    zip_bytes = build_zip(build_path)
    print(f"Archive size: {len(zip_bytes) / 1024:.1f} KB\n")

    print("Uploading bundle...")
    try:
        response = requests.post(
            url,
            files={"bundle": ("build.zip", zip_bytes, "application/zip")},
            data={"target_folder": target_folder},
            headers=headers,
            timeout=300,
        )
    except Exception as exc:
        print(f"  \u2717 Upload exception: {exc}")
        return False

    if response.status_code == 200:
        data = response.json()
        print(f"  \u2713 {data.get('uploaded', 0)} files uploaded")
        if data.get("failed"):
            print("  Failures:")
            for f in data["failed"]:
                print(f"    \u2717 {f['path']}: {f['error']}")
        return not data.get("failed")
    else:
        print(f"  \u2717 {response.status_code}: {response.text[:400]}")
        return False


def main():
    print(f"\n=== Deploying '{PROJECT_NAME}' via Contabo storage API ===\n")

    build_path = Path(BUILD_DIR)
    if not build_path.exists() or not build_path.is_dir():
        print(f"ERROR: Build directory '{BUILD_DIR}/' does not exist.")
        print("Please run your build command first (e.g. `npm run build`).")
        sys.exit(1)

    try:
        health = requests.get(f"{CONTABO_BASE_URL}/api/deploy/health", timeout=10)
        if health.status_code == 200:
            print(f"Deploy service: {health.json().get('status', 'unknown')}")
    except Exception:
        print(f"Warning: Could not contact {CONTABO_BASE_URL} (continuing anyway).")

    print()
    success = deploy_bundle(build_path)

    print(f"\n=== {'Deployment complete' if success else 'Deployment finished with errors'} ===")
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
