# J2 Plate

A phone app that reads the J2 Dining menu every day and tells you what to eat, and how many portions, to hit your daily targets.

It has three parts:

- `scrape.py` pulls the J2 menus and nutrition labels from UT FoodPro. It keeps only vegetarian and vegan dishes.
- A GitHub Action runs that script twice a day and saves the result to `data/menu.json`.
- `index.html` and `planner.js` form the app. It loads the menu file and works out portions for each meal. GitHub Pages hosts it for free.

## Setup (about 10 minutes, on a laptop)

1. Create a **public** repository on GitHub named `j2-plate`.
2. Upload the files with **Add file → Upload files**: `index.html`, `planner.js`, `scrape.py`, `README.md`, `.nojekyll`, and the `data` folder.
3. Add the workflow with **Add file → Create new file**. Name it `.github/workflows/scrape.yml` and paste in the contents of that file from this folder. (Mac Finder hides folders that start with a dot, so drag-and-drop often skips them.)
4. Give the Action permission to save the menu. Go to **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, and press Save.
5. Run the first menu update. Go to **Actions → Update J2 menu → Run workflow**. Wait for the green check, about 2–4 minutes. A file named `data/menu.json` should now exist in the repo.
6. Turn on hosting. Go to **Settings → Pages** and set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`. After a minute your app is live at `https://YOUR-USERNAME.github.io/j2-plate/`.
7. Open that link in Safari on your iPhone. Tap **Share → Add to Home Screen**.

## Using it

- Each meal shows a suggested plate, such as **2× Seasoned Lentils (3 oz each)**.
- **I ate this** logs the meal. The meals you haven't eaten yet are then re-planned around what's left of the day's target.
- **Another option** suggests a different plate.
- **+ / −** change portions. **×** hides a dish permanently. **Add a dish** logs something the planner didn't suggest.
- **Not eating here** skips that meal. The remaining meals then cover the rest of the day.
- **Outside J2 today** holds things like your whey shake, so the planner counts them. You can add your own foods.
- **Copy for sheet** copies the meal's 15 totals. Paste them into column B of that meal's row in your Food tab.

Targets follow the 12-week plan: 2,600 kcal in weeks 1–2 and 9, and 2,350 kcal otherwise. You can change the plan start date in Settings. Your logs are saved on your phone only.

## If the update fails

The scraper was written against the FoodPro page layout but couldn't be tested live. If the Action fails or the app shows no dishes, do this:

1. Run **Update J2 menu** again with **Save raw pages for troubleshooting** ticked.
2. Download the `debug-pages` artifact from the finished run.
3. Share it so the parsing can be fixed.
