import os
import requests
from dotenv import load_dotenv

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")


def get_dynamic_eta_minutes(origin: str, destination: str):
    url = "https://maps.googleapis.com/maps/api/distancematrix/json"

    params = {
        "origins": origin,
        "destinations": destination,
        "key": GOOGLE_MAPS_API_KEY,
        "units": "metric"
    }

    response = requests.get(url, params=params)
    data = response.json()
    print("GOOGLE MAPS RESPONSE:", data)

    try:
        element = data["rows"][0]["elements"][0]

        if element["status"] != "OK":
            return None

        duration_seconds = element["duration"]["value"]
        duration_minutes = round(duration_seconds / 60)

        return duration_minutes

    except Exception:
        return None