import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, HTTPException

class InMemoryRateLimiter:
    """
    Lightweight in-memory sliding-window rate limiter.
    Protects compute-intensive endpoints (AI Copilot, Simulation) from abuse and token depletion.
    """
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.history: Dict[str, List[float]] = defaultdict(list)

    def check(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        window_start = now - 60.0

        timestamps = [t for t in self.history[client_ip] if t > window_start]
        if len(timestamps) >= self.rpm:
            retry_after = max(1, int(60.0 - (now - timestamps[0])))
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {self.rpm} requests per minute allowed. Please retry in {retry_after}s."
            )

        timestamps.append(now)
        self.history[client_ip] = timestamps

copilot_limiter = InMemoryRateLimiter(requests_per_minute=60)
simulation_limiter = InMemoryRateLimiter(requests_per_minute=120)
