# Bundled Wheels

This is where we can store wheel files that are to be bundled with chaiNNer, in order to avoid needing to download them.

## Requirements

Bundled wheels must be

1. Reasonably small (a few MB max)
2. py3-none-any (compatible with any python version and device)
3. License compatible (allows bundling)

## Goals

- Speed up initial start time by downloading the minimal number of wheel files from the internet
- Not increase chaiNNer's bundle size too much

## Structure

The `whls` folder shall contain individual folders, named according to the package name we use to install via pip. Inside the folder must be the .whl file as well as the project's license.
