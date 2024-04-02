from typing import Union
from fastapi import FastAPI

import diffusion

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/generate")
def read_generate(q: Union[str, None] = None):
    image = diffusion.stable_diffusion_image(q)
    print(image)
    return {"q": q, "image": image}
