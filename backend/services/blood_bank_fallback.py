# app/services/blood_bank_fallback.py

def get_nearby_blood_banks(city: str, state: str, blood_group: str):
    """
    STEP-7: Blood Bank Fallback Logic
    NOTE: This is MOCK data for Phase-1
    """

    BLOOD_BANKS = [
        {
            "name": "Apollo Blood Bank",
            "city": "Hyderabad",
            "state": "Telangana",
            "available_groups": ["O+", "A+", "B+", "AB+"],
            "contact": "040-11111111"
        },
        {
            "name": "Red Cross Blood Bank",
            "city": "Hyderabad",
            "state": "Telangana",
            "available_groups": ["O+", "O-", "A+", "A-", "B+", "B-", "AB+"],
            "contact": "040-22222222"
        },
        {
            "name": "State General Blood Bank",
            "city": "Warangal",
            "state": "Telangana",
            "available_groups": ["O+", "A+", "B+"],
            "contact": "0870-333333"
        }
    ]

    nearby_banks = []

    for bank in BLOOD_BANKS:
        if (
            bank["state"].lower() == state.lower()
            and blood_group in bank["available_groups"]
        ):
            nearby_banks.append(bank)

    return nearby_banks
