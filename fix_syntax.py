import os

files = [
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\HomeScreen.js',
    r'c:\Users\hanzc\Documents\Get-Trash\Resident\src\screens\ProfileScreen.js'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix broken colors formatting
    content = content.replace('color=\"{colors.textPrimary}', 'color={colors.textPrimary}')
    content = content.replace('color=\"{colors.textSecondary}', 'color={colors.textSecondary}')
    content = content.replace('color=\"{colors.surface}', 'color={colors.surface}')
    content = content.replace('color=\"{colors.primaryGreen}', 'color={colors.primaryGreen}')
    
    content = content.replace('color=colors.textPrimary', 'color={colors.textPrimary}')
    content = content.replace('color=colors.textSecondary', 'color={colors.textSecondary}')
    content = content.replace('color=colors.surface', 'color={colors.surface}')
    content = content.replace('color=colors.primaryGreen', 'color={colors.primaryGreen}')

    # Since previous step might have doubled {} if it matched again:
    content = content.replace('{{colors.', '{colors.')
    content = content.replace('}}', '}')

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
