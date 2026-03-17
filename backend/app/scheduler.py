from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
from app.database import SessionLocal
from app import models
from services.twilio_call_service import make_call


def check_no_response_job():
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        pending_allocations = db.query(models.EmergencyAllocation).filter(
            models.EmergencyAllocation.response_status == "PENDING",
            models.EmergencyAllocation.status == "ALLOCATED"
        ).all()

        for allocation in pending_allocations:
            minutes_passed = (now - allocation.allocated_at).total_seconds() / 60

            if minutes_passed >= 2:
                donor = db.query(models.Donor).filter(
                    models.Donor.id == allocation.donor_id
                ).first()

                if donor:
                    alert_message = f"""
Hello. This is JeevaSetu emergency blood network.

A patient in {allocation.patient_city} urgently requires blood group {allocation.blood_group}.

If you are available to donate please contact the nearest hospital or respond on the JeevaSetu website within the next 15 to 20 minutes.

Thank you for supporting life saving blood donation.
"""

                    make_call(donor.phone_number, alert_message)
                    allocation.response_status = "NO_RESPONSE"

        db.commit()

    except Exception as e:
        print("Scheduler error:", e)

    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(check_no_response_job, "interval", minutes=2)