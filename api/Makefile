dev:
	env TORCH_DEVICE=cuda poetry run uvicorn server:app --host 0.0.0.0 --port 8000 

caddy:
	AmbientCapabilities=CAP_NET_BIND_SERVICE caddy run
