from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Non-DRF exceptions
        return Response({"error": {"code": "server_error", "message": str(exc)}},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    # DRF error dict -> wrap
    message = response.data
    if isinstance(message, dict) and "detail" in message and len(message) == 1:
        message = message["detail"]
    return Response({"error": {"code": response.status_code, "message": message}},
                    status=response.status_code)
