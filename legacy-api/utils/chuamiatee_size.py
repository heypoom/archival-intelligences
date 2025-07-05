import random
from typing import List

CHUAMIATEE_SIZES: List[tuple[int, int]] = [
    (960, 800),
    (800, 960),
    (960, 960),
    (960, 640),
]


def get_chuamiatee_size() -> tuple[int, int]:
    size = random.choice(CHUAMIATEE_SIZES)
    return size
