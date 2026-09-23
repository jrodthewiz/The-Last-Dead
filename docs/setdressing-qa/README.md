# Campaign set dressing visual QA

These nine screenshots show the live Bloodworks, Ossuary, and Choir rooms at
player height. The capture starts a real run, including room gates, then
pauses each view for a repeatable screenshot. The weapon and toast are hidden
only in the capture page so the props remain visible.

Run `node tests/setdressing-visual.mjs` while the local game server is available
at `http://127.0.0.1:5200/`. Set `PLAYWRIGHT_PATH` if Playwright is installed
outside this repository and `CHROME_PATH` to choose a Chrome executable. The
optional `SETDRESSING_QA_SECTORS` variable accepts a comma-separated subset of
`0,1,2`; `SETDRESSING_QA_DIR` selects a different output folder.

`report.json` records the placed counts, view positions, render statistics,
and browser errors. The FPS field is sampled during startup and is not a
performance benchmark for the paused screenshots.
