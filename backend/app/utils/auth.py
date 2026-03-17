from datetime import datetime, timedelta
from typing import Optional, Iterable, Callable, Set, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app import models


# ----------------------------
# CONFIG
# ----------------------------
SECRET_KEY = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ----------------------------
# PASSWORD UTILS
# ----------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ----------------------------
# JWT UTILS
# ----------------------------
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ----------------------------
# ROLE NORMALIZATION
# ----------------------------
def _user_role(user: models.User) -> str:
    # If legacy is_admin is True, treat as ADMIN
    if getattr(user, "is_admin", False):
        return "ADMIN"
    return (getattr(user, "role", None) or "DONOR").strip().upper()


# ----------------------------
# CURRENT USER DEPENDENCY
# ----------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        email = payload.get("email")

        if user_id is None and email is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # Prefer user_id
    q = db.query(models.User)
    user = None
    if user_id is not None:
        user = q.filter(models.User.id == int(user_id)).first()
    if user is None and email is not None:
        user = q.filter(models.User.email == str(email)).first()

    if not user:
        raise credentials_exception

    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="User is inactive")

    return user


# ----------------------------
# RBAC DEPENDENCY
# ----------------------------
def require_roles(*roles: Any) -> Callable:
    """
    Supports BOTH:
      require_roles("ADMIN", "HOSPITAL")
      require_roles(["ADMIN", "HOSPITAL"])
    """

    allowed: Set[str] = set()

    # flatten roles
    for r in roles:
        if r is None:
            continue
        if isinstance(r, (list, tuple, set)):
            for x in r:
                if x:
                    allowed.add(str(x).strip().upper())
        else:
            allowed.add(str(r).strip().upper())

    if not allowed:
        raise RuntimeError("require_roles() called with no roles")

    def _dependency(current_user: models.User = Depends(get_current_user)) -> models.User:
        role = _user_role(current_user)
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Access denied: insufficient permissions")
        return current_user

    return _dependency