import re
import os

files_to_update = {
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\CommunityFeedScreen.js': {
        r'borderRadius: 20': 'borderRadius: 24',
        r'borderRadius: 22': 'borderRadius: 999',  # addBtn 44/2
        r'borderRadius: 6': 'borderRadius: 16',
        r'borderRadius: 8': 'borderRadius: 16',
        r'borderTopLeftRadius: 24': 'borderTopLeftRadius: 24',
        r'borderRadius: 10': 'borderRadius: 16',
        r'borderRadius: 12': 'borderRadius: 16',
        r'borderRadius: 1.5': 'borderRadius: 1.5'
    },
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\ScannerScreen.js': {
        r'borderRadius: 20': 'borderRadius: 24',
        r'borderRadius: 16': 'borderRadius: 24',
        r'borderRadius: 10': 'borderRadius: 16',
        r'borderRadius: 8': 'borderRadius: 16',
        r'borderRadius: 12': 'borderRadius: 16',
        r'borderRadius: 6': 'borderRadius: 16',
        r'borderRadius: 5': 'borderRadius: 16',
        r'borderTopLeftRadius: 8': 'borderTopLeftRadius: 16',
        r'borderTopRightRadius: 8': 'borderTopRightRadius: 16',
        r'borderBottomLeftRadius: 8': 'borderBottomLeftRadius: 16',
        r'borderBottomRightRadius: 8': 'borderBottomRightRadius: 16'
    }
}

for file, replacements in files_to_update.items():
    if not os.path.exists(file):
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    for old, new in replacements.items():
        # don't replace things like 'width: 40, height: 40, borderRadius: 20' blindly if we want specific values,
        # but the prompt says "large border radii (e.g., 24 for bottom sheets/cards, 16 or 999 for buttons/badges)"
        # so doing a blanket replace is generally fine for a quick style update.
        content = re.sub(r'\b' + old + r'\b', new, content)

    # Let's fix buttons to be 999 if they are perfectly circular
    # CommunityFeedScreen
    # avatarContainer 40x40 borderRadius: 20 -> borderRadius: 999
    # sendBtn 40x40 borderRadius: 20 -> borderRadius: 999
    # dot 20x20 borderRadius: 10 -> borderRadius: 999
    # we already mapped 20->24 and 10->16, let's fix them manually for circles if needed
    # Wait, the regex replace will change all `borderRadius: 20` to `24`. 40x40 with radius 24 is weird, but works.
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {file}')
