# Mood Tracker

Mood Tracker is a warm, client-side journaling app for logging moods throughout the day.

![screenshot](screenshot.png)

## Features

- Log multiple entries per day with 5 moods: 😄 Great, 🙂 Good, 😐 Okay, 😕 Low, 😢 Rough
- Optional notes (up to 280 characters) with live character count
- Edit any saved entry at any time from mood history
- View reverse-chronological history grouped by month
- Click any history entry to edit it in a modal
- Weekly 7-day emoji summary (`○` for missing days)
- Total entry count and most frequent mood stats
- Export all data to a formatted JSON file
- Import JSON data with date-based merging (newer entry metadata wins on conflicts)
- Clear all data with confirmation

## Use Locally

1. Download or clone this repository.
2. Open `index.html` in your browser.

No server, build step, or package manager is required.

## Data Storage

All mood data is stored only in your browser `localStorage` under the key `moodtracker_entries`.
Data stays on your device unless you explicitly export it.

## Deploy to GitHub Pages

1. Push the repository to the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/** (root), then save.
5. Wait for deployment and open your published Pages URL.

## Export / Import Data

- **Export Data**: Click **Export Data** to download entries as a `.json` file.
- **Import Data**: Click **Import Data** and select a previously exported `.json` file. Incoming data is merged by entry identity, keeping the most recently updated version on duplicates.

## License

This project is licensed under the [MIT License](LICENSE).
