# Put Curio on GitHub and publish the portfolio demo

Use **GitHub for the source code** and **Vercel for the live website and API**. Your existing portfolio can stay on GitHub Pages and link to the Curio demo.

The previous local-only project ran its API inside Vite. This copy adds a hosted function so browsing, product pages, checkout collection checks and Buy again can use the API on Vercel. It also includes page routing for refreshing product, checkout and order URLs.

## 1. Prepare the project

Extract the ZIP into a new folder. Open the folder that contains `package.json` in VS Code. If you have made changes in a different local version, copy the hosting additions into that version or merge your changes into this folder before uploading.

The hosting additions are the complete `api/` folder, `server/hosted.ts`, `vercel.json`, this guide, the `api` include in `tsconfig.json`, the `.vercel/` ignore entry, and the Node.js engine/version metadata in the package files. The shared UI and shopping behavior are retained.

Run these checks with Node.js 24.x:

```sh
npm ci
npm test
npm run build
```

## 2. Which files go to GitHub?

Upload the **contents of the extracted project folder**, with the same folder structure:

- Folders: `src/`, `public/`, `server/`, `api/`, `tests/`, and `e2e/`.
- Package files: `package.json` and `package-lock.json`.
- Configuration: `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, and `vercel.json`.
- Other root files: `index.html`, `.gitignore`, `README.md`, and `DEPLOYMENT.md`.

Leave out `node_modules/`, `dist/`, `.vercel/`, `coverage/`, `test-results/`, `playwright-report/`, `.env` files, and the ZIP itself. The included `.gitignore` handles these generated/local files when you use Git. Browser uploads require you to select the correct files yourself.

The GitHub repository's top level should show `package.json`, `vercel.json`, `src/`, `public/`, `server/` and `api/`. If it only shows another project folder or a ZIP, the source is nested one level too deep for the default settings below.

## 3. Upload using the GitHub website

1. Sign in at [GitHub](https://github.com/).
2. Create a **new, separate repository** named `curio-product-explorer`. Use Public if you want portfolio visitors to read the source. Keep your portfolio repository separate.
3. Leave the options to add a README, `.gitignore` or licence unchecked because this project already has its own files. Create the repository.
4. Click **uploading an existing file**, or **Add file → Upload files**.
5. Drag the project contents listed above into the page. Include the folders themselves so their structure is preserved. Upload source files, not the ZIP.
6. Enter a commit message such as `Add Curio ecommerce portfolio project` and commit the upload to `main`. If GitHub proposes a branch/PR, merge it into `main` before importing the project on Vercel.
7. Check that `package.json` and `vercel.json` appear at the repository's top level.

This project has fewer than 100 source files, so it fits GitHub's current per-upload file limit. For regular development, Git or GitHub Desktop is a more convenient way to upload future changes.

## Alternative: push from the VS Code terminal

For a fresh extracted project, create an empty GitHub repository as described above, then run the commands below from the folder containing `package.json`. Replace `YOUR_USERNAME` with your GitHub username. Git must be installed, and GitHub may open a browser sign-in prompt.

```sh
git init -b main
git add .
git commit -m "Add Curio ecommerce portfolio project"
git remote add origin https://github.com/YOUR_USERNAME/curio-product-explorer.git
git push -u origin main
```

These commands are for a new local repository. If your project is already tracked by Git, use its existing repository/remote and commit the changes there instead of adding a duplicate `origin`.

## 4. Publish using Vercel

1. Sign in at [Vercel](https://vercel.com/) with your GitHub account. The Hobby plan is intended for personal projects; check the plan information shown during signup.
2. Choose **Add New → Project**.
3. Connect GitHub when prompted, authorize the Curio repository, and import `curio-product-explorer`.
4. Confirm the settings below. The included `vercel.json` already specifies the install, build and output values.

| Setting               | Value                               |
| --------------------- | ----------------------------------- |
| Framework Preset      | Vite                                |
| Root Directory        | Project root / `./`                 |
| Node.js Version       | 24.x                                |
| Install Command       | `npm ci --include=dev`              |
| Build Command         | `npm run build`                     |
| Output Directory      | `dist`                              |
| Environment Variables | None required for the included demo |

5. Choose **Deploy** and wait for the deployment to finish.
6. Copy the project's **production domain** shown by Vercel. Use that stable production address for your portfolio rather than a branch preview address.
7. Open the production URL in a signed-out/private window to check that visitors can view it.

Only a successful deployment in your Vercel account establishes the public live demo. This source package has been prepared and checked locally; it has not been deployed or verified against the Vercel-hosted environment here.

## 5. Check the deployed demo

- Open `/api/catalogue?source=curio` on the live domain. It should return JSON with the sample products.
- Open `/products/aural-studio` directly and refresh the page. It should load the product page and its photos.
- Add a product, open the bag, continue to checkout, use the sample details, apply a demo code, and place a demo order.
- Open **My Orders**, refresh a saved receipt, and try **Buy again**.
- If testing the optional external collection, remember that its provider can be unavailable; the app displays a notice. The curated collection is bundled with the function.

Orders and favourites use browser storage. Data from your localhost address is separate from data on the new public domain. Orders remain demo receipts: no card details, payment, email or shipment are created.

## 6. Link it from your portfolio

Use two links on the Curio project card:

- **Live Demo** → the production URL Vercel gives you.
- **Source Code** → the GitHub repository URL.

You can add the live URL to the repository's **About → Website** field too. Keep your existing portfolio hosting; Curio can live on its own Vercel domain.

## 7. Updating the demo later

Commit future code changes to the GitHub repository's production branch, usually `main`. Vercel's connected Git integration creates a new production deployment from that branch. You do not need to upload `dist` manually or unpublish the project for each update.

If you used Git from the terminal:

```sh
git add .
git commit -m "Describe the update"
git push
```

## If something fails

- **No `package.json` found:** the repository is nested inside an extra folder. Move the project contents to the repository root, or set Vercel's Root Directory to that inner folder.
- **Build reports an unsupported Node.js version:** select 24.x and redeploy. The package engine also targets Node.js 24.
- **Home loads but product/checkout URLs return 404:** check that `vercel.json` is at the repository root and included in the deployed commit.
- **Catalogue API returns HTML or 404:** check that both `api/index.ts` and `vercel.json` were uploaded, then redeploy.
- **Function cannot resolve an imported module:** check that the `server/` and `src/` folders were uploaded with their original paths. Read the function log in Vercel.
- **Your changes do not appear:** check the latest Vercel deployment's commit and branch, confirm it succeeded, and refresh the production address.

## Official references

- [Upload files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Push locally hosted code to GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel Git deployments](https://vercel.com/docs/git)
