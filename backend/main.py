from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 🔹 Database imports
from app.database import engine
from app.models import Base

# 🔹 Routers
from app.routers import health
from app.routers import donor
from app.routers import emergency
from app.routers import emergency_broadcast
from app.routers import emergency_response
from app.routers import dashboard
from app.routers import allocation_history
from app.routers import forecast
from app.routers import auth
from app.routers import voice
from app.routers import analytics

from app.scheduler import scheduler


app = FastAPI(
    title="JeevaSetu API",
    description="Predictive And Preventive Voice Enabled Emergency Blood Management System",
    version="1.0.0"
)

# 🔹 CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://jeevasetu-frontend.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Start scheduler
scheduler.start()

# 🔹 Create database tables automatically
Base.metadata.create_all(bind=engine)

# 🔹 Include routers
app.include_router(health.router)
app.include_router(donor.router)
app.include_router(emergency.router)
app.include_router(emergency_broadcast.router)
app.include_router(emergency_response.router)
app.include_router(dashboard.router)
app.include_router(allocation_history.router)
app.include_router(forecast.router)
app.include_router(auth.router)
app.include_router(voice.router)
app.include_router(analytics.router)