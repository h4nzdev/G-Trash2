import re
import os

files = [
    r'C:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\MapScreen.js',
    r'C:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\ReportIssueScreen.js'
]

def replace_colors(content):
    # Add import if not present
    if 'import colors' not in content:
        # Find last import
        imports = list(re.finditer(r'^import .*?$', content, re.MULTILINE))
        if imports:
            imports_end = imports[-1].end()
            content = content[:imports_end] + "\nimport colors, { softShadow } from '../constants/colors';" + content[imports_end:]
    
    # Shadow replacements
    # There are multiple shadow formats
    shadow_regex = r'\s*shadowColor:\s*["\'][^"\']+["\'],\s*shadowOpacity:\s*[0-9.]+,\s*shadowRadius:\s*[0-9.]+,\s*elevation:\s*[0-9]+,?'
    content = re.sub(shadow_regex, r'\n    ...softShadow,', content)
    shadow_regex2 = r'\s*shadowColor:\s*["\'][^"\']+["\'],\s*shadowOffset:\s*\{[^}]+\},\s*shadowOpacity:\s*[0-9.]+,\s*shadowRadius:\s*[0-9.]+,\s*elevation:\s*[0-9]+,?'
    content = re.sub(shadow_regex2, r'\n    ...softShadow,', content)
    
    # Text Colors
    content = re.sub(r'["\']#(1B1C1C|000000|1F2937)["\']', 'colors.textPrimary', content)
    content = re.sub(r'["\']#(6B7280|4B5563|9CA3AF)["\']', 'colors.textSecondary', content)
    
    # Background Colors
    content = re.sub(r'backgroundColor:\s*["\']#(FBF9F8|F3F4F6|E5E7EB|F8FAFC)["\']', r'backgroundColor: colors.background', content)
    content = re.sub(r'backgroundColor:\s*["\']#FFFFFF["\']', r'backgroundColor: colors.surface', content)
    
    # Other Colors
    content = re.sub(r'borderColor:\s*["\']#(F0F0F0|E5E7EB|F3F4F6)["\']', r'borderColor: colors.border', content)
    content = re.sub(r'["\']#(006A3B|2E8B57)["\']', 'colors.primaryGreen', content)
    
    # Inline Colors (components)
    content = re.sub(r'color="colors\.', r'color={colors.', content)
    content = re.sub(r'colors\.([a-zA-Z]+)"', r'colors.\1}', content)
    
    # Some string literal fixes
    content = content.replace("'{colors.primaryGreen}'", "colors.primaryGreen")
    content = content.replace("'{colors.textPrimary}'", "colors.textPrimary")
    content = content.replace("'{colors.textSecondary}'", "colors.textSecondary")
    content = content.replace("'{colors.surface}'", "colors.surface")
    
    # For conditional styling array fixes: color: mapStyle !== "voyager" ? colors.primaryGreen : colors.textPrimary
    content = re.sub(r'color=\{(colors\.[a-zA-Z]+)\}', r'color={\1}', content)
    
    # Ensure large border radii (24 for cards/bottom sheets)
    content = re.sub(r'borderRadius:\s*12,', r'borderRadius: 16,', content)
    content = re.sub(r'borderRadius:\s*20,', r'borderRadius: 24,', content)
    content = re.sub(r'borderTopLeftRadius:\s*32,', r'borderTopLeftRadius: 24,', content)
    content = re.sub(r'borderTopRightRadius:\s*32,', r'borderTopRightRadius: 24,', content)

    return content

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = replace_colors(content)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Processed {file}')
