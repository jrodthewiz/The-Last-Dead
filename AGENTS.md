# The Last Dead

This is the standalone horror FPS repository. Its canonical local checkout is C:/Users/wolfk/Desktop/thelastdead and its origin is https://github.com/jrodthewiz/The-Last-Dead.git.

Findle is a different project: miniature worlds and hidden-object discovery. Do not place The Last Dead code, staging folders or assets back into Findle. Work directly in this repository.

Keep the user's existing game tab intact. The local game URL is http://127.0.0.1:5200/. The Start The Last Dead.cmd launcher resolves this directory automatically. Verify process ownership before restarting a server.

Runtime and build need only Node.js and the bundled assets/vendor files. Browser QA uses local Playwright or explicit PLAYWRIGHT_PATH and CHROME_PATH overrides. .art-source is an ignored preservation archive, not runtime input.