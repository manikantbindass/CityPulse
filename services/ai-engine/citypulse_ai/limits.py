"""Bound JSON bodies before Pydantic allocates nested request structures."""

from starlette.responses import JSONResponse


class BodyLimitMiddleware:
    def __init__(self, app, maximum=1_100_000):
        self.app = app
        self.maximum = maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") not in {"POST", "PUT", "PATCH"}:
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > self.maximum:
                response = JSONResponse(
                    status_code=413,
                    media_type="application/problem+json",
                    content={
                        "type": "urn:citypulse:problem:payload-too-large",
                        "title": "Payload too large",
                        "status": 413,
                        "code": "PAYLOAD_TOO_LARGE",
                    },
                )
                return await response(scope, receive, send)
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, bounded_receive, send)
