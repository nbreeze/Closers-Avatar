# CLOSERS Avatar

This is a web application built with [Next.js](https://nextjs.org/), bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app). This application lets fellow Closers who wish to (re)create their own character loadouts from the game and share them with others.

## Getting Started

Use `npm run dev` to start up the development web server. View the webserver on `http://localhost:3000`.

You will need to configure the following environment variables in `.env`:

- `PACK_BASEURL` - base URL of where packs are located.
- `CLOSERS_DAT_DIR` - (Optional) directory to `SteamDir/steamapps/common/closers/closers/DAT/`.

If you have Closers installed on your computer, you can build the asset files using `npm run buildAssets`. You must configure `CLOSERS_DAT_DIR` to use this. By default, asset packs will be outputted to the `/public/assets/DAT/` directory. You should set `PACK_BASEURL` to this value if you're running this locally.

## File Structure

### `components/` - React Components

Contains `.js` files written in **ES6** format that define React components used throughout the app.

### `modules` - Shared Modules

Contains `.js` files written in **CommonJS** format that contain code that can be shared between both Node.js and browsers.

### `pages` - Next.js Pages

Contains `.js` files written in **ES6** format that define the various pages of the app.

### `public` - Public Files

Contains a plethora of static assets that are directly accessible from the base URL of the app.

### `scripts` - Build Scripts

Contains `.js` files used to execute Node.js scripts.

### `src` - Browser Scripts

Contains `.js` files written in **ES6** format that contain code that should only be used with browsers.

### `styles` - CSS

Contains `.css`/`.scss` files that provide styling to various pages and components.
