# Getting your game on the leaderboard

Using the Yodacon Ship Pack in something? Get it listed in
[USED-IN.md](USED-IN.md). Listing is free, and so is not asking: the licence
lets you use the pack whether or not you're on the board.

## What qualifies

- **It flies at least one ship from this pack**, from either edition. Sprites,
  yard, comm, target or icon pictures all count, edited or not.
- **People can see it.** A playable build, a public repository, a store page, or
  a video of the ships in play. "Coming soon" pages wait until there is
  something to look at.
- **It credits the pack.** Somewhere a player or reader can find it: credits
  screen, README, about box or video description. The line below is enough.
- **It keeps the licence.** If you give the assets to anyone else, as part of a
  download, a repository or an installer, they go with the GPL-2.0 licence text
  (`LICENSE` in this pack) and the credit line, so the next person has the same
  freedoms you had.

Games, mods, engines, jams, tutorials, videos and art remixes all qualify.
Commercial projects too.

### The credit line

```text
Ships from the Yodacon Ship Pack by Paul Richeson (ConEx, 1997),
GPL-2.0-or-later — https://github.com/yodacon/yodacon-ship-pack
```

## How to apply

1. **Open an issue** on this repository and choose
   **"Used in: list my project"**. The form asks for:
   - the project's name and a one-line description
   - who made it (a name or a handle)
   - a link where it can be seen or played
   - which ships it flies, and from which edition
   - where the credit line appears (a link, or a screenshot pasted into the issue)
   - one screenshot with a pack ship on screen (optional, but it speeds up review)
2. **A reviewer checks it**, usually within a week:
   - the link opens and shows the project
   - at least one pack ship is visible in the project
   - the credit line is where you said it is
   - if the project redistributes the assets, the licence goes with them
3. **The reviewer adds your row** to `USED-IN.md`, ranked by designs flown, and
   closes the issue with a link to the commit. You don't need to send a pull
   request.

You can send the pull request yourself if you'd rather: add one row to the table
in `USED-IN.md` in rank order, and fill in the same details in the PR
description. It's reviewed the same way.

## Keeping a listing up to date

- **Flying more ships now?** Open a new issue with the form and say it's an
  update; the row moves up the board.
- **Project gone?** Rows whose link has been dead for 90 days are moved to a
  *Retired* section at the bottom, not deleted. Open an issue if it comes back.
- **Want off the board?** Ask in an issue and the row is removed, no questions.

## What gets a listing declined

- No pack ship can be found in the project.
- No credit anywhere a player or reader could find it.
- The project presents the ships as someone else's original work.
- The project is malware, a scam, or harassment.

A declined application can be sent again once the problem is fixed.

## For reviewers

Rank is distinct designs flown (out of eleven: the ten 1997 hulls and the
Callisto; either edition counts, and the 1/4 Defender counts as the Defender),
then the date first listed. Keep
`Listed` as the first-listing date even when a row is updated. Check the credit
and the licence; don't judge how good the game is.
