import base64
import io
import torch
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from diffusers import StableDiffusionPipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_device():
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    else:
        return "cpu"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model on startup
    device = get_device()
    logger.info(f"Loading model on {device}...")
    
    try:
        model_id = "runwayml/stable-diffusion-v1-5"
        dtype = torch.float16 if device == "cuda" else torch.float32
        
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id, 
            torch_dtype=dtype,
            use_safetensors=True
        )
        pipe = pipe.to(device)
        pipe.enable_attention_slicing()
        
        # Warmup
        # pipe("warmup", num_inference_steps=1)
        
        app.state.model_pipeline = pipe
        logger.info("Model loaded successfully!")
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise e
        
    yield
    
    # Clean up
    logger.info("Shutting down...")
    if hasattr(app.state, "model_pipeline"):
        del app.state.model_pipeline
    
    if device == "mps":
        torch.mps.empty_cache()

app = FastAPI(lifespan=lifespan)

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    prompt: str = Field(..., max_length=1000)
    negative_prompt: str = Field(default="", max_length=1000)
    num_inference_steps: int = Field(default=30, ge=1, le=100)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=20.0)

@app.post("/generate")
def generate_image(request: GenerateRequest, fastapi_req: Request):
    if not hasattr(fastapi_req.app.state, "model_pipeline"):
        raise HTTPException(status_code=503, detail="Model is not loaded yet")
    
    try:
        model_pipeline = fastapi_req.app.state.model_pipeline
        
        # Run inference in inference_mode for performance
        with torch.inference_mode():
            image = model_pipeline(
                request.prompt, 
                negative_prompt=request.negative_prompt,
                num_inference_steps=request.num_inference_steps,
                guidance_scale=request.guidance_scale
            ).images[0]
        
        # Convert to base64
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        
        return {"image": img_str, "status": "success"}
    except Exception as e:
        logger.error(f"Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Mount static directory
app.mount("/", StaticFiles(directory="static", html=True), name="static")
