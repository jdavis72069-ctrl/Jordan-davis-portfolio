# Jordan Davis — Portfolio

Mechanical Engineering · Yale University · Class of 2027

A night-sky sketchbook portfolio: every word on the site comes from plain `.txt` files in the
[`content/`](content/) folder, so it can be updated right here on GitHub without touching any code.

**To edit the site, start with [`content/HOW-TO-EDIT.txt`](content/HOW-TO-EDIT.txt).**

## Publishing (one-time setup)
1. Open **Settings → Pages** in this repository.
2. Under *Build and deployment*, choose **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, then **Save**.
3. After a minute the site is live at `https://<username>.github.io/Jordan-davis-portfolio/`.

Every change committed to `main` updates the live site automatically within a minute or two.

## What's where
| Folder / file | What it holds |
| --- | --- |
| `content/` | All the text: about, projects, art, skills, reading, contact |
| `Images/` | Photos, CAD renders, artwork, book covers and logos (`-web` files are smaller copies for fast loading) |
| `index.html`, `css/`, `js/` | The page design and animations (no need to edit) |

Previewing on your own computer: the page reads the `.txt` files over the web, so double-clicking
`index.html` won't work. Run `python3 -m http.server` in this folder and open `http://localhost:8000`.
