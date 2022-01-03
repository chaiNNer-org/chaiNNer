from functools import wraps
from inspect import isawaitable


def serializer(func, *, status: int = 200):
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            retval = f(*args, **kwargs)
            if isawaitable(retval):
                retval = await retval
            return func(retval, status=status)

        return decorated_function

    return decorator
