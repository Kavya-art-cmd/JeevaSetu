import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")


def make_call(phone_number, message):

    try:
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        call = client.calls.create(
            to=f"+91{phone_number}",
            from_=TWILIO_PHONE_NUMBER,
            twiml=f"<Response><Say>{message}</Say></Response>"
        )

        print("TWILIO CALL SID:", call.sid)

        return {
            "status_code": 200,
            "call_sid": call.sid
        }

    except Exception as e:
        print("TWILIO CALL ERROR:", str(e))
        return {
            "status_code": 500,
            "error": str(e)
        }