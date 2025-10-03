import json
from os import listdir

from mutagen.mp3 import MP3


def main():
    sound_dir = "../assets/sounds"
    backing_tracks_dir = "../assets/backing_tracks"

    filenames = listdir(sound_dir)
    backing_filenames = listdir(backing_tracks_dir)

    soundlist = []
    backing_tracks = []

    # Process sounds
    for filename in filenames:
        if filename.endswith(".wav"):
            obj = {"audio": f"sounds/{filename}", "icon": None}

            for extension in ["png", "svg"]:
                icon_filename = filename.replace(".wav", f"__icon.{extension}")
                if icon_filename in filenames:
                    obj["icon"] = f"assets/sounds/{icon_filename}"
                    break

            soundlist.append(obj)

    soundlist.sort(key=lambda x: x["audio"])

    # Process backing tracks
    for filename in backing_filenames:
        if filename.endswith(".mp3"):
            filepath = f"{backing_tracks_dir}/{filename}"
            try:
                audio = MP3(filepath)
                duration = audio.info.length
                backing_tracks.append(
                    {"audio": f"assets/backing_tracks/{filename}", "duration": duration}
                )
            except Exception as e:
                print(f"Warning: Could not read duration for {filename}: {e}")
                backing_tracks.append(
                    {"audio": f"assets/backing_tracks/{filename}", "duration": None}
                )

    backing_tracks.sort(key=lambda x: x["audio"])

    # Create output structure
    audiomap = {"backing_tracks": backing_tracks, "sounds": soundlist}

    output_filename = "audiomap.json"
    json.dump(audiomap, open(output_filename, "w"), indent=4)
    print(
        f"Created {output_filename} with {len(backing_tracks)} backing tracks and {len(soundlist)} sounds"
    )


if __name__ == "__main__":
    main()
