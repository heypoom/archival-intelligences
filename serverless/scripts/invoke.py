import modal
import time

start_time = time.time()
print("Invoking...")

inference = modal.Cls.from_name("exhibition-pregen-text-to-image", "Inference")

instance = inference()
inference_results = instance.run.remote(
  prompt="A serene landscape with mountains in the background and a calm lake in the foreground, during sunset.",
  program_key="P0"
)

print("Done!")
print(f"Invocation time: {time.time() - start_time} seconds")
