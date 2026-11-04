# Changelog entries

Each PR adds its own file here instead of editing `CHANGELOG.md`, so PRs never
conflict over the changelog.

Name the file `<slug>.<type>.md`, where type is `added`, `changed`, `deprecated`,
`removed`, `fixed` or `security`. The content is one sentence for players, for
example `bean-stickers.added.md`:

```md
Players can put stickers on their beans.
```

Don't add the PR link: it comes from the `(#123)` in the squash commit title. A PR
with two changes adds two files.

## Releasing

Preview the next release:

```bash
bun run changelog
```

Write it to `CHANGELOG.md`, bump `package.json` and delete the entries here:

```bash
bun run changelog 0.2.0
```
