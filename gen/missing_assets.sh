#!/bin/bash

numbers=($(find audio/cries -type f -name '*' | grep -o "[0-9][0-9][0-9][0-9]" | sort -n | uniq))
missing_numbers=()
for ((i=0; i<${#numbers[@]}-1; i++)); do 
  current=$((10#${numbers[$i]}))
  next=$((10#${numbers[$i+1]}))
  if (( next - current != 1 )); then 
    for ((j=current+1; j<next; j++)); do 
      missing_numbers+=($j)
    done
  fi
done
echo "Missing Pokemon (audio) ${missing_numbers[@]}"

numbers=($(find img/pmd-overworld -type f -name '*' | grep -o "[0-9][0-9][0-9][0-9]" | sort -n | uniq))
missing_numbers=()
for ((i=0; i<${#numbers[@]}-1; i++)); do 
  current=$((10#${numbers[$i]}))
  next=$((10#${numbers[$i+1]}))
  if (( next - current != 1 )); then 
    for ((j=current+1; j<next; j++)); do 
      missing_numbers+=($j)
    done
  fi
done
echo "Missing Pokemon (PMD png) ${missing_numbers[@]}"