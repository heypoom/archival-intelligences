# LoRA Retraining Plan for Stable Diffusion 3.5 Large Turbo

## Overview

Create a new LoRA training system for your 23 images using `stabilityai/stable-diffusion-3.5-large-turbo`, building on your existing DreamBooth experience and Modal.com infrastructure.

## Current State Analysis

- **Existing LoRA**: `heypoom/chuamiatee-1` (24 training images)
- **Target Model**: `stabilityai/stable-diffusion-3.5-large-turbo`
- **Infrastructure**: Modal.com with H100 GPUs
- **Integration**: Already integrated in `serverless/pregen/` and `serverless/live/`

## Implementation Complete ✅

### 1. Training Data Infrastructure ✅

- **Location**: `training-data/` directory
- **Structure**:
  - `training-data/images/` - Your 23 training images
  - `training-data/captions/` - Text captions for each image
  - `training-data/config/` - Training configuration files

### 2. Modal.com Training Pipeline ✅

- **Location**: `serverless/training/` directory
- **Components**:
  - `lora_trainer.py` - Main training script using Modal
  - `data_preprocessor.py` - Image preprocessing and validation
  - `README.md` - Complete training documentation

### 3. Training Configuration Setup ✅

- **Method**: DreamBooth + LoRA (PEFT library)
- **Base Model**: `stabilityai/stable-diffusion-3.5-large-turbo`
- **LoRA Config**:
  - Rank: 32, Alpha: 64
  - Target modules: All transformer blocks
- **Training Config**:
  - Steps: 800 (optimized for 23 images)
  - Learning rate: 1e-4
  - Batch size: 1 (H100 memory optimized)

### 4. Workflow Automation ✅

- **Script**: `scripts/train-lora.sh` - Complete workflow automation
- **Features**:
  - Data validation and preprocessing
  - Modal deployment
  - Training execution
  - Optional production deployment

## Usage

### Quick Start

```bash
# 1. Copy your 23 images to training-data/images/
# 2. Run the complete workflow:
./scripts/train-lora.sh --auto-caption --deploy-after
```

### Manual Steps

```bash
# 1. Prepare and validate data
python serverless/training/data_preprocessor.py \
  --images-dir training-data/images \
  --captions-dir training-data/captions \
  --auto-caption

# 2. Deploy and train
modal deploy serverless/training/lora_trainer.py
modal run serverless/training/lora_trainer.py::upload_training_data \
  --local-images-dir ./training-data/images \
  --local-captions-dir ./training-data/captions
modal run serverless/training/lora_trainer.py::LoRATrainer.train

# 3. Update production apps
# Edit LORA_WEIGHTS in serverless/pregen/text_to_image.py:39
# Edit LORA_WEIGHTS in serverless/live/live_text_to_image.py:45
modal deploy serverless/pregen/text_to_image.py
modal deploy serverless/live/live_text_to_image.py
```

## File Structure Created

```
training-data/
├── images/           # Place your 23 training images here
├── captions/         # Text descriptions (auto-generated or manual)
├── config/
│   ├── lora_config.json      # LoRA parameters
│   └── training_config.json  # Training parameters
└── README.md

serverless/training/
├── lora_trainer.py          # Main Modal training app
├── data_preprocessor.py     # Data validation utility
└── README.md               # Complete documentation

scripts/
└── train-lora.sh           # Automated workflow script

docs/plans/
└── lora-retraining-plan.md # This plan file
```

## Key Features

### Robust Training Pipeline

- **Modal.com Integration**: H100 GPU with optimized memory usage
- **DreamBooth + LoRA**: Latest techniques for style transfer training
- **Automatic Uploads**: Direct integration with Hugging Face Hub
- **Progress Monitoring**: Real-time loss tracking and checkpoints

### Data Management

- **Validation Tools**: Automatic image and caption validation
- **Auto-captioning**: Generate default captions with style triggers
- **Preprocessing**: Image resizing and format standardization

### Production Integration

- **Seamless Updates**: Direct compatibility with existing exhibition system
- **Program Support**: Works with P3 (style-only) and P3B (text+style) modes
- **Fallback Safety**: Keeps existing LoRA as backup

## Expected Results

After training, your new LoRA will:

1. **Upload automatically** to `heypoom/chuamiatee-2` on Hugging Face
2. **Generate style-consistent images** with P3 program (empty prompt)
3. **Blend text + style** effectively with P3B program
4. **Maintain quality** comparable to or better than current LoRA

## Next Steps

1. **Copy your 23 images** to `training-data/images/`
2. **Run the training workflow**: `./scripts/train-lora.sh --auto-caption`
3. **Update production** when training completes
4. **Test the new LoRA** with your exhibition system

## Timeline Estimate

- **Setup & Data Prep**: 10 minutes
- **Training Execution**: 30-60 minutes
- **Testing & Deployment**: 15 minutes
- **Total**: ~1-1.5 hours

The complete LoRA retraining infrastructure is now ready for your 23 images!
