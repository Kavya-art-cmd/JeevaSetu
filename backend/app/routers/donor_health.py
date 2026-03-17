from datetime import date, datetime, timedelta
from app import models


# -----------------------------
# 🧬 Donor Health Digital Twin
# -----------------------------
def calculate_donor_readiness(donor: models.Donor) -> dict:
    """
    Returns a health twin summary for a donor:
    - readiness_score: 0-100
    - next_eligible_date: date object
    - cooldown_remaining_days: int
    - is_eligible: bool
    - risk_alert: boolean
    - health_insights: string
    """

    today = date.today()

    # Convert cooldown_until safely to date if it exists
    cooldown_date = None
    if donor.cooldown_until:
        if isinstance(donor.cooldown_until, datetime):
            cooldown_date = donor.cooldown_until.date()
        else:
            cooldown_date = donor.cooldown_until

    # Base readiness score
    score = 50

    # Age factor
    if 18 <= donor.age <= 30:
        score += 20
    elif donor.age > 60:
        score -= 20

    # Weight factor
    if donor.weight_kg >= 55:
        score += 10
    else:
        score -= 10

    # Chronic disease penalty
    if donor.has_chronic_disease:
        score -= 30

    # Cooldown penalty
    if cooldown_date and cooldown_date > today:
        score -= 20

    # Clamp score between 0-100
    score = max(0, min(100, score))

    # Next eligible date
    if cooldown_date and cooldown_date > today:
        next_eligible_date = cooldown_date
        cooldown_remaining_days = (cooldown_date - today).days
    else:
        next_eligible_date = today
        cooldown_remaining_days = 0

    # Eligibility logic
    is_eligible = (
        not donor.has_chronic_disease
        and score >= 70
        and cooldown_remaining_days == 0
        and donor.is_active
        and not donor.is_locked
    )

    # Risk alert
    risk_alert = donor.has_chronic_disease or score < 40

    # Health insights
    insights = []

    if donor.has_chronic_disease:
        insights.append("Chronic disease detected")
    if donor.weight_kg < 55:
        insights.append("Weight below preferred donation range")
    if cooldown_remaining_days > 0:
        insights.append(f"In cooldown period for {cooldown_remaining_days} more days")
    if score >= 90:
        insights.append("Excellent donor condition")
    elif score >= 80:
        insights.append("Good donor condition")
    elif score >= 70:
        insights.append("Moderate donor condition")
    else:
        insights.append("Not recommended for donation currently")

    health_insights = ", ".join(insights) if insights else "No health insights available."

    return {
        "readiness_score": score,
        "next_eligible_date": next_eligible_date,
        "cooldown_remaining_days": cooldown_remaining_days,
        "is_eligible": is_eligible,
        "risk_alert": risk_alert,
        "health_insights": health_insights,
    }