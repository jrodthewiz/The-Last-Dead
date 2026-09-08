# Project separation

Canonical repository: Desktop/thelastdead, with its own .git and origin https://github.com/jrodthewiz/The-Last-Dead.git.

The former Desktop/deadarrival folder was renamed. The untracked Findle/deadarrival staging folder was moved to .art-source/findle-staging-archive inside this project. It is preserved locally and ignored by Git. It is not a build input. The obsolete Start Dead Arrival launcher was archived; use Start The Last Dead.cmd.

The live server runs from the canonical folder at http://127.0.0.1:5200/. The launcher resolves its directory with PSScriptRoot. Runtime assets are local; no Findle or Dogfight checkout is required to play or build. Browser QA resolves project-local Playwright or an explicit PLAYWRIGHT_PATH override.

Findle remains its own miniature-world hidden-object game. Its tracked source was not edited for this relocation. Earlier build reports retain historical project names and paths as evidence, not setup instructions.