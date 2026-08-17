import re
import os

files = [
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\CommunityFeedScreen.js',
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\ScannerScreen.js'
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

    # Add softShadow import if only 'import colors from "../constants/colors"' is there
    if 'import colors from "../constants/colors"' in content or "import colors from '../constants/colors'" in content:
        content = content.replace('import colors from "../constants/colors"', "import colors, { softShadow } from '../constants/colors'")
        content = content.replace("import colors from '../constants/colors'", "import colors, { softShadow } from '../constants/colors'")

    # Replace shadows
    content = re.sub(r'\s*shadowColor:[^\n]*\n\s*shadowOffset:[^\n]*\n\s*shadowOpacity:[^\n]*\n\s*shadowRadius:[^\n]*\n\s*elevation:[^\n]*,?', r'\n    ...softShadow,', content)
    content = re.sub(r'\s*elevation:[^\n]*\n\s*shadowColor:[^\n]*\n\s*shadowOffset:[^\n]*\n\s*shadowOpacity:[^\n]*\n\s*shadowRadius:[^\n]*,?', r'\n    ...softShadow,', content)

    # Replacements for colors in styles
    content = re.sub(r'(?<=backgroundColor: )\"#FBF9F8\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\"#F3F4F6\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\"#E5E7EB\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\"#F8FAFC\"', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\'#FBF9F8\'', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\'#F3F4F6\'', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\'#E5E7EB\'', 'colors.background', content)
    content = re.sub(r'(?<=backgroundColor: )\'#F8FAFC\'', 'colors.background', content)

    content = re.sub(r'(?<=backgroundColor: )\"#FFFFFF\"', 'colors.surface', content)
    content = re.sub(r'(?<=backgroundColor: )\'#FFFFFF\'', 'colors.surface', content)
    
    content = re.sub(r'(?<=color: )\"#1B1C1C\"', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\"#000000\"', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\"#1F2937\"', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\'#1B1C1C\'', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\'#000000\'', 'colors.textPrimary', content)
    content = re.sub(r'(?<=color: )\'#1F2937\'', 'colors.textPrimary', content)

    content = re.sub(r'(?<=color: )\"#6B7280\"', 'colors.textSecondary', content)
    content = re.sub(r'(?<=color: )\"#4B5563\"', 'colors.textSecondary', content)
    content = re.sub(r'(?<=color: )\"#9CA3AF\"', 'colors.textMuted', content)
    content = re.sub(r'(?<=color: )\'#6B7280\'', 'colors.textSecondary', content)
    content = re.sub(r'(?<=color: )\'#4B5563\'', 'colors.textSecondary', content)
    content = re.sub(r'(?<=color: )\'#9CA3AF\'', 'colors.textMuted', content)
    
    # Primary colors globally
    content = re.sub(r'\"#006A3B\"', 'colors.primaryGreen', content)
    content = re.sub(r'\"#2E8B57\"', 'colors.primaryGreen', content)
    content = re.sub(r'\'#006A3B\'', 'colors.primaryGreen', content)
    content = re.sub(r'\'#2E8B57\'', 'colors.primaryGreen', content)
    
    # JSX color props
    content = re.sub(r'(?<=color=\")#1B1C1C\"', '{colors.textPrimary}', content)
    content = re.sub(r'(?<=color=\")#000000\"', '{colors.textPrimary}', content)
    content = re.sub(r'(?<=color=\")#1F2937\"', '{colors.textPrimary}', content)
    
    content = re.sub(r'(?<=color=\")#6B7280\"', '{colors.textSecondary}', content)
    content = re.sub(r'(?<=color=\")#4B5563\"', '{colors.textSecondary}', content)
    content = re.sub(r'(?<=color=\")#9CA3AF\"', '{colors.textMuted}', content)
    
    content = re.sub(r'(?<=color=\")#FFFFFF\"', '{colors.surface}', content)
    content = re.sub(r'(?<=color=\")#006A3B\"', '{colors.primaryGreen}', content)
    content = re.sub(r'(?<=color=\")#2E8B57\"', '{colors.primaryGreen}', content)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {file}')
