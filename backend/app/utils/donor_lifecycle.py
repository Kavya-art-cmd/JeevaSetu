from datetime import datetime

DONATION_GAP_DAYS = 90


def update_donor_status(donor):
    """
    Automatically updates donor eligibility based on last donation date.
    Uses is_active boolean instead of non-existing status field.
    """

    today = datetime.utcnow().date()

    # If donor never donated before → eligible
    if donor.last_donation_date is None:
        donor.is_active = True
        return donor

    # Calculate days since last donation
    days_since_last_donation = (
        today - donor.last_donation_date
    ).days

    # Apply 90-day rule
    if days_since_last_donation >= DONATION_GAP_DAYS:
        donor.is_active = True
    else:
        donor.is_active = False

    return donor