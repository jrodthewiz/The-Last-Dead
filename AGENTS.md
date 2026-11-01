# The Last Dead

This is the standalone horror FPS repository. Its canonical local checkout is C:/Users/wolfk/Desktop/thelastdead and its origin is https://github.com/jrodthewiz/The-Last-Dead.git.

## Local development and account ownership

This checkout is a **local Windows project**, registered in Codex as `thelastdead` on host `local`. Use this folder and PowerShell for development, builds and local play. A ChatGPT/Codex conversation or account connection does not make this a managed cloud development environment. Do not provision a cloud workspace, Linux container or remote executor unless the user requests one. Follow actual execution-host context if it changes.

GitHub `jrodthewiz/The-Last-Dead` holds the versioned source. The existing public ChatGPT Site is a separately published copy, project `appgprj_6ad33a298eb8819188a58f7b2d1de01c`, reached through https://jrod.download/blackwater/. Its hosted runtime and lobby service are remote; the development checkout remains local. `sites/blackwater` is the publishing wrapper, not the canonical game source or evidence of a cloud development task. Git pushes do not automatically publish a Sites release.

Use the connected GitHub account for repository operations and the connected Site owner's ChatGPT account for publishing. Verify those connections independently when needed; never infer browser sign-in from connector access. Local play and the public game currently require neither account login nor an API key. Solo saves are browser-local and do not sync through ChatGPT or GitHub. See [local development and account access](docs/local-development-and-accounts.md) for the verified setup and recovery path.

Findle is a different project: miniature worlds and hidden-object discovery. Do not place The Last Dead code, staging folders or assets back into Findle. Work directly in this repository.

Keep the user's existing game tab intact. The local game URL is http://127.0.0.1:5200/. The Start The Last Dead.cmd launcher resolves this directory automatically. Verify process ownership before restarting a server.

Runtime and build need only Node.js and the bundled assets/vendor files. Browser QA uses local Playwright or explicit PLAYWRIGHT_PATH and CHROME_PATH overrides. .art-source is an ignored preservation archive, not runtime input.

## Game review personalities

Project review profiles live in `.codex/agents/`: all 19 designer/engineer profiles adapted from Desktop/dogfight, plus seven adversarial art, horror, direction, craft and newcomer critics. Read `docs/adversarial-review/README.md` for the review contract and roster. These are analytical lenses, not impersonations or endorsements.

For an explicit full-council review, cover every requested personality separately, in bounded batches. For a focused task, use only relevant lenses. Critique creative decisions with current evidence, counterevidence and a test that could change the verdict; never decide by vote. Reviews are read-only unless implementation is separately requested. If the active tool catalog cannot spawn a saved profile, use an available role with its actual brief and disclose that fallback. Saving a profile does not prove it is loaded in the running chat.
