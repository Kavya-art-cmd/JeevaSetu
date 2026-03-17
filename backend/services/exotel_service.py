import os
import requests
from dotenv import load_dotenv

from services.twilio_service import send_twilio_sms, make_twilio_call

load_dotenv()

EXOTEL_API_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_API_TOKEN = os.getenv("EXOTEL_API_TOKEN")
EXOTEL_ACCOUNT_SID = os.getenv("EXOTEL_ACCOUNT_SID")
EXOTEL_SUBDOMAIN = os.getenv("EXOTEL_SUBDOMAIN")


def send_sms(to_number: str, message: str):
    url = f"https://{EXOTEL_API_KEY}:{EXOTEL_API_TOKEN}@{EXOTEL_SUBDOMAIN}/v1/Accounts/{EXOTEL_ACCOUNT_SID}/Sms/send"

    payload = {
        "From": "JeevaSetu",
        "To": to_number,
        "Body": message
    }

    try:
        response = requests.post(url, data=payload)

        print("EXOTEL SMS STATUS:", response.status_code)
        print("EXOTEL SMS RESPONSE:", response.text)

        if response.status_code == 200:
            sms_sid = None
            if "<Sid>" in response.text and "</Sid>" in response.text:
                sms_sid = response.text.split("<Sid>")[1].split("</Sid>")[0]

            return {
                "status_code": 200,
                "provider": "Exotel",
                "response": response.text,
                "sms_sid": sms_sid
            }

        # Fallback to Twilio SMS
        print("Exotel SMS failed. Falling back to Twilio SMS...")
        twilio_sms_result = send_twilio_sms(to_number, message)

        # If Twilio SMS also fails, trigger Twilio call immediately
        if twilio_sms_result.get("status_code") != 200:
            print("Twilio SMS also failed. Triggering Twilio call...")
            twilio_call_result = make_twilio_call(to_number, message)
            return {
                "status_code": twilio_call_result.get("status_code", 500),
                "provider": "Twilio Call Fallback",
                "sms_fallback": twilio_sms_result,
                "call_fallback": twilio_call_result
            }

        return {
            "status_code": 200,
            "provider": "Twilio SMS Fallback",
            "response": twilio_sms_result
        }

    except Exception as e:
        print("EXOTEL SMS ERROR:", str(e))
        print("Falling back to Twilio SMS due to exception...")

        twilio_sms_result = send_twilio_sms(to_number, message)

        if twilio_sms_result.get("status_code") != 200:
            print("Twilio SMS also failed. Triggering Twilio call...")
            twilio_call_result = make_twilio_call(to_number, message)
            return {
                "status_code": twilio_call_result.get("status_code", 500),
                "provider": "Twilio Call Fallback",
                "sms_fallback": twilio_sms_result,
                "call_fallback": twilio_call_result
            }

        return {
            "status_code": 200,
            "provider": "Twilio SMS Fallback",
            "response": twilio_sms_result
        }


def make_call(to_number: str):
    try:
        return make_twilio_call(to_number)
    except Exception as e:
        print("CALL ERROR:", str(e))
        return {
            "status_code": 500,
            "error": str(e)
        }


def check_sms_status(sms_sid: str):
    url = f"https://{EXOTEL_API_KEY}:{EXOTEL_API_TOKEN}@{EXOTEL_SUBDOMAIN}/v1/Accounts/{EXOTEL_ACCOUNT_SID}/SMS/Messages/{sms_sid}"

    try:
        response = requests.get(url)

        print("EXOTEL STATUS CHECK:", response.status_code)
        print("EXOTEL STATUS RESPONSE:", response.text)

        return {
            "status_code": response.status_code,
            "response": response.text
        }

    except Exception as e:
        print("SMS STATUS CHECK ERROR:", str(e))
        return {
            "status_code": 500,
            "error": str(e)
        }


def extract_sms_status(xml_text: str):
    try:
        status = None
        detailed_status = None

        if "<Status>" in xml_text and "</Status>" in xml_text:
            status = xml_text.split("<Status>")[1].split("</Status>")[0]

        if "<DetailedStatus>" in xml_text and "</DetailedStatus>" in xml_text:
            detailed_status = xml_text.split("<DetailedStatus>")[1].split("</DetailedStatus>")[0]

        return {
            "status": status,
            "detailed_status": detailed_status
        }

    except Exception as e:
        return {
            "status": None,
            "detailed_status": f"parse_error: {str(e)}"
        }