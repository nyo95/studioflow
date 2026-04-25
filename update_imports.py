import os

replacements = {
    '@/lib/db': '@/core/platform/db',
    '@/lib/services/audit': '@/core/platform/audit',
    '@/lib/services/system': '@/core/platform/system',
    '@/lib/rbac': '@/core/rbac/rbac',
    '@/lib/permissions': '@/core/rbac/permissions',
    '@/lib/domain/project-naming': '@/core/domain-shared/project-naming',
    '@/lib/services/schedule-service': '@/extensions/schedule/services/schedule-service',
    '@/actions/schedule-actions': '@/extensions/schedule/actions/schedule-actions'
}

def replace_in_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    for old, new in replacements.items():
        # Handle exact match and sub-paths
        content = content.replace(f'"{old}"', f'"{new}"')
        content = content.replace(f"'{old}'", f"'{new}'")
        content = content.replace(f'"{old}/', f'"{new}/')
        content = content.replace(f"'{old}/", f"'{new}/")
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")

def walk_and_replace(root_dir):
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                replace_in_file(os.path.join(root, file))

if __name__ == "__main__":
    walk_and_replace('src')
