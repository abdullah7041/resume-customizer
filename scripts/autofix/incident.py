"""Trusted workflow steps. Only allowlisted incident metadata crosses the Sentry boundary."""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
SIGNALS = json.loads((ROOT / "src/types/autofix-signals.json").read_text())
BROWSER = {"browser_error", "parseResume", "analyzeResumeWithAI", "optimizeResume", "refineBullet",
           "analyzeVision2030", "analyzeResumeTruthCheck", "optimize", "pdf-extract", "render"}
KINDS = {"Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "AbortError", "TimeoutError"}


def incident():
    issue, release, signal, kind = (os.environ[k] for k in ("ISSUE", "RELEASE", "SIGNAL", "KIND"))
    if not (re.fullmatch(r"\d{1,20}", issue) and re.fullmatch(r"[0-9a-f]{40}|unknown", release)
            and signal in BROWSER.union(SIGNALS["functions"], SIGNALS["outcomes"]) and kind in KINDS):
        raise ValueError("Invalid incident metadata")
    return issue, release, signal, kind


def output(name, value):
    if "\n" in str(value) or "\r" in str(value):
        raise ValueError("Invalid step output")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        print(f"{name}={value}", file=stream)


def gh(*args):
    return subprocess.check_output(["gh", *args], text=True).strip()


def source_location():
    _, release, _, _ = incident()
    value = os.getenv("LOCATION", "")
    if re.fullmatch(r"[0-9a-f]{64}:[1-9]\d{0,5}", value):
        digest, line = value.split(":")
        paths = subprocess.check_output(["git", "ls-tree", "-rz", "--name-only", release, "src", "netlify"])
        for path in paths.split(b"\0"):
            if hashlib.sha256(path).hexdigest() == digest:
                return print(f"{path.decode()}:{line}")
    print("No mapped application frame")


def claim():
    issue, release, _, _ = incident()
    repo = os.environ["GITHUB_REPOSITORY"]
    prefix = f"codex/autofix-{issue}-"
    # The workflow's per-issue concurrency serializes this check with publication.
    pulls = json.loads(gh("api", "--paginate", "--slurp", f"repos/{repo}/pulls?state=open&per_page=100"))
    if any(p["head"]["ref"].startswith(prefix) and (p["head"]["repo"] or {}).get("full_name") == repo
           for page in pulls for p in page):
        return output("new", "false")
    tag = f"tags/autofix-seen/{issue}-{release}"
    refs = json.loads(gh("api", f"repos/{repo}/git/matching-refs/{tag}"))
    if any(ref["ref"] == "refs/" + tag for ref in refs):
        # Only an explicit re-run of the original Actions run retries an unresolved incident.
        return output("new", "true" if int(os.environ["GITHUB_RUN_ATTEMPT"]) > 1 else "false")
    gh("api", "--method", "POST", f"repos/{repo}/git/refs", "-f", "ref=refs/" + tag,
       "-f", "sha=" + os.environ["GITHUB_SHA"])
    output("new", "true")


def budget_status(data):
    cap, remaining = data.get("limit"), data.get("limit_remaining")
    if (data.get("limit_reset") != "monthly" or type(cap) not in (float, int) or not 0 < cap <= 5
            or data.get("include_byok_in_limit") is not True or type(remaining) not in (float, int)):
        return "budget_unconfirmed"
    return "ready" if remaining > 0 else "budget_exhausted"


def budget():
    try:
        request = Request("https://openrouter.ai/api/v1/key",
                          headers={"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"]})
        with urlopen(request, timeout=10) as response:
            status = budget_status(json.load(response)["data"])
    except (OSError, KeyError, ValueError):
        status = "budget_unconfirmed"
    output("status", status)


def telegram(message):
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    data = json.dumps({"chat_id": os.environ["TELEGRAM_CHAT_ID"], "text": message,
                       "link_preview_options": {"is_disabled": True}}).encode()
    request = Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data,
                      headers={"Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:
            if json.load(response).get("ok") is not True:
                raise ValueError("Telegram rejected the report")
    except (OSError, ValueError) as error:
        raise RuntimeError("Telegram delivery failed; see the Actions summary") from None


STATUS = {
    "budget_exhausted": "The monthly repair budget is exhausted. No model call was started.",
    "budget_unconfirmed": "Could not confirm a dedicated OpenRouter key capped at $5 monthly. Investigation paused.",
    "unknown_release": "The event did not identify a deployed commit on main. Investigation needs a release SHA.",
    "unreproduced": "A regression could not be reproduced and fixed with sample data.",
    "upstream": "Investigation points to an external service. The application fix is unverified.",
    "unverified": "The isolated repair or its independent checks did not complete successfully.",
    "verification_failed": "The candidate failed independent verification. No pull request was opened. The run contains the failed check.",
    "stale": "The verified change no longer applies to the reviewed main revision. Re-run the investigation.",
    "publication_failed": "The repair passed its checks but GitHub publication failed.",
}

OUTCOMES = {
    "feed_load_failed": "The job feed could not load.",
    "feed_verification_failed": "Job verification failed while the user was checking matches.",
    "job_handoff_missing": "The selected job description did not reach tailoring.",
    "job_handoff_mismatch": "Tailoring received a different job description.",
    "pdf_corrupt": "The CV export returned an empty or unreadable file.",
    "pdf_blank": "The exported CV appeared blank.",
    "pdf_raster_only": "The CV exported as an image without extractable text.",
    "pdf_text_mismatch": "The exported text did not match the CV preview.",
    "pdf_verification_failed": "Watheq could not verify the exported CV.",
    "pdf_export_failed": "The CV export failed.",
}


def report():
    issue, release, signal, kind = incident()
    repo = os.environ["GITHUB_REPOSITORY"]
    run = f"https://github.com/{repo}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
    pr = os.environ.get("PR_URL", "")
    if re.fullmatch(r"https://github\.com/" + re.escape(repo) + r"/pull/\d+", pr):
        status = "Synthetic regression failed before the fix and passed afterward. Lint, types and tests passed on the PR base. Review and merge on your phone:\n" + pr
    else:
        status = STATUS.get(os.getenv("STATUS"), STATUS["unverified"])
    description = OUTCOMES.get(signal, f"The {signal} workflow reported {kind}.")
    message = f"Watheq · Sentry issue {issue}\n{description}\nRelease: {release[:12]}\n{status}\nEvidence: {run}"
    send_report(message)


def send_report(message):
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
        print(message, file=stream)
    telegram(message)


if __name__ == "__main__":
    {"claim": claim, "budget": budget, "report": report, "location": source_location}[sys.argv[1]]()
