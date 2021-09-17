from typing import Dict, List


def FileInput(type: str, label: str, accepts: List[str],
              filetypes: List[str]) -> Dict:
    """ Input for submitting a local file """
    return {
        'type': f'file::{type}',
        'label': label,
        'accepts': None,
        'filetypes': filetypes
    }


def ImageFileInput() -> Dict:
    """ Input for submitting a local image file """
    return FileInput('image', 'Image File', None,
                     ['png', 'jpg', 'jpeg', 'gif', 'tiff', 'webp'])


def PthFileInput() -> Dict:
    """ Input for submitting a local .pth file """
    return FileInput('pth', 'Pretrained Model', None, ['pth'])
