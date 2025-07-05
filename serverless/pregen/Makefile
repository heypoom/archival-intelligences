# Modal Pregeneration Endpoints

.PHONY: help deploy serve-text serve-malaya test-text test-malaya

help:
	@echo "Available commands:"
	@echo "  make deploy      - Deploy both endpoints to Modal"
	@echo "  make serve-text  - Serve text-to-image endpoint locally"
	@echo "  make serve-malaya - Serve malaya endpoint locally" 
	@echo "  make test-text   - Test text-to-image endpoint"
	@echo "  make test-malaya - Test malaya endpoint"

# Deploy endpoints to Modal
deploy:
	modal deploy text_to_image.py
	modal deploy malaya.py

# Serve endpoints locally for development
serve-text:
	modal run text_to_image.py

serve-malaya:
	modal run malaya.py

# Test endpoints (requires them to be running)
test-text:
	@echo "Testing text-to-image endpoint..."
	@echo "Make sure the endpoint is running first with 'make serve-text'"
	curl -X POST http://localhost:8000/generate \
		-H "Content-Type: application/json" \
		-d '{"program_key": "P4", "prompt": "big tech ceo", "seed": 12345}' \
		--output test_p4.png
	@echo "Image saved as test_p4.png"

test-malaya:
	@echo "Testing malaya endpoint..."
	@echo "Make sure the endpoint is running first with 'make serve-malaya'"
	curl -X POST http://localhost:8000/generate \
		-H "Content-Type: application/json" \
		-d '{"program_key": "P2", "prompt": "painting like an epic poem of malaya", "seed": 12345}' \
		--output test_p2.png
	@echo "Image saved as test_p2.png"