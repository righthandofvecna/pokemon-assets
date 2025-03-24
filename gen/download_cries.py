import requests
from bs4 import BeautifulSoup
import os
import re
from urllib.parse import urljoin
import time
import json
import csv
from pathlib import Path
from math import floor

def download_pokemon_cries():
    # URL to scrape
    base_url = "https://play.pokemonshowdown.com/audio/cries/"
    
    # Create directory if it doesn't exist
    output_dir = Path("audio/cries")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # First, download the list of Pokémon with their National Dex numbers from a reliable source
    print("Fetching National Dex data...")
    try:
        if os.path.exists("pokemon_name_to_info.json"):
            with open("pokemon_name_to_info.json", "r") as f:
                name_to_info = json.load(f)
        else:
            # Get pokemon.csv for the base information
            dex_url = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv"
            dex_response = requests.get(dex_url)
            
            if dex_response.status_code != 200:
                print(f"Failed to fetch National Dex data, status code: {dex_response.status_code}")
                return
                
            # Parse the CSV data
            dex_data = dex_response.text.splitlines()
            csv_reader = csv.DictReader(dex_data)
            
            # Two-stage mapping:
            # 1. id_to_dex maps Pokemon IDs to their National Dex numbers
            # 2. name_to_info maps Pokemon names to (dex_number, variant_info)
            id_to_dex = {}
            name_to_info = {}
            
            # First pass: build the id_to_dex mapping for all Pokemon
            for row in csv_reader:
                pokemon_id = int(row['id'])
                species_id = int(row['species_id'])
                name = row['identifier'].lower()
                
                # Store the mapping from ID to National Dex number
                id_to_dex[pokemon_id] = species_id
                
                # Store whether this is a variant (ID > 10000) or base form
                is_variant = pokemon_id > 10000
                
                # For base forms, directly map to the National Dex number
                if not is_variant:
                    name_to_info[name] = (species_id, None)
            
            # Second pass: handle variants with the correct National Dex number
            dex_response = requests.get(dex_url)
            dex_data = dex_response.text.splitlines()
            csv_reader = csv.DictReader(dex_data)
            
            for row in csv_reader:
                pokemon_id = int(row['id'])
                name = row['identifier'].lower()
                
                # If this is a variant (ID > 10000)
                if pokemon_id > 10000:
                    species_id = int(row['species_id'])
                    
                    # Extract variant identifier (e.g., "mega", "alola", "galar")
                    base_name = re.sub(r'-[a-z0-9]+$', '', name)
                    variant_match = re.search(r'-([a-z0-9]+)$', name)
                    variant_suffix = variant_match.group(1) if variant_match else "variant"
                    
                    # Store with the National Dex number and variant info
                    name_to_info[name] = (species_id, variant_suffix)
                    
                    # Also store the base name if not already present
                    if base_name not in name_to_info:
                        name_to_info[base_name] = (species_id, None)
            
            # Save the mapping for future reference
            with open("pokemon_name_to_info.json", "w") as f:
                json.dump(name_to_info, f, indent=2)
            
            print(f"Created mapping for {len(name_to_info)} Pokémon names")
    except Exception as e:
        print(f"Error fetching National Dex data: {e}")
        return
    
    # add non-hyphenated names
    for name in list(name_to_info.keys()):
        if "-" in name:
            name_to_info[name.replace('-', '')] = name_to_info[name]
    
    # Fetch the HTML page with cry file listings
    print(f"Fetching cry file listing from {base_url}...")
    response = requests.get(base_url)
    if response.status_code != 200:
        print(f"Failed to fetch cry file list, status code: {response.status_code}")
        return
        
    soup = BeautifulSoup(response.text, "html.parser")
    
    # Find all links that end with .mp3
    mp3_links = []
    for link in soup.find_all("a"):
        href = link.get("href")
        if href and href.endswith(".mp3"):
            mp3_links.append(href)
    
    print(f"Found {len(mp3_links)} MP3 files")
    
    # Download each MP3 file and rename based on National Dex number
    for i, mp3_link in enumerate(mp3_links):
        file_url = urljoin(base_url, mp3_link)
        pokemon_name = os.path.splitext(mp3_link)[0].lower()
        
        # Try different variations of the name to match our mapping
        dex_info = None
        name_variations = [
            pokemon_name,
            pokemon_name.replace('-', ''),  # Try without hyphens
            re.sub(r'-[a-z0-9]+$', '', pokemon_name)  # Try base form only
        ]
        
        for name_var in name_variations:
            if name_var in name_to_info:
                dex_info = name_to_info[name_var]
                break
        
        if dex_info:
            national_dex, variant_suffix = dex_info

            folder = os.path.join(f"{floor(national_dex/100):02d}XX", f"{floor(national_dex/10):03d}X")
            
            # Create filename based on whether it's a variant or not
            if variant_suffix:
                output_filename = f"{national_dex:04d}-{variant_suffix}.mp3"
            else:
                output_filename = f"{national_dex:04d}.mp3"
            
            Path(os.path.join("audio", "cries", folder)).mkdir(parents=True, exist_ok=True)
            output_filename = os.path.join(folder, output_filename)
        else:
            # If we can't find the National Dex number, keep the original name but log it
            output_filename = mp3_link
            print(f"\033[93mWarning: Could not find National Dex number for {pokemon_name}\033[0m")
        
        output_path = os.path.join("audio", "cries", output_filename)

        # Skip if the file already exists
        if os.path.exists(output_path):
            # print red text
            print(f"\033[91m[{i+1}/{len(mp3_links)}] Skipping {mp3_link} as {output_filename} (already exists)\033[0m")
            continue
        
        # Download the file
        print(f"[{i+1}/{len(mp3_links)}] Downloading {mp3_link} as {output_filename}...")
        try:
            file_response = requests.get(file_url)
            if file_response.status_code == 200:
                with open(output_path, "wb") as f:
                    f.write(file_response.content)
            else:
                print(f"Failed to download {file_url}, status code: {file_response.status_code}")
            
            # Add a small delay to be nice to the server
            time.sleep(0.2)
        except Exception as e:
            print(f"Error downloading {file_url}: {e}")
    
    print(f"Done! Downloaded files saved to {output_dir}")

if __name__ == "__main__":
    download_pokemon_cries()