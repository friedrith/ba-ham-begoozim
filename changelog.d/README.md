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

Then run the **Release** workflow from the Actions tab on `master` and merge the PR it
opens. That PR writes the release to `CHANGELOG.md`, bumps `package.json` and deletes
the entries here. Leave the version empty to work it out: minor if anything was added,
patch otherwise.

The same from a local checkout:

```bash
bun run changelog auto
```

### Setting up the workflow

It needs a repository secret called `RELEASE_TOKEN`: a fine-grained personal access
token limited to this repository, with read and write access to contents and pull
requests. Renew it when it expires.
