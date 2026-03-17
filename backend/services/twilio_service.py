import os
from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")


def send_twilio_sms(to_number: str, message: str):
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        msg = client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=f"+91{to_number}" if not to_number.startswith("+") else to_number
        )

        print("TWILIO SMS STATUS: sent")
        print("TWILIO SMS SID:", msg.sid)

        return {
            "status_code": 200,
            "provider": "Twilio",
            "sid": msg.sid
        }

    except Exception as e:
        print("TWILIO SMS ERROR:", str(e))
        return {
            "status_code": 500,
            "provider": "Twilio",
            "error": str(e)
        }


def make_twilio_call(to_number: str, message: str = "Emergency blood request. Please respond immediately."):
    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        call = client.calls.create(
            twiml=f"<Response><Say>{message}</Say></Response>",
            from_=TWILIO_PHONE_NUMBER,
            to=f'+91{to_number}' if not to_number.startswith("+") else to_number
        )

        print("TWILIO CALL STATUS: initiated")
        print("TWILIO CALL SID:", call.sid)

        return {
            "status_code": 200,
            "provider": "Twilio",
            "sid": call.sid
        }

    except Exception as e:
        print("TWILIO CALL ERROR:", str(e))
        return {
            "status_code": 500,
            "provider": "Twilio",
            "error": str(e)
        }