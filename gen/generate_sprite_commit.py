#!/usr/bin/env python3
"""
Generate git commit message for edited Pokémon sprites.
Analyzes staged sprite files and creates a formatted commit message with Pokémon names.
"""

import json
import re
import subprocess
from pathlib import Path
from collections import defaultdict

# Path to the pokemon name mapping file
POKEMON_INFO_FILE = Path(__file__).parent.parent / "pokemon_name_to_info.json"

def load_pokemon_names():
    """Load the pokemon name to dex number mapping and reverse it."""
    with open(POKEMON_INFO_FILE, 'r') as f:
        name_to_info = json.load(f)
    
    # Create reverse mapping: dex_number -> name
    dex_to_name = {}
    for name, info in name_to_info.items():
        dex_number = info[0]
        dex_to_name[dex_number] = name.capitalize()
    
    return dex_to_name

def get_staged_sprite_files():
    """Get list of staged sprite files from git."""
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only'],
            capture_output=True,
            text=True,
            check=True
        )
        files = result.stdout.strip().split('\n')
        return [f for f in files if f]
    except subprocess.CalledProcessError:
        print("Error: Failed to get git staged files")
        return []

def parse_sprite_filename(filename):
    """
    Parse sprite filename to extract pokemon info.
    Format: pokedex_number[suffix].png
    Suffixes: s (shiny), f (female), m (male), _MEGA, _GMAX, etc.
    
    Returns: dict with 'dex_number', 'suffixes' list, or None if not a sprite
    """
    # Only process files in img/pmd-overworld directories
    if 'img/pmd-overworld/' not in filename:
        return None
    
    basename = Path(filename).name
    
    # Match pattern: number[suffixes].png
    match = re.match(r'^(\d+)([a-z_A-Z]*)?\.png$', basename)
    if not match:
        return None
    
    dex_number = int(match.group(1))
    suffix_str = match.group(2) or ''
    
    # Parse suffixes
    suffixes = []
    if 's' in suffix_str:
        suffixes.append('shiny')
    if 'f' in suffix_str:
        suffixes.append('female')
    if 'm' in suffix_str and '_MEGA' not in suffix_str:
        suffixes.append('male')
    if '_MEGA' in suffix_str:
        suffixes.append('Mega')
    if '_GMAX' in suffix_str:
        suffixes.append('Gigantamax')
    if '_ALOLA' in suffix_str:
        suffixes.append('Alolan')
    if '_GALAR' in suffix_str:
        suffixes.append('Galarian')
    if '_HISUI' in suffix_str:
        suffixes.append('Hisuian')
    if '_PALDEA' in suffix_str:
        suffixes.append('Paldean')
    
    return {
        'dex_number': dex_number,
        'suffixes': suffixes,
        'original_name': basename
    }

def generate_commit_message(staged_files):
    """Generate commit message from staged sprite files."""
    dex_to_name = load_pokemon_names()
    
    # Parse all sprite files - track each variant separately
    pokemon_variants = defaultdict(list)
    unknown_files = []
    
    for filepath in staged_files:
        parsed = parse_sprite_filename(filepath)
        if parsed:
            dex_num = parsed['dex_number']
            if dex_num in dex_to_name:
                # Store each variant combination
                pokemon_variants[dex_num].append(parsed['suffixes'])
            else:
                unknown_files.append(filepath)
        elif 'img/pmd-overworld/' in filepath:
            # Track sprite files we couldn't parse
            unknown_files.append(filepath)
    
    if not pokemon_variants and not unknown_files:
        return "No sprite files staged for commit"
    
    # Build commit message in single-line format
    pokemon_entries = []
    
    # Sort by dex number and format
    for dex_num in sorted(pokemon_variants.keys()):
        name = dex_to_name[dex_num]
        all_suffixes = pokemon_variants[dex_num]
        
        # Determine unique variant combinations
        variant_names = []
        
        # Collect all modifiers (non-shiny attributes)
        modifiers_with_shiny = {}
        modifiers_without_shiny = {}
        
        for suffix_list in all_suffixes:
            non_shiny = [s for s in suffix_list if s != 'shiny']
            has_shiny = 'shiny' in suffix_list
            modifier_key = tuple(sorted(non_shiny))
            
            if has_shiny:
                modifiers_with_shiny[modifier_key] = True
            else:
                modifiers_without_shiny[modifier_key] = True
        
        # Build variant list
        all_modifier_keys = set(list(modifiers_with_shiny.keys()) + list(modifiers_without_shiny.keys()))
        
        for mod_key in sorted(all_modifier_keys):
            has_normal = mod_key in modifiers_without_shiny
            has_shiny = mod_key in modifiers_with_shiny
            
            if mod_key == ():
                # Base form
                if has_normal:
                    variant_names.append("Normal")
                if has_shiny:
                    variant_names.append("Shiny")
            else:
                # Forms with modifiers
                mod_str = ' '.join(mod_key)
                if has_normal:
                    variant_names.append(mod_str)
                if has_shiny:
                    variant_names.append(f"Shiny {mod_str}")
        
        if variant_names:
            entry = f"{name} ({', '.join(variant_names)})"
        else:
            entry = f"{name}"
        
        pokemon_entries.append(entry)
    
    # Single line format
    message = "PMD Sprites: " + ", ".join(pokemon_entries)
    
    return message

def main():
    """Main function."""
    staged_files = get_staged_sprite_files()
    
    if not staged_files:
        print("No files staged for commit")
        return
    
    message = generate_commit_message(staged_files)
    print(message)
    print()
    print("=" * 60)
    print("To use this message, run:")
    print(f'  git commit -m "{message}"')

if __name__ == '__main__':
    main()
