# Local development and account access

Blackwater / The Last Dead browser edition is developed on the owner's Windows PC. The conversation and publishing tools are connected to accounts, while the working files, builds and local server live on that PC. The public release has its own hosted runtime and lobby service. These are separate responsibilities.

The player's browser renders the world and runs gameplay on the player's device. Sites serves the published files and supports multiplayer discovery/relay; it does not stream a remotely rendered game.

## Project map

| Responsibility | Location | Account needed |
| --- | --- | --- |
| Edit, build and play locally | `C:/Users/wolfk/Desktop/thelastdead`; Codex project `thelastdead`, host `local` | No game login or API key |
| Versioned source and backup | [jrodthewiz/The-Last-Dead](https://github.com/jrodthewiz/The-Last-Dead) | GitHub account with repository access |
| Publish and manage the release | Existing ChatGPT Site, project `appgprj_6ad33a298eb8819188a58f7b2d1de01c` | The owning ChatGPT account through Sites |
| Public play | [jrod.download/blackwater](https://jrod.download/blackwater/), redirecting to [the canonical game origin](https://the-last-dead-blackwater.jrodonthebeat.chatgpt.site) | Currently public; no player login |

The local Codex project ID is `7bfecccd-e089-4b3e-b3ba-45a0dc859a10`. It is already registered as a local Git repository. Do not create a second cloud project or copy this game into another project to coordinate these accounts. The Unity project and Findle remain separate.

## Recommended workflow

1. Open the existing local `thelastdead` project and edit the canonical root sources.
2. Run **Start Blackwater Browser.cmd** (or **Start The Last Dead.cmd**) and use `http://127.0.0.1:5200/`. The launchers check build freshness and reuse a healthy existing server. Check process ownership before restarting it.
3. Commit reviewed source changes and push them to the existing GitHub repository. A GitHub push runs its configured CI; it does not publish a new Sites version.
4. When a public release is intended, prepare `sites/blackwater` from the root sources and use the Sites plugin's official source/package/publish workflow for the existing project ID. Its source repository and publication authorization are separate from the GitHub origin. Follow [the hosting guide](blackwater-multiplayer.md#rebuilding-the-sites-deployment).
5. Check the published game at the existing public URL. Keep the current Site, audience, lobby origin and alias; do not create a replacement Site for each release.

The nested Sites README includes generic portable and managed-Linux starter guidance. This Windows checkout uses the portable/local path. That template does not change where the game is developed. GitHub CI and the published Site can run remotely without making this local checkout a cloud development environment.

## Login and recovery

Verification on **1 November 2026** found:

- The connected GitHub identity is **jrodthewiz**.
- The local checkout's `git push --dry-run origin HEAD:main` succeeded with interactive authentication disabled. This checked the current Git authentication path without changing remote files.
- The connected ChatGPT account has **owner** access to **The Last Dead · Blackwater**. The current Site is public, with version 44 reported as the latest version at verification time.

No fresh login is needed for the currently connected tools. These checks do not establish which account is signed in within a separate browser window, and authorization can expire.

For owner access from another browser or PC:

- Sign in to [GitHub](https://github.com/login) as `jrodthewiz`, then open the existing repository. Browser sign-in, local Git credentials and the GitHub connector are separate connections; reconnect only the one that fails. The GitHub CLI is not required for this setup.
- Sign in to [ChatGPT](https://chatgpt.com/) with the account that owns the existing Blackwater Site. Keep the same account/workspace when reconnecting the Sites plugin. A successful owner lookup through Sites is the verification; creating a new Site is not a recovery step. The account's email was not exposed by the ownership check.
- If a publishing credential expires, the Sites plugin obtains another short-lived source credential for the same project through its supported workflow. Do not reuse the GitHub credential as a Site credential or put either in this repository.

Passwords, verification codes and browser authentication remain with the owner. The game has no OpenAI API dependency and needs no OpenAI API key for ordinary play. Optional sign-in helper code in the Sites starter is not an implemented game-account or cloud-save system.

## Saves and multiplayer

Solo saves and settings use browser storage. A localhost save and a public-origin save are separate, even on the same PC; signing into ChatGPT or GitHub does not synchronize them. Public co-op discovery uses the hosted Site's room service; separate localhost servers do not share that room directory. See [multiplayer and hosting](blackwater-multiplayer.md).

Adding player accounts or cross-device saves would be a separate game feature. This coordination setup preserves the current public, login-free game.

## Official environment terminology

OpenAI distinguishes [local, worktree and cloud execution modes](https://learn.chatgpt.com/docs/environments/modes). The account connection and a published website are separate from the execution mode selected for development. The verified local project registration and Windows checkout above determine the setup used here.
