# Wedding photo uploader

A one-button React page. Guests tap **Upload photos**, pick images from their
phone, and they land in a folder in your Dropbox.

A small Express server sits between the page and Dropbox so your Dropbox
credentials never reach guests’ browsers.

## 1. Create a Dropbox app (5 minutes)

1. Go to https://www.dropbox.com/developers/apps and click **Create app**.
2. Choose **Scoped access** → **App folder** (safest: it can only touch one folder).
3. On the **Permissions** tab, tick `files.content.write`, then **Submit**.
4. On the **Settings** tab, copy the **App key** and **App secret**.

## 2. Get a refresh token (one time)

1. Open this URL in your browser, replacing `APP_KEY`:

   https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline

2. Click **Allow** and copy the access code Dropbox shows you.
3. Exchange it for a refresh token (replace the three values):

   curl https://api.dropbox.com/oauth2/token -d code=ACCESS_CODE -d grant_type=authorization_code -u APP_KEY:APP_SECRET

4. Copy the `refresh_token` from the response.

## 3. Run it

    cp .env.example .env     # then paste in your key, secret and refresh token
    npm install
    npm run dev

Open http://localhost:5173. Photos appear in
`Dropbox/Apps/<your app name>/Wedding Photos`.

## 4. Put it online for the wedding

    npm run build
    npm start

The server serves the built site and the upload endpoint together. Deploy to
any Node host (Render, Railway, Fly.io) and add the four `.env` values as
environment variables. Then make a QR code of the URL and put it on the tables.

## Notes

- Photos upload one at a time, so one failure won’t cancel the rest.
- Max 100 MB per photo (change `fileSize` in `server.js`).
- Edit the names and text in `index.html` and `src/App.jsx`.
