from typing import Dict, List


def FileOutput(type: str, label: str, filetypes: List[str]) -> Dict:
    """ Output for saving a local file """
    return {
        'type': f'file::{type}',
        'label': label,
        'filetypes': filetypes,
    }


def ImageFileOutput() -> Dict:
    """ Output for saving a local image file """
    return FileOutput('image', 'Image File',
                      ['png', 'jpg', 'jpeg', 'gif', 'tiff', 'webp'])
