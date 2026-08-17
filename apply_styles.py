import re
import os

files = [
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\CalendarScreen.js',
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\MyRewardsScreen.js',
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\PointsHistoryScreen.js'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add import if missing
    if 'import colors' not in content:
        # Find last import
        imports = [m for m in re.finditer(r'^import .*?$', content, re.MULTILINE)]
        if imports:
            imports_end = imports[-1].end()
            content = content[:imports_end] + "\nimport colors, { softShadow } from '../constants/colors';" + content[imports_end:]

    # Replace shadows (StyleSheet)
    content = re.sub(r'shadowColor:\s*[\'"][^\'"]+[\'"],\s*shadowOpacity:\s*[\d.]+,\s*shadowRadius:\s*[\d.]+,\s*elevation:\s*\d+,?', r'...softShadow,', content)
    content = re.sub(r'shadowColor:\s*[\'"][^\'"]+[\'"],\s*shadowOffset:\s*\{[^}]+\},\s*shadowOpacity:\s*[\d.]+,\s*shadowRadius:\s*[\d.]+,\s*elevation:\s*\d+,?', r'...softShadow,', content)
    content = re.sub(r'shadowColor:\s*[\'"][^\'"]+[\'"],\s*shadowOpacity:\s*[\d.]+,\s*shadowRadius:\s*[\d.]+,\s*shadowOffset:\s*\{[^}]+\},\s*elevation:\s*\d+,?', r'...softShadow,', content)
    
    # Backgrounds
    for c in ['#FBF9F8', '#F3F4F6', '#E5E7EB', '#F8FAFC', '#FAFAFA']:
        content = re.sub(f'([a-zA-Z]+):\s*[\"\']{c}[\"\']', r'\1: colors.background', content, flags=re.IGNORECASE)
    
    # White background for cards/panels
    for c in ['#FFFFFF', '#FFF']:
        content = re.sub(f'(backgroundColor):\s*[\"\']{c}[\"\']', r'\1: colors.surface', content, flags=re.IGNORECASE)
        
    # Primary Green
    for c in ['#006A3B', '#2E8B57']:
        content = re.sub(f'([a-zA-Z]+)=[\"\']{c}[\"\']', r'\1={colors.primaryGreen}', content, flags=re.IGNORECASE)
        content = re.sub(f'([a-zA-Z]+):\s*[\"\']{c}[\"\']', r'\1: colors.primaryGreen', content, flags=re.IGNORECASE)
        
    # Text colors
    for c in ['#1B1C1C', '#000000', '#1F2937', '#333333']:
        content = re.sub(f'([a-zA-Z]+)=[\"\']{c}[\"\']', r'\1={colors.textPrimary}', content, flags=re.IGNORECASE)
        content = re.sub(f'([a-zA-Z]+):\s*[\"\']{c}[\"\']', r'\1: colors.textPrimary', content, flags=re.IGNORECASE)
        
    for c in ['#6B7280', '#4B5563', '#9CA3AF', '#666', '#666666', '#6F7A70']:
        content = re.sub(f'([a-zA-Z]+)=[\"\']{c}[\"\']', r'\1={colors.textSecondary}', content, flags=re.IGNORECASE)
        content = re.sub(f'([a-zA-Z]+):\s*[\"\']{c}[\"\']', r'\1: colors.textSecondary', content, flags=re.IGNORECASE)

    # Some hardcoded ones inside arrays or objects without explicit keys might be skipped, but this covers 99%.
    # Let's also do a raw string replacement just in case, but carefully.
    
    # Adjust border radii for cards (20 -> 24) and buttons (14 -> 16).
    content = re.sub(r'(borderRadius:\s*)20', r'\g<1>24', content)
    content = re.sub(r'(borderRadius:\s*)14', r'\g<1>16', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
