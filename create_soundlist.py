import json
from os import listdir


def main():
	sound_dir = "sounds"
	filenames = listdir(sound_dir)

	soundlist = []

	for filename in filenames:
		if filename.endswith(".wav"):
			obj = {
				"audio": f"sounds/{filename}",
				"icon": None
			}

			for extension in ["png", "svg"]:
				icon_filename = filename.replace(".wav", f"__icon.{extension}")
				if icon_filename in filenames:
					obj["icon"] = f"sounds/{icon_filename}"
					break

			soundlist.append(obj)

	soundlist.sort(key=lambda x: x["audio"])

	output_filename = "soundlist.json"
	json.dump(soundlist, open(output_filename, "w"), indent=4)
	print(f"Created {output_filename} with {len(soundlist)} sounds")

if __name__ == "__main__":
	main()