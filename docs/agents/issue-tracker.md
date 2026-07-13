# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh`
CLI and infer the repository from the current Git remote.

## Operations

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number> --comment "..."`

When a skill says “publish to the issue tracker,” create a GitHub issue.
When a skill says “fetch the relevant ticket,” read that GitHub issue.

## Pull requests as a triage surface

PRs as a request surface: no.

## Wayfinding

A wayfinding map is one GitHub issue with linked child issues. Prefer
GitHub sub-issues and native dependencies when available. Otherwise,
record child issues in a task list and dependencies using a
`Blocked by: #<number>` line.
