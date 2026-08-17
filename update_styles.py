import re
import os

files = [
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\HomeScreen.js',
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\ProfileScreen.js'
]

for file in files:
    if not os.path.exists(file):
        print(f'File not found: {file}')
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Need to add import if not present: import colors, { softShadow } from '../constants/colors';
    if 'import colors' not in content:
        # insert at the end of imports
        imports_end = [m for m in re.finditer(r'^import .*?$', content, re.MULTILINE)][-1].end()
        content = content[:imports_end] + "\nimport colors, { softShadow } from '../constants/colors';" + content[imports_end:]

    # Replace shadows
    # Usually it looks like:
    # shadowColor: "#000",
    # shadowOffset: { width: 0, height: X },
    # shadowOpacity: X,
    # shadowRadius: X,
    # elevation: X,
    
    content = re.sub(r'\s*shadowColor:[^\n]*\n\s*shadowOffset:[^\n]*\n\s*shadowOpacity:[^\n]*\n\s*shadowRadius:[^\n]*\n\s*elevation:[^\n]*,?', r'\n    ...softShadow,', content)
    content = re.sub(r'\s*elevation:[^\n]*\n\s*shadowColor:[^\n]*\n\s*shadowOffset:[^\n]*\n\s*shadowOpacity:[^\n]*\n\s*shadowRadius:[^\n]*,?', r'\n    ...softShadow,', content)

    # Replacements for colors
    content = re.sub(r'(?<=backgroundColor: )\"#FBF9F8\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\"#F3F4F6\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\"#FFFFFF\"', 'colors.surface', content)
    
    content = re.sub(r'(?<=color: )\"#1B1C1C\"', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\"#000000\"', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\"#6B7280\"', 'colors.textSecondary', content)
    content = re.sub(r'(?<=color: )\"#4B5563\"', 'colors.textSecondary', content)
    
    # Text colors that are not in objects but maybe in strings? Only inside StyleSheet usually it's "color: ..." or in inline styles like {{ color: "..." }}
    
    # Primary colors
    content = re.sub(r'\"#006A3B\"', 'colors.primaryGreen', content)
    content = re.sub(r'\"#2E8B57\"', 'colors.primaryGreen', content)
    
    # Some hardcoded ones might be in strings like <Icon color="#1B1C1C" />.
    content = re.sub(r'(?<=color=\")#1B1C1C\"', '{colors.textPrimary}', content)
    content = re.sub(r'(?<=color=\")#000000\"', '{colors.textPrimary}', content)
    content = re.sub(r'(?<=color=\")#6B7280\"', '{colors.textSecondary}', content)
    content = re.sub(r'(?<=color=\")#4B5563\"', '{colors.textSecondary}', content)
    content = re.sub(r'(?<=color=\")#FFFFFF\"', '{colors.surface}', content)
    content = re.sub(r'(?<=color=\")#006A3B\"', '{colors.primaryGreen}', content)
    content = re.sub(r'(?<=color=\")#2E8B57\"', '{colors.primaryGreen}', content)
    
    # Border radii
    # e.g., borderRadius: 16 -> let's make buttons 999 or 16. Cards are already 24?
    # Actually wait, the instruction says "Ensure large border radii (e.g., 24 for cards, 999 or 16 for buttons)."
    # Let's manually check if there are standard ones.
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {file}')
