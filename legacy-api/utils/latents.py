import torch
import PIL.Image as PILImage

# https://huggingface.co/docs/diffusers/en/using-diffusers/callback#display-image-after-each-generation-step
# https://huggingface.co/blog/TimothyAlexisVass/explaining-the-sdxl-latent-space
WEIGHTS = ((60, -60, 25, -70), (60, -5, 15, -50), (60, 10, -5, -35))


def latents_to_rgb(latents):
    weights_tensor = torch.t(
        torch.tensor(WEIGHTS, dtype=latents.dtype).to(latents.device)
    )
    biases_tensor = torch.tensor((150, 140, 130), dtype=latents.dtype).to(
        latents.device
    )
    weights_s = torch.einsum("...lxy,lr -> ...rxy", latents, weights_tensor)
    biases_s = biases_tensor.unsqueeze(-1).unsqueeze(-1)
    rgb_tensor = weights_s + biases_s
    image_array = rgb_tensor.clamp(0, 255)[0].byte().cpu().numpy()
    image_array = image_array.transpose(1, 2, 0)

    return PILImage.fromarray(image_array)
