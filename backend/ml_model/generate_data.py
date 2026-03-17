import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

np.random.seed(42)

# Generate 365 days of data
dates = pd.date_range(start="2025-01-01", periods=365)

base_demand = 12
weekly_pattern = [0, 1, -1, 2, -2, 3, -3]

demand = []

for i in range(len(dates)):
    value = base_demand

    # Weekly seasonality
    value += weekly_pattern[i % 7]

    # Random noise
    value += np.random.randint(-2, 3)

    # Seasonal spike (July)
    if dates[i].month == 7:
        value += 5

    # Random emergency spike
    if np.random.rand() < 0.05:
        value += 8

    demand.append(max(5, value))

df = pd.DataFrame({
    "ds": dates,
    "y": demand
})

df.to_csv("blood_demand.csv", index=False)

print("Dataset generated successfully!")

plt.plot(df["ds"], df["y"])
plt.title("Synthetic Blood Demand Data")
plt.xlabel("Date")
plt.ylabel("Units Required")
plt.show()