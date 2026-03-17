import glob

files = glob.glob("app/**/*.py", recursive=True)
hits = []

for f in files:
    with open(f, encoding="utf-8") as fp:
        content = fp.read()
        if "/emergency/allocate" in content:
            hits.append(f)

print("Found in:")
print("\n".join(hits) if hits else "NONE")