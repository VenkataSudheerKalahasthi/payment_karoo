import os
import re

TARGET_DIRS = [
    r"d:\Payment_mama\apps\web\src",
    r"d:\Payment_mama\apps\admin\src",
    r"d:\Payment_mama\apps\superadmin\src",
]

# Exact dark theme replacements
# Order matters: more specific rules first!
REPLACEMENTS = [
    # Drop shadows & glows
    ("rgba(139, 255, 36, 0.4)", "rgba(31, 97, 239, 0.35)"),
    ("rgba(139, 255, 36, 0.35)", "rgba(31, 97, 239, 0.3)"),
    ("rgba(139, 255, 36, 0.3)", "rgba(31, 97, 239, 0.25)"),
    ("rgba(139, 255, 36, 0.25)", "rgba(31, 97, 239, 0.2)"),
    ("rgba(139, 255, 36, 0.2)", "rgba(31, 97, 239, 0.15)"),
    ("rgba(139, 255, 36, 0.16)", "rgba(31, 97, 239, 0.15)"),
    ("rgba(139, 255, 36, 0.15)", "rgba(31, 97, 239, 0.12)"),
    ("rgba(139, 255, 36, 0.12)", "rgba(31, 97, 239, 0.1)"),
    ("rgba(139, 255, 36, 0.1)", "rgba(31, 97, 239, 0.1)"),
    ("rgba(139,255,36,0.4)", "rgba(31,97,239,0.35)"),
    ("rgba(139,255,36,0.35)", "rgba(31,97,239,0.3)"),
    ("rgba(139,255,36,0.3)", "rgba(31,97,239,0.25)"),
    ("rgba(139,255,36,0.25)", "rgba(31,97,239,0.2)"),
    ("rgba(139,255,36,0.2)", "rgba(31,97,239,0.15)"),
    ("rgba(139,255,36,0.16)", "rgba(31,97,239,0.15)"),
    ("rgba(139,255,36,0.15)", "rgba(31,97,239,0.12)"),
    ("rgba(139,255,36,0.1)", "rgba(31,97,239,0.1)"),
    ("rgba(139, 255, 36", "rgba(31, 97, 239"),
    ("rgba(139,255,36", "rgba(31,97,239"),

    # Old Dark Backgrounds -> New Dark Backgrounds
    ("dark:bg-[#050605]", "dark:bg-[#0B0D14]"),
    ("dark:bg-[#080808]", "dark:bg-[#0B0D14]"),
    ("dark:bg-[#080908]", "dark:bg-[#0B0D14]"),
    ("dark:bg-[#090A09]", "dark:bg-[#0B0D14]"),
    ("dark:bg-[#0A0A0A]", "dark:bg-[#0B0D14]"),

    # Old Card & Modal Backgrounds -> New Card #191B25
    ("dark:bg-[#121212]", "dark:bg-[#191B25]"),
    ("dark:bg-[#121412]", "dark:bg-[#191B25]"),
    ("dark:bg-[#151715]", "dark:bg-[#191B25]"),
    ("dark:bg-[#171717]", "dark:bg-[#191B25]"),
    ("dark:bg-[#181A18]", "dark:bg-[#191B25]"),
    ("dark:bg-[#181a18]", "dark:bg-[#191B25]"),
    ("dark:bg-[#1C1F1C]", "dark:bg-[#1C2740]"),
    ("dark:bg-[#1c1f1c]", "dark:bg-[#1C2740]"),

    # Old Elevated / Inner Cards -> #191D2A
    ("dark:bg-[#202020]", "dark:bg-[#191D2A]"),
    ("dark:bg-[#202220]", "dark:bg-[#191D2A]"),
    ("dark:bg-[#292C28]", "dark:bg-[#191D2A]"),
    ("dark:bg-[#1e201e]", "dark:bg-[#191D2A]"),

    # Old Hover States -> #1C2740
    ("dark:hover:bg-[#202020]", "dark:hover:bg-[#1C2740]"),
    ("dark:hover:bg-[#292C28]", "dark:hover:bg-[#1C2740]"),
    ("dark:hover:bg-[#303030]", "dark:hover:bg-[#1C2740]"),
    ("dark:hover:bg-[#202220]", "dark:hover:bg-[#1C2740]"),

    # Neon Button & Accent -> Electric Blue #1F61EF
    ("dark:bg-[#8BFF24]/20", "dark:bg-[#1C2740]"),
    ("dark:bg-[#8BFF24]/15", "dark:bg-[#1C2740]"),
    ("dark:bg-[#8BFF24]/10", "dark:bg-[#1C2740]"),
    ("dark:bg-[#8BFF24]/5", "dark:bg-[#1C2740]"),
    ("dark:bg-[#8BFF24]", "dark:bg-[#1F61EF]"),
    ("dark:hover:bg-[#8BFF24]", "dark:hover:bg-[#174EC4]"),
    ("dark:hover:bg-[#A3FF50]", "dark:hover:bg-[#174EC4]"),
    ("dark:hover:bg-[#78e018]", "dark:hover:bg-[#174EC4]"),
    ("dark:hover:bg-[#A0FF4A]", "dark:hover:bg-[#174EC4]"),

    # Text Colors
    ("dark:text-[#050605]", "dark:text-white"),
    ("dark:text-[#8BFF24]", "dark:text-[#8FB5FF]"),
    ("dark:hover:text-[#8BFF24]", "dark:hover:text-[#8FB5FF]"),
    ("dark:text-[#CDCBCA]", "dark:text-[#E8ECF5]"),
    ("dark:text-[#A5A5A5]", "dark:text-[#9AA4B8]"),
    ("dark:text-[#A5AAA2]", "dark:text-[#9AA4B8]"),
    ("dark:text-[#777777]", "dark:text-[#9AA4B8]"),
    ("dark:text-[#777]", "dark:text-[#9AA4B8]"),

    # Borders -> #272B38
    ("dark:border-[rgba(205, 203, 202, 0.18)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(205,203,202,0.18)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(205, 203, 202, 0.12)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(205,203,202,0.12)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255, 255, 255, 0.10)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255,255,255,0.10)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255, 255, 255, 0.08)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255,255,255,0.08)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255, 255, 255, 0.06)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255,255,255,0.06)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255, 255, 255, 0.12)]", "dark:border-[#272B38]"),
    ("dark:border-[rgba(255,255,255,0.12)]", "dark:border-[#272B38]"),
    ("dark:border-white/10", "dark:border-[#272B38]"),
    ("dark:border-white/5", "dark:border-[#272B38]"),
    ("dark:border-[#262926]", "dark:border-[#272B38]"),
    ("dark:border-[#2e322e]", "dark:border-[#272B38]"),
    ("dark:border-[#8BFF24]/40", "dark:border-[#1F61EF]/40"),
    ("dark:border-[#8BFF24]/30", "dark:border-[#1F61EF]/30"),
    ("dark:border-[#8BFF24]/20", "dark:border-[#1F61EF]/20"),
    ("dark:border-[#8BFF24]", "dark:border-[#1F61EF]"),
    ("dark:hover:border-[#8BFF24]/40", "dark:hover:border-[#1F61EF]/40"),
    ("dark:hover:border-[#8BFF24]", "dark:hover:border-[#1F61EF]"),

    # Selection & focus
    ("dark:selection:bg-[#8BFF24]", "dark:selection:bg-[#1F61EF]"),
    ("dark:selection:text-[#050605]", "dark:selection:text-white"),
    ("dark:focus:border-[#8BFF24]", "dark:focus:border-[#1F61EF]"),
    ("dark:focus:ring-[#8BFF24]", "dark:focus:ring-[#1F61EF]"),

    # SVG horizon stops
    ('stopColor="#8BFF24"', 'stopColor="#1F61EF"'),
]

total_files_modified = 0
total_replacements = 0

for root_dir in TARGET_DIRS:
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.endswith(('.tsx', '.ts', '.jsx', '.js', '.css')):
                continue
            fpath = os.path.join(dirpath, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                print(f"Error reading {fpath}: {e}")
                continue

            orig = content
            file_repl_count = 0
            for old, new in REPLACEMENTS:
                if old in content:
                    count = content.count(old)
                    content = content.replace(old, new)
                    file_repl_count += count

            if content != orig:
                with open(fpath, 'w', encoding='utf-8') as f:
                    f.write(content)
                total_files_modified += 1
                total_replacements += file_repl_count
                rel = os.path.relpath(fpath, r"d:\Payment_mama")
                print(f"[MODIFIED] {rel} ({file_repl_count} replacements)")

print(f"\nMigration complete: {total_files_modified} files modified, {total_replacements} total replacements.")

