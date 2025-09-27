# Bring the Heat — Name TBD

Currently an ugly, not super-tested, single-player version of the game.

## Running the Game:

Clone the repo:
```bash
git clone https://github.com/ZEBR0Z/Gamejam2025
```

Move to the repo directory:
```bash
cd Gamejam2025
```

Make it open in localhost
> this is just because unless it's in a localhost, JavaScript can't read other files using fetch:
>
```bash
python -m http.server 8000
```

Playtest the game in http://localhost:8000/

## What's currently done in this Single-Player Version:
### Selection Phase:
- You get 5 random sounds (I scraped https://thirtydollar.website/ to just get a massive amount of temporary sounds for now), and then the player has 10 seconds to select 3 of them and confirm. If they don't, it just picks the first 3.
> Now that I'm looking at it, someone should to add the ability to unselect a sound once you select it. And maybe have it select 3 random ones instead of the first 3.

### Performance Phase:
- The player presses 1, 2, or 3 on their keyboard to play each of the sounds.
- You can right-click it on the little timeline to erase a note

### Editing Phase:
- Now they can drag the notes up and down on a little thing to make them higher and lower

### Final Phase:
- Now that time is up, it just plays and shows their song for them