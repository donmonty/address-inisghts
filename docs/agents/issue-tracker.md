# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `donmonty/address-inisghts`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** `/triage` reads only issues; leave pull requests alone.

_(If this repo later starts receiving feature requests as external PRs, flip this flag to `yes`. When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:_

- _**Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff._
- _**List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`)._
- _**Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`._

_GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

For the `wayfinder` skill. GitHub expresses the map's structure natively — use these, not body conventions.

- **The map**: an issue labelled `wayfinder:map`. Find it with `gh issue list --label "wayfinder:map" --state open`.
- **Tickets**: child issues of the map, each labelled `wayfinder:<type>` (`research`, `prototype`, `grilling`, `task`).
- **Attach a ticket to the map** (sub-issue): look up the child's numeric `id` (not its number), then post it. Note `-F` for a typed integer — `-f` sends a string and 422s:
  ```sh
  id=$(gh api repos/{owner}/{repo}/issues/<child-number> --jq .id)
  gh api -X POST repos/{owner}/{repo}/issues/<map-number>/sub_issues -F sub_issue_id=$id
  ```
- **Blocking edge** (`<blocked>` is blocked by `<blocker>`), same `id`-not-number rule:
  ```sh
  id=$(gh api repos/{owner}/{repo}/issues/<blocker>/ --jq .id)
  gh api -X POST repos/{owner}/{repo}/issues/<blocked>/dependencies/blocked_by -F issue_id=$id
  ```
- **Claim a ticket**: `gh issue edit <number> --add-assignee @me`, before any work.
- **The frontier** — open, unassigned children of the map with nothing open blocking them:
  ```sh
  gh api repos/{owner}/{repo}/issues/<map-number>/sub_issues \
    --jq '.[] | select(.state=="open" and .assignee==null) | {number, title}'
  ```
  then drop any whose `dependencies/blocked_by` still lists an open issue.
- **Resolve**: `gh issue close <number> --comment "<the answer>"`, then append a one-line gist + link to the map's Decisions-so-far.
