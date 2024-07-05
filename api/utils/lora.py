from utils.pipelines import text2img

global lora_state

lora_applied = False


def load_chuamiatee_lora():
    if lora_applied:
        return

    text2img.load_lora_weights(
        "heypoom/chuamiatee-1", weight_name="pytorch_lora_weights.safetensors"
    )

    lora_applied = True


def unload_chuamiatee_lora():
    if not lora_applied:
        return

    text2img.unload_lora_weights()
    lora_applied = False


def init_chuamiatee(is_chuamiatee: bool):
    if is_chuamiatee:
        load_chuamiatee_lora()
    else:
        unload_chuamiatee_lora()
