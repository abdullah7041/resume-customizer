"""Export a small source-only patch, including exactly one new regression test."""
import re
import subprocess
import sys
from pathlib import Path
from incident import incident, output


def split_paths(records, issue):
    test = None
    source = []
    for record in records:
        status, path = record[:2], record[3:]
        if not re.fullmatch(r"(src|netlify/functions|netlify/lib)/[a-zA-Z0-9_./-]+\.(js|jsx|ts|tsx|css)", path):
            raise ValueError("Change outside the repair scope")
        if any(part.startswith(".") for part in path.split("/")):
            raise ValueError("Protected source path")
        if re.fullmatch(rf"(src/__tests__|netlify/functions/__tests__)/autofix-{issue}\.test\.tsx?", path):
            if test or status != "??":
                raise ValueError("Expected one new test")
            test = path
        elif ("autofix" not in path.lower() and
              not re.search(r"(/(__tests__|test|__mocks__)/|\.(test|spec)\.)", path) and
              status in (" M", "??", " D")):
            source.append(path)
        else:
            raise ValueError("Unexpected test or file change")
    if not test or not 1 <= len(source) <= 15:
        raise ValueError("Expected a minimal fix and a new regression")
    return test, source


def collect(meta, directory, bundle):
    issue, _, _, _ = incident()
    root = Path(directory)
    def git(*args):
        return subprocess.check_output(["git", "--git-dir=" + meta, "--work-tree=" + directory,
                                        "-c", "core.hooksPath=/dev/null", *args], cwd=root)
    records = git("status", "--porcelain=v1", "--untracked-files=all", "-z").decode().split("\0")
    test, source = split_paths([r for r in records if r], issue)
    for name in [test, *source]:
        path = root / name
        if path.resolve() != path or path.exists() and (not path.is_file() or path.stat().st_size > 512_000):
            raise ValueError("Expected a regular source file")
    git("add", "-A", "--", test, *source)
    for filename, paths in [("test.diff", [test]), ("fix.diff", source)]:
        patch = git("diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--", *paths)
        if not 0 < len(patch) <= 200_000:
            raise ValueError("Patch outside size bounds")
        (Path(bundle) / filename).write_bytes(patch)
    (Path(bundle) / "test-path").write_text(test)
    output("status", "candidate")


if __name__ == "__main__":
    collect(*sys.argv[2:])
