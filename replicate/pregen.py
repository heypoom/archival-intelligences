from time import time
import replicate

input = {
    "prompt": "An impasto unicorn",
    "aspect_ratio": "3:2",
    "output_format": "png",
}

start_time = time()

print("Generating images...")

output = replicate.run(
  "stability-ai/stable-diffusion-3.5-large-turbo",
  input=input,
)

for index, item in enumerate(output):
    with open(f"output/{index}.png", "wb") as file:
        file.write(item.read())

print(f"Time taken: {time() - start_time:.2f} seconds")